export const config = {
  runtime: "edge",
  maxDuration: 8, // fast response
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4o-mini";

const allowedOrigins = (process.env.SUGGEST_ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const allowAnyOrigin = allowedOrigins.length === 0;

const CORS_BASE = {
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-vercel-protection-bypass, authorization, x-api-key",
};

const SERVICES = [
  "Air Conditioning", "Carpentry", "Cleaning", "Concrete", "Drywall",
  "Electrician", "Fencing", "Flooring", "Garage Door Installation",
  "Garage Door Repair", "Handyman", "Heating & Furnace",
  "HVAC Contractors", "Landscaping", "Painting", "Pest Control",
  "Plumbing", "Remodeling", "Roofing", "Tile"
];

type Suggestion = { service: string; reason?: string };

const isSpam = (text: string): boolean => {
  if (text.length > 120) return true;
  if (/http|www|\.(ru|cn|xyz)|\@|free money/i.test(text)) return true;
  if (/fuck|sex|porno|casino|bitcoin/i.test(text)) return true;
  if (!/[a-zA-Z]/.test(text)) return true;
  return false;
};

const isOriginAllowed = (origin: string | null): boolean => {
  if (allowAnyOrigin) return true;
  if (!origin) return true; // server-to-server
  return allowedOrigins.includes(origin);
};

const getCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = { ...CORS_BASE };
  if (allowAnyOrigin) {
    headers["Access-Control-Allow-Origin"] = "*";
  } else if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
};

const jsonResponse = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });

const authenticateRequest = (req: Request) => {
  const expectedKey = process.env.SUGGEST_API_KEY;
  if (!expectedKey) return { ok: true };

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();
  const apiKeyHeader = req.headers.get("x-api-key")?.trim();
  const candidate = apiKeyHeader || bearer;

  if (candidate && candidate === expectedKey) {
    return { ok: true };
  }

  return { ok: false, status: 401, message: "Unauthorized" };
};

const SYSTEM_PROMPT = `
You map home repair issues to services from this list ONLY:

${SERVICES.map((service) => `- ${service}`).join("\n")}

Rules:
- Output ONLY a pure JSON array.
- Example: [{"service":"Roofing","reason":"The roof is damaged"}]
- 1 to 4 items.
- "reason" must be a friendly single sentence (not a fragment) that explains why this service fits the issue, and it should feel descriptive rather than too short—aim for 15 to 120 characters.
- If query is NOT related to home services: RETURN:
  [{"service":"None","reason":"I can only help match home services."}]
- Never output "Handyman" unless ABSOLUTELY impossible to classify.
`;

const flattenText = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.text === "string") return record.text;
    if (Array.isArray(record.content)) return flattenText(record.content);
    if (record.content) return flattenText(record.content);
  }
  return "";
};

const parseSuggestions = (raw: string): Suggestion[] => {
  const trimmed = (raw || "").trim();
  if (!trimmed) return [];

  const tryParse = (payload: string): Suggestion[] => {
    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) return parsed as Suggestion[];
    } catch {}
    return [];
  };

  const direct = tryParse(trimmed);
  if (direct.length > 0) return direct;

  const bracketMatch = trimmed.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    const extracted = tryParse(bracketMatch[0]);
    if (extracted.length > 0) return extracted;
  }

  return [];
};

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
  }

  if (!isOriginAllowed(origin)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, origin);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  const authResult = authenticateRequest(req);
  if (!authResult.ok) {
    return jsonResponse({ error: authResult.message || "Unauthorized" }, authResult.status || 401, origin);
  }

  let query = "";
  try {
    const body = await req.json();
    query = (body?.query || "").toString().trim();
  } catch {
    return jsonResponse({ suggestions: [], error: "Invalid JSON payload" }, 400, origin);
  }

  if (!query) {
    return jsonResponse({ suggestions: [] }, 200, origin);
  }

  if (isSpam(query)) {
    return jsonResponse(
      {
        suggestions: [
          {
            service: "None",
            reason: "Your request looks invalid. Please describe a real home issue.",
          },
        ],
      },
      400,
      origin
    );
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    return jsonResponse({ suggestions: [], error: "OpenAI API key not configured" }, 503, origin);
  }

  try {
    const ai = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        max_output_tokens: 80,
        temperature: 0,
      }),
    });

    const json = await ai.json();
    if (!ai.ok) {
      const message =
        json?.error?.message || json?.error?.code || ai.statusText || "AI request failed";
      return jsonResponse({ suggestions: [], error: message, status: ai.status }, 502, origin);
    }

    const raw =
      flattenText(json?.output_text) ||
      flattenText(json?.output?.[0]?.content) ||
      flattenText(json?.choices?.[0]?.message?.content) ||
      "";

    const suggestions = parseSuggestions(raw);

    return jsonResponse({ suggestions }, 200, origin);
  } catch (error) {
    return jsonResponse(
      {
        suggestions: [],
        error: "AI request failed",
      },
      500,
      origin
    );
  }
}
