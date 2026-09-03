import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { createDb } from "./lib/db.js";

export async function createApp(options = {}) {
  const db = options.db ?? (await createDb());
  const sessions = new Map();
  const openaiApiKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const openaiBaseUrl = (options.openaiBaseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
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

  app.post("/api/feedback/:id/translation", requireSession, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    const feedback = db.data.feedback.find((candidate) => candidate.id === req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });
    const original = typeof feedback.message === "string" ? feedback.message.trim() : "";
    if (!original) return res.status(400).json({ error: "Feedback has no text to translate." });
    if (!openaiApiKey) {
      return res.status(503).json({ error: "Translation is unavailable because no OpenAI API key is configured." });
    }

    try {
      const response = await fetchImpl(`${openaiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4o-mini",
          temperature: 0,
          messages: [
            { role: "system", content: "Translate the supplied civic feedback into natural English. Return only the translation, with no commentary." },
            { role: "user", content: original },
          ],
        }),
      });

      if (!response.ok) return res.status(502).json({ error: "Translation could not be generated right now." });
      const body = await response.json();
      const translation = body?.choices?.[0]?.message?.content;
      if (typeof translation !== "string" || !translation.trim()) {
        return res.status(502).json({ error: "Translation service returned an empty result." });
      }
      return res.json({ feedbackId: feedback.id, original: feedback.message, translation: translation.trim() });
    } catch {
      return res.status(502).json({ error: "Translation could not be generated right now." });
    }
  });

  app.post("/api/feedback", async (req, res) => {
    const { nric, name, message } = req.body ?? {};
    if (!message) return res.status(400).json({ error: "Please enter feedback." });
    const feedback = {
      id: crypto.randomUUID(), nric, name, message, category: "General", status: "New",
      createdAt: new Date().toISOString(),
    };
    db.data.feedback.unshift(feedback);
    await db.write();
    return res.status(201).json({ feedback });
  });

  return app;
}
