export const config = {
  runtime: "edge",
  maxDuration: 10,
};

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "gpt-4o-mini";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-vercel-protection-bypass",
};

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `
You are a concise assistant. Detect intent:
- If the user clearly wants a home-service/quote, guide them by asking 1–2 questions at a time until you have: name, phone, email, service needed, city/ZIP, urgency, short description. Ask only missing fields, and only when the user signals they want the service. Never list all questions at once.
- If the user is asking anything else, answer normally without pushing the quote flow.
- Never ask for passwords, card numbers, or secret tokens. If a user shares secrets, warn and do not reuse the secret.
- Keep replies short (1–3 sentences) and avoid promising prices; say the team will confirm.
`;

function redactText(text: string): string {
  // Mask common secret/token/long-number patterns before sending to the LLM.
  return text
    .replace(/\bsk-[A-Za-z0-9]{10,}\b/g, "[redacted-token]")
    .replace(/\b[A-Za-z0-9]{24,}\b/g, "[redacted-token]")
    .replace(/\b\d{16,}\b/g, "[redacted-number]");
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  let messages: ChatMessage[] = [];
  try {
    const body = await req.json();
    messages = Array.isArray(body?.messages) ? body.messages : [];
  } catch {
    return new Response(JSON.stringify({ reply: "" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.CHAT_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ reply: "AI is not configured right now. Please try again later." }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  const sanitized = messages
    .filter((m) => m && typeof m.content === "string" && typeof m.role === "string")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: redactText(m.content.slice(0, 2000)),
    }));

  const lastUser = [...sanitized].reverse().find((m) => m.role === "user");
  const relevantKeywords = ["repair", "install", "service", "quote", "plumb", "roof", "hvac", "electric", "clean", "remodel", "paint", "landscap", "door", "window", "fence", "floor", "garage"];
  const isRelevant =
    lastUser &&
    relevantKeywords.some((k) => lastUser.content.toLowerCase().includes(k));
  if (!isRelevant) {
    return new Response(
      JSON.stringify({
        reply: "I can help with home services and quotes. Tell me what you need (service, city/ZIP, brief issue).",
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
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
          ...sanitized,
        ],
        max_output_tokens: 120,
        temperature: 0.4,
      }),
    });

    const json = await ai.json();
    let reply: unknown =
      json?.output_text ||
      (json?.output && json.output[0] && json.output[0].content) ||
      (json?.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) ||
      "";

    if (Array.isArray(reply)) {
      reply = reply.map((r: any) => (r && r.text ? r.text : r?.content || "")).join("\n");
    } else if (reply && typeof reply === "object") {
      const r = reply as any;
      reply = r.text || r.content || JSON.stringify(reply);
    }

    if (typeof reply !== "string") {
      reply = String(reply || "");
    }

    return new Response(JSON.stringify({ reply: (reply as string).trim() || "" }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ reply: "I hit an error. Please try again." }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
}
