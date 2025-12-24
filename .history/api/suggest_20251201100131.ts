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

// 🚨 %100 SPAM KONTROLÜ
function isSpam(query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();

  if (q.length < 3) return true; // çok kısa
  if (/^[0-9]+$/.test(q)) return true; // sadece sayı
  if (/^[\p{Emoji}\p{Symbol}\s]+$/u.test(q)) return true; // sadece emoji
  if (/^(.)\1{3,}$/i.test(q)) return true; // aaaa, zzzz
  if (/http|www|\.com|\.net|tiktok|instagram/i.test(q)) return true; // url
  if (/(fuck|shit|sex|porno|küfür|reklam|btc|crypto|para kazan)/i.test(q)) return true;
  if (["hi","hey","ok","selam","?","??","...","test"].includes(q)) return true;

  return false;
}

const SYSTEM_PROMPT = `
You are a service-matching engine that maps user home-repair requests to valid services ONLY.

VALID SERVICES:
${SERVICES.map(s => "- " + s).join("\n")}

STRICT RULES:
- Your ENTIRE OUTPUT must be ONLY a raw JSON array: 
  [{"service":"Roofing","reason":"Short sentence"}]
- No markdown, no text before or after JSON.
- Return 1–3 services.
- NEVER return "Handyman" if the input is unclear, spammy, or not strongly related to repairs.
- The "reason" must be one clear sentence.
- If the user request is NOT related to home repair:
    return EXACTLY:
    [{"service":"none","reason":"I can only help with matching home-repair services from our list."}]
`;

type Suggestion = { service: string; reason?: string };

// Parse JSON safely
const parseSuggestions = (raw: string): Suggestion[] => {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  const b = raw.match(/\[[\s\S]*\]/);
  if (b) {
    try {
      const parsed = JSON.parse(b[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return [];
};

const filterAllowed = (suggestions: Suggestion[]): Suggestion[] => {
  return suggestions
    .filter(s => SERVICES.includes(s.service as ServiceType) || s.service === "none")
    .filter(s => !(s.service === "Handyman" && (!s.reason || s.reason.length < 8)))
    .slice(0, 3);
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  // Body
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

  // 🚨 Spam engeli
  if (isSpam(query)) {
    return new Response(
      JSON.stringify({
        suggestions: [
          {
            service: "none",
            reason:
              "Please describe a real home-repair issue so I can match the correct service.",
          },
        ],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ suggestions: [], error: "API key not configured" }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
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

    let suggestions = parseSuggestions(content);

    // Son kontrol – sadece geçerli servisler
    suggestions = filterAllowed(suggestions);

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    console.error("Suggestion error:", err);
    return new Response(
      JSON.stringify({
        suggestions: [
          {
            service: "none",
            reason: "Could not process your request. Please try again.",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
    );
  }
}
