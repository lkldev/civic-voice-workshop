import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { createDb } from "./lib/db.js";
import { categorizeFeedback, fallbackCategory, normalizeCategory } from "./lib/openai.js";
import { verifyPassword } from "./lib/passwords.js";

export const FEEDBACK_STATUSES = ["New", "In review", "Closed"];

export async function createApp(options = {}) {
  const db = options.db ?? (await createDb());
  const sessions = new Map();
  const categorize = options.categorizeFeedback ?? categorizeFeedback;
  const app = express();
  app.locals.db = db;
  app.use(cors());
  app.use(express.json());

  function requireSession(req, res, next) {
    const authorization = req.header("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const user = token ? sessions.get(token) : undefined;
    if (!user) return res.status(403).json({ error: "Admin access required." });
    req.user = user;
    return next();
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "civic-voice-api" });
  });

  app.post("/api/login", (req, res) => {
    const { nric, password, role } = req.body ?? {};
    const user = db.data.users.find(
      (candidate) => candidate.nric === nric && verifyPassword(password, candidate.passwordHash) && candidate.role === role,
    );
    if (!user) return res.status(401).json({ error: "Invalid NRIC, password, or sign-in mode." });

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { nric: user.nric, name: user.name, role: user.role });
    return res.json({ token, user: { nric: user.nric, name: user.name, role: user.role } });
  });

  app.get("/api/feedback", requireSession, (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    return res.json({ feedback: db.data.feedback });
  });

  app.get("/api/feedback/export.csv", requireSession, (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    const { category, status } = req.query;
    const rows = db.data.feedback.filter((item) => (
      (!category || item.category === category) && (!status || item.status === status)
    ));
    const escapeCsv = (value) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
    const headers = ["id", "nric", "name", "message", "category", "status", "createdAt"];
    const csv = [headers, ...rows.map((item) => headers.map((header) => item[header]))]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    res.type("text/csv");
    res.attachment("feedback.csv");
    return res.send(`${csv}\r\n`);
  });

  app.patch("/api/feedback/:id/status", requireSession, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    const { status } = req.body ?? {};
    if (!FEEDBACK_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Please choose a valid feedback status." });
    }
    const feedback = db.data.feedback.find((item) => item.id === req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });
    feedback.status = status;
    await db.write();
    return res.json({ feedback });
  });

  app.post("/api/feedback", async (req, res) => {
    const { nric, name, message } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Please enter feedback." });
    }
    let category;
    try {
      category = normalizeCategory(await categorize(message));
    } catch {
      category = null;
    }
    
    const feedback = {
      id: crypto.randomUUID(), nric, name, message, category: category ?? fallbackCategory(message), status: "New",
      createdAt: new Date().toISOString(),
    };
    db.data.feedback.unshift(feedback);
    await db.write();
    return res.status(201).json({ feedback });
  });

  return app;
}
