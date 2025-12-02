export const config = {
  runtime: "edge",
  maxDuration: 8, // fast response
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4o-mini";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-vercel-protection-bypass",
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

const SYSTEM_PROMPT = `
You map home repair issues to services from this list ONLY:

${SERVICES.map((service) => `- ${service}`).join("\n")}

Rules:
- Output ONLY a pure JSON array.
- Example: [{"service":"Roofing","reason":"The roof is damaged"}]
- 1 to 4 items.
- "reason" must be short.
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  let query = "";
  try {
    const body = await req.json();
    query = (body?.query || "").toString().trim();
  } catch {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!query) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (isSpam(query)) {
    return new Response(
      JSON.stringify({
        suggestions: [
          {
            service: "None",
            reason: "Your request looks invalid. Please describe a real home issue.",
          },
        ],
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ suggestions: [], error: "OpenAI API key not configured" }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const ai = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
      return new Response(
        JSON.stringify({ suggestions: [], error: message, status: ai.status }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    const raw =
      flattenText(json?.output_text) ||
      flattenText(json?.output?.[0]?.content) ||
      flattenText(json?.choices?.[0]?.message?.content) ||
      "";

    const suggestions = parseSuggestions(raw);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        suggestions: [],
        error: "AI request failed",
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
}
