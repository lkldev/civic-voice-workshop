import { describe, expect, it, vi } from "vitest";
import { categorizeFeedback, fallbackCategory, summarizeFeedback } from "./openai.js";

describe("feedback categorization", () => {
  it("parses the mocked OpenAI category response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"category":"Environment"}' } }] }),
    });

    await expect(categorizeFeedback("The park needs more recycling bins.", {
      apiKey: "fictional-test-key",
      fetchImpl,
    })).resolves.toBe("Environment");
    expect(fetchImpl).toHaveBeenCalledWith("https://api.openai.com/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer fictional-test-key" }),
    }));
  });

  it("uses the deterministic fallback without a key or on malformed output", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not valid category JSON" } }] }),
    });

    await expect(categorizeFeedback("The bus interchange is too crowded.", { fetchImpl })).resolves.toBe("Transport");
    await expect(categorizeFeedback("The bus interchange is too crowded.", {
      apiKey: "fictional-test-key",
      fetchImpl,
    })).resolves.toBe("Transport");
    expect(fallbackCategory("Please share more ideas.")).toBe("Other");
  });
});

describe("feedback summarization", () => {
  it("parses a summary from the mocked OpenAI response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "The walkway needs safer lighting. A second detail is omitted." } }] }),
    });

    await expect(summarizeFeedback("A long fictional feedback message.", {
      apiKey: "fictional-test-key",
      fetchImpl,
    })).resolves.toBe("The walkway needs safer lighting.");
    expect(fetchImpl).toHaveBeenCalledWith("https://api.openai.com/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer fictional-test-key" }),
    }));
  });

  it("fails clearly without a key or with an unsuccessful response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(summarizeFeedback("A long fictional feedback message.", { fetchImpl })).rejects.toThrow("OPENAI_API_KEY");
    await expect(summarizeFeedback("A long fictional feedback message.", {
      apiKey: "fictional-test-key",
      fetchImpl,
    })).rejects.toThrow("503");
  });
});
