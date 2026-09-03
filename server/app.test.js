import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
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

  it("accepts feedback", async () => {
    const app = await testApp();
    const response = await request(app).post("/api/feedback").send({
      nric: "S0000001A", name: "Aisha Rahman", message: "Please add more benches.",
    });
    expect(response.status).toBe(201);
    expect(response.body.feedback.message).toBe("Please add more benches.");
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
});

describe("admin feedback translation", () => {
  it("returns a mocked English translation and preserves the original", async () => {
    const db = await testAppDb();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "The crossing needs a signal." } }] }),
    });
    const app = await createApp({ db, openaiApiKey: "fictional-test-key", fetchImpl, openaiBaseUrl: "https://mock.openai.test/v1" });

    const response = await request(app)
      .post("/api/feedback/fb-seed-1/translation")
      .set(await adminHeaders(app));

    expect(response.status).toBe(200);
    expect(response.body.original).toBe(db.data.feedback[0].message);
    expect(response.body.translation).toBe("The crossing needs a signal.");
    expect(db.data.feedback[0].message).toContain("sheltered walkway");
    expect(fetchImpl).toHaveBeenCalledWith("https://mock.openai.test/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer fictional-test-key" }),
    }));
  });

  it("rejects a provider failure without changing the original", async () => {
    const db = await testAppDb();
    const original = db.data.feedback[0].message;
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const app = await createApp({ db, openaiApiKey: "fictional-test-key", fetchImpl });

    const response = await request(app)
      .post("/api/feedback/fb-seed-1/translation")
      .set(await adminHeaders(app));

    expect(response.status).toBe(502);
    expect(response.body.error).toMatch(/translation/i);
    expect(db.data.feedback[0].message).toBe(original);
  });

  it("requires the admin role before calling the provider", async () => {
    const fetchImpl = vi.fn();
    const app = await createApp({ db: await testAppDb(), openaiApiKey: "fictional-test-key", fetchImpl });

    const response = await request(app).post("/api/feedback/fb-seed-1/translation");

    expect(response.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

async function testAppDb() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "civic-voice-"));
  return createDb(path.join(directory, "db.json"));
}

async function adminHeaders(app) {
  const response = await request(app).post("/api/login").send({
    nric: "S0000002B", password: "admin123", role: "admin",
  });
  return { Authorization: `Bearer ${response.body.token}` };
}
