// Vercel Edge Function: AI-powered service suggestions with OpenAI
export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
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
You map user home-repair requests to one or more services from a fixed list.

YOU MUST choose ONLY from this exact list:

- Air Conditioning
- Carpentry
- Cleaning
- Concrete
- Drywall
- Electrician
- Fencing
- Flooring
- Garage Door Installation
- Garage Door Repair
- Handyman
- Heating & Furnace
- HVAC Contractors
- Landscaping
- Painting
- Pest Control
- Plumbing
- Remodeling
- Roofing
- Tile

RULES:
- Return ONLY a valid JSON array. Nothing before or after it.
- NO markdown, NO explanation, NO extra text.
- Format:
  [{"service":"Roofing","reason":"Short one-sentence reason"}]
- Return 1–4 services.
- "reason" must be one short sentence.
- If there are multiple possible matches, include top 2–3.
`;

type Suggestion = { service: ServiceType; reason?: string };

const dedupeAllowed = (items: unknown[]): Suggestion[] => {
  const allowed = new Map(SERVICES.map((s) => [s.toLowerCase(), s]));
  const seen = new Set<string>();
  const out: Suggestion[] = [];

  for (const item of items) {
    let service: string | undefined = undefined;
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
  if (!raw) return [];

  // Direct JSON
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return dedupeAllowed(parsed);
  } catch {}

  // Extract any JSON array inside the text
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

  // Parse body
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
        temperature: 0,
        max_tokens: 150,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
      }),
    });

    if (!oaRes.ok) {
      const errorText = await oaRes.text();
      console.error("OpenAI error:", oaRes.status, errorText);

      return new Response(
        JSON.stringify({
          suggestions: [],
          error:
            oaRes.status === 429
              ? "Rate limit exceeded"
              : "OpenAI API error",
          status: oaRes.status,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    const data = await oaRes.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || "";
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
