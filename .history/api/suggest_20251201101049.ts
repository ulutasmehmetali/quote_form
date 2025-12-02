// /api/suggest — FINAL VERSION (fast, safe, spam-protected)

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
];

const SERVICE_SET = new Set(SERVICES.map(s => s.toLowerCase()));

const SYSTEM_PROMPT = `
You map user home-repair requests to the fixed list below.

ONLY choose from this list:
${SERVICES.map(s => "- " + s).join("\n")}

Rules:
- Return ONLY a raw JSON array. No text outside JSON.
- Format: [{"service":"Roofing", "reason":"Short sentence"}]
- Return 1–4 services.
- "reason" must be one short sentence.
- If user request is unrelated, unsafe, gibberish, spam, or not home-repair:
  RETURN EXACTLY THIS JSON:
  [{"service":"None","reason":"I can only help identify home-service categories from the list."}]
`;


// ---------------------- SPAM BLOCKER ----------------------
// Engeller: tekrarlı kelime, meaningless pattern, URL, reklam, küfür,
// alakasız konu gibi şeyleri
function isSpam(text: string): boolean {

  if (!text) return true;

  const lower = text.toLowerCase();

  // Çok tekrar
  if (/(.)\1{4,}/.test(lower)) return true;

  // Çok fazla tekrar eden kelime
  const words = lower.split(/\s+/);
  const freq: Record<string, number> = {};
  for (let w of words) {
    freq[w] = (freq[w] || 0) + 1;
    if (freq[w] >= 5) return true;
  }

  // URL / domain / reklam
  if (lower.includes("http") || lower.includes(".com") || lower.includes("www")) return true;

  // saçma anlamsız pattern
  if (/^[a-z0-9]+$/.test(lower) && lower.length > 15) return true;

  // küfür vb (örnek)
  if (/(fuck|shit|porno|sex|nude)/.test(lower)) return true;

  return false;
}


// ---------------------- HARD TIMEOUT (MAX 5s) ----------------------
function timeout(ms: number) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("AI timeout")), ms)
  );
}


// ---------------------- JSON PARSER ----------------------
function parseJson(output: string) {
  if (!output) return [];

  try {
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // JSON array yakalama
  const m = output.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const p = JSON.parse(m[0]);
      if (Array.isArray(p)) return p;
    } catch {}
  }

  return [];
}


// ---------------------- API HANDLER ----------------------
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
    query = (body?.query || "").toString().trim();
  } catch {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 400,
      headers: CORS_HEADERS
    });
  }

  // EMPTY INPUT
  if (!query) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: CORS_HEADERS
    });
  }

  // SPAM BLOCK
  if (isSpam(query)) {
    return new Response(JSON.stringify({
      suggestions: [{
        service: "None",
        reason: "Your request looks invalid. Please describe a home-related issue."
      }]
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  }


  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ suggestions: [], error: "API key missing" }), {
      status: 200,
      headers: CORS_HEADERS
    });
  }


  try {
    // ---- AI REQUEST WITH 5 SECOND HARD TIMEOUT ----
    const result: any = await Promise.race([
      fetch(OPENAI_URL, {
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
          max_output_tokens: 120,
          temperature: 0
        }),
      }),
      timeout(5000)
    ]);

    const json = await result.json();
    const text =
      json?.output_text ??
      json?.choices?.[0]?.message?.content ??
      "";

    let parsed = parseJson(text);

    // FILTER & VALIDATE SERVICES
    const cleaned = parsed
      .map((item: any) => ({
        service: item.service || "",
        reason: item.reason || ""
      }))
      .filter((x: any) =>
        x.service === "None" || SERVICE_SET.has(x.service.toLowerCase())
      );

    // Kötü input → handyman yazmasın
    if (cleaned.length === 0 || cleaned[0].service.toLowerCase() === "handyman") {
      return new Response(JSON.stringify({
        suggestions: [{
          service: "None",
          reason: "I can only help by matching your request to home-services on the list."
        }]
      }), {
        status: 200,
        headers: CORS_HEADERS
      });
    }

    return new Response(
      JSON.stringify({ suggestions: cleaned }),
      { status: 200, headers: CORS_HEADERS }
    );

  } catch (err) {
    console.error("AI error:", err);

    return new Response(JSON.stringify({
      suggestions: [{
        service: "None",
        reason: "Service matching is temporarily unavailable. Please try again."
      }]
    }), {
      status: 200,
      headers: CORS_HEADERS
    });
  }
}
