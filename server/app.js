import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { createDb } from "./lib/db.js";
import {
  categorizeFeedback,
  fallbackCategory,
  normalizeCategory,
  normalizeSummary,
  summarizeFeedback,
} from "./lib/openai.js";
import { verifyPassword } from "./lib/passwords.js";

export const FEEDBACK_STATUSES = ["New", "In review", "Closed"];

export async function createApp(options = {}) {
  const db = options.db ?? (await createDb());
  const sessions = new Map();
  const categorize = options.categorizeFeedback ?? categorizeFeedback;
  const summarize = options.summarizeFeedback ?? summarizeFeedback;
  const openaiApiKey = options.openaiApiKey ?? process.env.OPENAI_API_KEY;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const openaiBaseUrl = (options.openaiBaseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
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
    const pageSize = 10;
    const requestedPage = Number.parseInt(req.query.page ?? "1", 10);
    const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
    const { category, status } = req.query;
    const filtered = db.data.feedback.filter((item) => (
      (!category || item.category === category) && (!status || item.status === status)
    ));
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;
    return res.json({
      feedback: filtered.slice(start, start + pageSize),
      pagination: { page: currentPage, pageSize, totalItems, totalPages },
    });
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

  app.post("/api/feedback/:id/summary", requireSession, async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }

    const feedback = db.data.feedback.find((item) => item.id === req.params.id);
    if (!feedback) return res.status(404).json({ error: "Feedback not found." });
    if (typeof feedback.message !== "string" || feedback.message.length <= 200) {
      return res.status(400).json({ error: "Only feedback longer than 200 characters can be summarized.", feedback });
    }
    if (typeof feedback.summary === "string" && feedback.summary.trim()) {
      return res.json({ feedback, summary: feedback.summary, cached: true });
    }

    try {
      const summary = normalizeSummary(await summarize(feedback.message));
      if (!summary) throw new Error("Summarizer returned an empty summary.");
      feedback.summary = summary;
      await db.write();
      return res.json({ feedback, summary, cached: false });
    } catch {
      return res.status(502).json({
        error: "Summary is unavailable right now. The original feedback is still available.",
        feedback,
      });
    }
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

  app.post("/api/feedback/tts", requireSession, async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ error: "Please enter feedback to read aloud." });
    if (!openaiApiKey) {
      return res.status(503).json({ error: "Text-to-speech is unavailable because no OpenAI API key is configured." });
    }

    try {
      const response = await fetchImpl(`${openaiBaseUrl}/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
          voice: process.env.OPENAI_TTS_VOICE ?? "alloy",
          input: text,
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        return res.status(502).json({ error: "Text-to-speech could not be generated right now." });
      }

      const audio = Buffer.from(await response.arrayBuffer()).toString("base64");
      if (!audio) return res.status(502).json({ error: "Text-to-speech returned empty audio." });
      const contentType = response.headers?.get?.("content-type") || "audio/mpeg";
      return res.json({ audio, contentType });
    } catch {
      return res.status(502).json({ error: "Text-to-speech could not be generated right now." });
    }
  });

  return app;
}
