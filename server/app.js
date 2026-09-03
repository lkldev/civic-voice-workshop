import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { createDb } from "./lib/db.js";
import { categorizeFeedback, fallbackCategory, normalizeCategory } from "./lib/openai.js";

export async function createApp(options = {}) {
  const db = options.db ?? (await createDb());
  const sessions = new Map();
  const categorize = options.categorizeFeedback ?? categorizeFeedback;
  const app = express();
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
      (candidate) => candidate.nric === nric && candidate.password === password && candidate.role === role,
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

  app.post("/api/feedback", async (req, res) => {
    const { nric, name, message } = req.body ?? {};
    if (!message) return res.status(400).json({ error: "Please enter feedback." });
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
