export const FEEDBACK_CATEGORIES = ["Estate", "Transport", "Environment", "Other"];

const categoryAliases = new Map(FEEDBACK_CATEGORIES.map((category) => [category.toLowerCase(), category]));

const fallbackRules = [
  ["Estate", /\b(estate|housing|hdb|flat|apartment|block|lift|elevator|void deck|corridor|town council)\b/i],
  ["Transport", /\b(bus|mrt|train|station|traffic|road|crossing|walkway|pavement|cycling|bicycle|parking|taxi)\b/i],
  ["Environment", /\b(park|tree|trees|recycl|litter|rubbish|waste|pollution|drain|river|water|air quality|noise|clean)\b/i],
];

export function normalizeCategory(value) {
  if (typeof value !== "string") return null;
  return categoryAliases.get(value.trim().toLowerCase()) ?? null;
}

export function fallbackCategory(message) {
  const matchingRule = fallbackRules.find(([, pattern]) => pattern.test(message));
  return matchingRule?.[0] ?? "Other";
}

function categoryFromResponse(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") return null;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return normalizeCategory(content);
  }
  return normalizeCategory(parsed?.category);
}

export async function categorizeFeedback(
  message,
  { apiKey = process.env.OPENAI_API_KEY, fetchImpl = fetch } = {},
) {
  if (!apiKey) return fallbackCategory(message);

  try {
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Classify civic feedback into exactly one of Estate, Transport, Environment, or Other. Return JSON with a single category field.",
          },
          { role: "user", content: message },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "feedback_category",
            strict: true,
            schema: {
              type: "object",
              properties: { category: { type: "string", enum: FEEDBACK_CATEGORIES } },
              required: ["category"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!response.ok) throw new Error(`OpenAI category request failed (${response.status}).`);
    const category = categoryFromResponse(await response.json());
    return category ?? fallbackCategory(message);
  } catch {
    return fallbackCategory(message);
  }
}
