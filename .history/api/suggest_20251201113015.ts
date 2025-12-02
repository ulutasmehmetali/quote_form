// /api/suggest.ts

export const config = {
  runtime: "nodejs",
  maxDuration: 8, // hızlı cevap
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

// ❌ SPAM / GARBAGE DETECTION
const isSpam = (text: string): boolean => {
  if (text.length > 120) return true;
  if (/http|www|\.(ru|cn|xyz)|\@|free money/i.test(text)) return true;
  if (/fuck|sex|porno|casino|bitcoins/i.test(text)) return true;
  if (!/[a-zA-Z]/.test(text)) return true;
  return false;
};

// AI'ye verilen sistem promptu
const SYSTEM_PROMPT = `
You map home repair issues to services from this list ONLY:

${SERVICES.map(s => "- " + s).join("\n")}

Rules:
- Output ONLY a pure JSON array.
- Example: [{"service":"Roofing","reason":"The roof is damaged"}]
- 1 to 4 items.
- "reason" must be short.
- If query is NOT related to home services: RETURN:
  [{"service":"None","reason":"I can only help match home services."}]
- Never output "Handyman" unless ABSOLUTELY impossible to classify.
`;

const parseSuggestions = (raw: string): Suggestion[] => {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Suggestion[];
  } catch {}
  return [];
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  let query = "";
  try {
    const body = await req.json();
    query = (body?.query || "").trim();
  } catch {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ❌ SPAM BLOCKING
  if (isSpam(query)) {
    return new Response(JSON.stringify({
      suggestions: [
        {
          service: "None",
          reason: "Your request looks invalid. Please describe a real home issue."
        }
      ]
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ suggestions: [], error: "No API key" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const ai = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      // ⬇ max_tokens azaltıldı hız için
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: query }
        ],
        max_output_tokens: 80,
        temperature: 0,
      }),
    });

    const json = await ai.json();
    const raw = json?.output_text ?? json?.choices?.[0]?.message?.content ?? "";

    const suggestions = parseSuggestions(raw);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      suggestions: [],
      error: "AI request failed",
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}
