// Vercel EDGE Function – AI Suggestion API (ZERO TIMEOUT)
export const config = {
  runtime: "edge",
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
Map the user's home-repair request to 1–4 services from the list below.

ONLY choose from this list:
${SERVICES.map(s => "- " + s).join("\n")}

RULES:
- Return ONLY a JSON array.
- No markdown, no extra text.
- Format:
  [{"service":"Roofing","reason":"Short reason"}]
- 1 sentence per "reason".
`;

type Suggestion = { service: ServiceType; reason: string };

function cleanOutput(raw: string): Suggestion[] {
  try {
    const json = JSON.parse(raw);
    if (Array.isArray(json)) return json;
  } catch {}

  const match = raw.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const json = JSON.parse(match[0]);
      if (Array.isArray(json)) return json;
    } catch {}
  }
  return [];
}

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

  const body = await req.json().catch(() => null);
  const query = body?.query?.trim() || "";

  if (!query) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    const ai = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query }
        ],
        max_output_tokens: 150,
        temperature: 0,
      }),
    });

    const data = await ai.json();
    const output =
      data?.output_text ||
      data?.response_text ||
      data?.choices?.[0]?.message?.content ||
      "";

    const suggestions = cleanOutput(output);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      suggestions: [],
      error: "AI request failed",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
}
