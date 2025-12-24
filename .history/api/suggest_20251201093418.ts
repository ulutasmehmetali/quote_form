// Vercel AI Suggestion API (Fixed + Fully Working)

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// *** DOĞRU MODEL BU! ***
const MODEL = "gpt-4o-mini";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-vercel-protection-bypass",
};

const SERVICES = [
  "Air Conditioning",
  "Carpentry",
  "Cleaning",
  "Concrete",
  "Drywall",
  "Electrician",
  "Fencing",
  "Flooring",
  "Garage Door Installation",
  "Garage Door Repair",
  "Handyman",
  "Heating & Furnace",
  "HVAC Contractors",
  "Landscaping",
  "Painting",
  "Pest Control",
  "Plumbing",
  "Remodeling",
  "Roofing",
  "Tile",
] as const;

type ServiceType = (typeof SERVICES)[number];

const SYSTEM_PROMPT = `
You map home-repair requests to one or more services from a fixed list.

ONLY choose from this list:

Air Conditioning
Carpentry
Cleaning
Concrete
Drywall
Electrician
Fencing
Flooring
Garage Door Installation
Garage Door Repair
Handyman
Heating & Furnace
HVAC Contractors
Landscaping
Painting
Pest Control
Plumbing
Remodeling
Roofing
Tile

RULES:
- Return ONLY JSON array. No text before or after it.
- Format:
  [{"service":"Roofing","reason":"Short one-sentence reason"}]
- Return 1–4 services.
- "reason" must be one short sentence.
`;

type Suggestion = { service: ServiceType; reason: string };

const dedupeAllowed = (items: any[]): Suggestion[] => {
  const allowed = new Map(SERVICES.map((s) => [s.toLowerCase(), s]));
  const seen = new Set<string>();
  const out: Suggestion[] = [];

  for (const item of items) {
    if (typeof item !== "object" || !item.service) continue;

    const norm = String(item.service).toLowerCase().trim();
    const match = allowed.get(norm);
    if (!match) continue;

    if (!seen.has(match)) {
      seen.add(match);
      out.push({ service: match, reason: item.reason || "" });
    }

    if (out.length >= 4) break;
  }
  return out;
};

const parseSuggestions = (raw: string): Suggestion[] => {
  if (!raw) return [];

  // Try direct JSON
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return dedupeAllowed(parsed);
  } catch {}

  // Try extracting JSON inside text
  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return dedupeAllowed(parsed);
    } catch {}
  }

  return [];
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
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
    query = body?.query?.toString?.().trim() || "";
  } catch {}

  if (!query) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ suggestions: [], error: "API key missing" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  try {
    const oaRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 200,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
      }),
    });

    const data = await oaRes.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const suggestions = parseSuggestions(content);

    return new Response(JSON.stringify({ suggestions, raw: content }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    console.error("AI ERROR:", err);
    return new Response(
      JSON.stringify({ suggestions: [], error: "Server error" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
}
