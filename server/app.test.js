import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createDb } from "./lib/db.js";

async function testApp() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
  const db = await createDb(path.join(directory, "db.json"));
  return createApp({ db });
}

describe("CivicVoice baseline API", () => {
  it("creates a missing datastore directory on first use", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
    const db = await createDb(path.join(directory, "missing", "data", "db.json"));
    expect(db.data.users).toHaveLength(2);
  });

  it("logs in the seeded citizen", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/login").send({
      nric: "S0000001A", password: "citizen123", role: "citizen",
    });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("citizen");
  });

  it("logs in the seeded admin with the workshop password", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/login").send({
      nric: "S0000002B", password: "admin123", role: "admin",
    });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("admin");
  });

  it("persists only password hashes", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
    const file = path.join(directory, "db.json");
    const db = await createDb(file, { persist: true });
    await db.write();
    const persisted = JSON.parse(await readFile(file, "utf8"));

    expect(persisted.users.every((user) => !Object.hasOwn(user, "password"))).toBe(true);
    expect(persisted.users.every((user) => typeof user.passwordHash === "string")).toBe(true);
    expect(JSON.stringify(persisted)).not.toContain("citizen123");
    expect(JSON.stringify(persisted)).not.toContain("admin123");
  });

  it("migrates legacy plaintext records before login", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
    const file = path.join(directory, "db.json");
    await writeFile(file, JSON.stringify({
      users: [{ nric: "S0000001A", password: "citizen123", name: "Aisha Rahman", role: "citizen" }],
      feedback: [],
    }));

    const db = await createDb(file, { persist: true });
    const persisted = JSON.parse(await readFile(file, "utf8"));
    expect(Object.hasOwn(persisted.users[0], "password")).toBe(false);
    expect(persisted.users[0].passwordHash).toBeTruthy();

    const app = await createApp({ db });
    const response = await request(app).post("/api/login").send({
      nric: "S0000001A", password: "citizen123", role: "citizen",
    });
    expect(response.status).toBe(200);
  });

  it("accepts feedback", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "Please add more benches.",
    });
    expect(response.status).toBe(201);
    expect(response.body.feedback.message).toBe("Please add more benches.");
  });

  it("rejects blank or whitespace-only feedback", async () => {
    const app = await testApp();

    for (const message of ["", "   ", "\n\t"]) {
      const response = await request(app).post("/api/feedback").send({
        nric: "S0000001A", name: "Aisha Rahman", message,
      });
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Please enter feedback.");
    }
  });

  it("blocks the feedback list without the admin role header", async () => {
    const app = await testApp();
    const response = await request(app).get("/api/feedback");
    expect(response.status).toBe(403);
  });

  it("allows the admin session to read feedback", async () => {
    const app = await testApp();
    const login = await request(app).post("/api/login").send({
      nric: "S0000002B", password: "admin123", role: "admin",
    });

    const response = await request(app)
      .get("/api/feedback")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body.feedback).toHaveLength(1);
  });

  it("does not trust a forged role header for a citizen", async () => {
    const app = await testApp();
    const login = await request(app).post("/api/login").send({
      nric: "S0000001A", password: "citizen123", role: "citizen",
    });

    const response = await request(app)
      .get("/api/feedback")
      .set("Authorization", `Bearer ${login.body.token}`)
      .set("x-user-role", "admin");

    expect(response.status).toBe(403);
  });

  it("issues an opaque token and rejects invalid tokens", async () => {
    const app = await testApp();
    const login = await request(app).post("/api/login").send({
      nric: "S0000001A", password: "citizen123", role: "citizen",
    });
    const legacyToken = Buffer.from("S0000001A:citizen").toString("base64");
    expect(login.body.token).not.toBe(legacyToken);

    const response = await request(app)
      .get("/api/feedback")
      .set("Authorization", "Bearer invalid-session-token");

    expect(response.status).toBe(403);
  });

  it("filters feedback by category and status together", async () => {
    const app = await testApp();
    const login = await request(app).post("/api/login").send({
      nric: "S0000002B", password: "admin123", role: "admin",
    });
    app.locals.db.data.feedback = [
      { id: "match", category: "Transport", status: "Closed" },
      { id: "wrong-status", category: "Transport", status: "New" },
      { id: "wrong-category", category: "Estate", status: "Closed" },
    ];

    const response = await request(app)
      .get("/api/feedback?category=Transport&status=Closed")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body.feedback.map((item) => item.id)).toEqual(["match"]);
  });
});
