// Vercel Edge Function: AI-powered service suggestions with OpenAI
export const config = {
  runtime: 'nodejs',
};

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-vercel-protection-bypass',
};

const SERVICES = [
  'Air Conditioning',
  'Carpentry',
  'Cleaning',
  'Concrete',
  'Drywall',
  'Electrician',
  'Fencing',
  'Flooring',
  'Garage Door Installation',
  'Garage Door Repair',
  'Handyman',
  'Heating & Furnace',
  'HVAC Contractors',
  'Landscaping',
  'Painting',
  'Pest Control',
  'Plumbing',
  'Remodeling',
  'Roofing',
  'Tile',
] as const;

type ServiceType = (typeof SERVICES)[number];

const SYSTEM_PROMPT = `You map user requests to one or more services from a fixed list. The list you MUST choose from is:
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

Rules:
- Only return services from the list above.
- Return 1-4 services ranked from most to least likely.
- Output JSON array ONLY (no prose/markdown) shaped like: [{"service":"<service>","reason":"<short reason>"}]
- "reason" must be one concise sentence that ties the user's request to the service (why this service fits).
- Prefer the most specific match; if unsure, include top 2-3 possibilities.`;

type Suggestion = { service: ServiceType; reason?: string };

const dedupeAllowed = (items: unknown[]): Suggestion[] => {
  const allowed = new Map(SERVICES.map((s) => [s.toLowerCase(), s]));
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const item of items) {
    let service: string | undefined;
    let reason = '';
    if (typeof item === 'object' && item !== null && 'service' in item) {
      service = String((item as any).service);
      if ((item as any).reason) reason = String((item as any).reason);
    } else if (typeof item === 'string') {
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
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return dedupeAllowed(parsed);
  } catch {
    // ignore
  }
  const bracket = raw.match(/\[[^\]]+\]/);
  if (bracket) {
    try {
      const parsed = JSON.parse(bracket[0]);
      if (Array.isArray(parsed)) return dedupeAllowed(parsed);
    } catch {
      // ignore
    }
  }
  return [];
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let query = '';
  try {
    const body = await req.json();
    query = (body?.query || '').toString().trim();
  } catch {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (!query) {
    return new Response(JSON.stringify({ suggestions: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ suggestions: [], error: 'Missing OPENAI_API_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  const body = {
    model: MODEL,
    temperature: 0,
    max_tokens: 150,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: query },
    ],
  };

  let oaRes: Response;
  try {
    oaRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return new Response(JSON.stringify({ suggestions: [], error: 'Upstream fetch failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (!oaRes.ok) {
    let upstreamMessage = '';
    try {
      const text = await oaRes.text();
      upstreamMessage = text?.slice(0, 400) || '';
    } catch {
      upstreamMessage = '';
    }

    // Always return 200 so the frontend can fall back gracefully; include error context
    return new Response(
      JSON.stringify({
        suggestions: [],
        error:
          oaRes.status === 429
            ? 'OpenAI rate limit or quota'
            : upstreamMessage || 'Upstream error',
        status: oaRes.status,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    );
  }

  const data = await oaRes.json();
  const content: string =
    data?.choices?.[0]?.message?.content?.trim() ||
    data?.choices?.[0]?.message?.content ||
    '';

  const suggestions = parseSuggestions(content);

  return new Response(JSON.stringify({ suggestions }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
