// Vercel Edge Function: AI-powered service suggestions with OpenAI
export const config = {
  runtime: "nodejs",
  maxDuration: 30,
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
] as const;

type ServiceType = (typeof SERVICES)[number];

const SYSTEM_PROMPT = `
You map user home-repair requests to one or more services from the fixed list below.

ONLY choose from this list:
${SERVICES.map(s => "- " + s).join("\n")}

RULES:
- Return ONLY a raw JSON array. No text before/after.
- Format: [{"service":"Roofing","reason":"Short reason"}]
- Return 1–4 results.
- "reason" must be one short sentence.
`;

type Suggestion = { service: ServiceType; reason?: string };

const dedupeAllowed = (items: unknown[]): Suggestion[] => {
  const allowed = new Map(SERVICES.map((s) => [s.toLowerCase(), s]));
  const seen = new Set<string>();
  const out: Suggestion[] = [];

  for (const item of items) {
    let service: string | undefined;
    let reason = "";

    if (typeof item === "object" && item !== null && "service" in item) {
      service = String((item as any).service);
      if ((item as any).reason) reason = String((item as any).reason);
    } else if (typeof item === "string") {
      service = item;
    }

    if (!service) continue;
    const norm = service.toLowerCase().trim();
    const match = allowed.get(norm);

    if (match && !seen.has(match)) {
      seen.add(match);
      out.push({ service: match, reason });
    }

    if (out.length >= 4) break;
  }
  return out;
};

const parseSuggestions = (raw: string): Suggestion[] => {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return dedupeAllowed(parsed);
  } catch {}

  const bracket = raw.match(/\[[\s\S]*\]/);
  if (bracket) {
    try {
      const parsed = JSON.parse(bracket[0]);
      if (Array.isArray(parsed)) return dedupeAllowed(parsed);
    } catch {}
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
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  if (!query) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        suggestions: [],
        error: "API key not configured",
      }),
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
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
        max_output_tokens: 150,
        temperature: 0,
      }),
    });

    const data = await oaRes.json();
    const content =
      data?.output_text ?? 
      data?.choices?.[0]?.message?.content ?? 
      "";

    const suggestions = parseSuggestions(content);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    console.error("Suggestion error:", err);
    return new Response(
      JSON.stringify({ suggestions: [], error: "Failed to fetch" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
}
