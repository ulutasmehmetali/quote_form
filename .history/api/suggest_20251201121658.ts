import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4o-mini";

const SERVICES = [
  "Air Conditioning", "Carpentry", "Cleaning", "Concrete", "Drywall",
  "Electrician", "Fencing", "Flooring", "Garage Door Installation",
  "Garage Door Repair", "Handyman", "Heating & Furnace",
  "HVAC Contractors", "Landscaping", "Painting", "Pest Control",
  "Plumbing", "Remodeling", "Roofing", "Tile"
];

const isSpam = (text: string): boolean => {
  if (text.length > 120) return true;
  if (/http|www|\.(ru|cn|xyz)|\@|free money/i.test(text)) return true;
  if (/fuck|sex|porno|casino|bitcoin/i.test(text)) return true;
  if (!/[a-zA-Z]/.test(text)) return true;
  return false;
};

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const query = (req.body?.query || "").trim();
  if (!query) {
    res.status(200).json({ suggestions: [] });
    return;
  }

  if (isSpam(query)) {
    res.status(200).json({
      suggestions: [
        {
          service: "None",
          reason: "Your request looks invalid. Please describe a real home issue."
        }
      ]
    });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({ suggestions: [], error: "No API key found" });
    return;
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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

    const json = await response.json();
    const raw = json?.output_text || json?.choices?.[0]?.message?.content || "[]";

    let suggestions = [];
    try {
      suggestions = JSON.parse(raw);
    } catch {
      suggestions = [];
    }

    res.status(200).json({ suggestions });
    
  } catch (err) {
    res.status(200).json({
      suggestions: [],
      error: "AI request failed",
    });
  }
}
