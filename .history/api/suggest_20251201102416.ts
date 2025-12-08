// Vercel Serverless Function: AI-powered service suggestions with OpenAI
export const config = {
  runtime: 'nodejs',
  maxDuration: 5, // Fonksiyon en fazla 5 sn koşsun
};

const OPENAI_URL = 'https://api.openai.com/v1/responses';
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

type Suggestion = { service: ServiceType; reason?: string };

// -------------------- Spam ve kötü input filtresi -------------------- //

function isLikelySpam(raw: string): { spam: boolean; reason?: string } {
  const query = raw.toLowerCase();

  if (!query.trim()) return { spam: true, reason: 'empty' };

  // Çok kısa / çok uzun
  if (query.length < 4 || query.length > 300) {
    return { spam: true, reason: 'length' };
  }

  // Tekrarlayan karakterler
  if (/(.)\1{4,}/.test(query)) {
    return { spam: true, reason: 'repeated chars' };
  }

  // Çok fazla sembol
  const letters = query.replace(/[^a-z0-9 ]+/g, '');
  const symbolRatio = (query.length - letters.length) / query.length;
  if (symbolRatio > 0.4) {
    return { spam: true, reason: 'too many symbols' };
  }

  // Link / reklam kelimeleri
  if (/(http|www\.|\.com|\.ru|\.cn|instagram|tiktok|whatsapp|telegram)/.test(query)) {
    return { spam: true, reason: 'link-like' };
  }

  // Tamamen anlamsız random gibi görünen (çok fazla farklı harf/rakam karışımı)
  const alphaNum = query.replace(/[^a-z0-9]/g, '');
  const unique = new Set(alphaNum.split('')).size;
  if (alphaNum.length > 12 && unique / alphaNum.length > 0.8) {
    return { spam: true, reason: 'random-like' };
  }

  return { spam: false };
}

// “Bu tamamen ev servisi ile ilgili değil” gibi bariz durumlar
function clearlyNotHomeService(q: string): boolean {
  const query = q.toLowerCase();

  const nonHomeKeywords = [
    'essay',
    'homework',
    'school project',
    'cv yaz',
    'cover letter',
    'kilo ver',
    'diyet',
    'relationship',
    'sevgilim',
    'crypto',
    'bitcoin',
    'instagram takipçi',
    'tiktok izlenme',
    'seo',
    'marketing',
    'yasaklı',
    'illegal',
  ];

  return nonHomeKeywords.some((k) => query.includes(k));
}

// -------------------- Yardımcı: servis listesi filtreleme -------------------- //

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

    // Kötü inputta Handyman’a kaçış yok: zaten spam/out-of-scope ise AI’ye gitmiyoruz.
    if (match && !seen.has(match)) {
      seen.add(match);
      out.push({ service: match, reason });
    }

    if (out.length >= 4) break;
  }

  return out;
};

// -------------------- /v1/responses çıktısını parse et -------------------- //

const parseSuggestions = (raw: string): Suggestion[] => {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return dedupeAllowed(parsed);
  } catch {
    // ignore
  }

  const bracket = raw.match(/\[[\s\S]*\]/);
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

// -------------------- OpenAI prompt -------------------- //

const SYSTEM_PROMPT = `
You help map **U.S. home service requests** to one or more services from a fixed list.

You MUST choose ONLY from this list (case sensitive):
${SERVICES.map((s) => '- ' + s).join('\n')}

RULES:

1. Return ONLY a raw JSON array. No text before or after.
2. Format:
   [{"service":"Roofing","reason":"Short one-sentence reason."}]
3. Return 1–4 results, ordered from best to worst match.
4. "reason" = one short sentence explaining why this service fits.
5. Do NOT use "Handyman" unless:
   - User clearly describes small repairs, punch list, multiple minor tasks in a home.
6. If the request is spam, nonsense, or clearly NOT about home services,
   return an **empty array**: [] (do NOT try to guess or fall back to Handyman).
`;

// -------------------- Ana handler -------------------- //

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  let query = '';

  try {
    const body = await req.json();
    query = (body?.query || '').toString().trim();
  } catch {
    return new Response(JSON.stringify({ suggestions: [], error: 'INVALID_BODY' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  if (!query) {
    return new Response(JSON.stringify({ suggestions: [], error: 'EMPTY_QUERY' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  // 1) Spam filtresi – hiç OpenAI’ye gitmeden
  const spamCheck = isLikelySpam(query);
  if (spamCheck.spam) {
    return new Response(
      JSON.stringify({
        suggestions: [],
        error: 'SPAM_DETECTED',
        message:
          "We couldn't understand this request. Please describe your home project in normal words (e.g., 'roof is leaking', 'install new AC').",
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      },
    );
  }

  // 2) Bariz şekilde ev servisi ile alakasızsa – yine AI yok
  if (clearlyNotHomeService(query)) {
    return new Response(
      JSON.stringify({
        suggestions: [],
        error: 'OUT_OF_SCOPE',
        message:
          "We can only help you find local home-service pros (roofing, plumbing, electrical, HVAC, etc.). Please describe a home service project.",
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        suggestions: [],
        error: 'MISSING_API_KEY',
        message: 'Service temporarily unavailable.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      },
    );
  }

  // 3) OpenAI çağrısı – 4.5 sn sonra abort
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const oaRes = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query },
        ],
        max_output_tokens: 120,
        temperature: 0,
      }),
    });

    clearTimeout(timeout);

    if (!oaRes.ok) {
      const txt = await oaRes.text().catch(() => '');
      console.error('OpenAI error', oaRes.status, txt);

      return new Response(
        JSON.stringify({
          suggestions: [],
          error: 'OPENAI_ERROR',
          status: oaRes.status,
          message:
            "We couldn't process your request right now. Please try again in a moment.",
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        },
      );
    }

    const data = await oaRes.json();

    // /v1/responses çıktısından text'i çek
    let content = '';
    const firstOutput = data?.output?.[0]?.content?.[0];

    if (typeof firstOutput === 'string') {
      content = firstOutput;
    } else if (firstOutput?.text) {
      content = firstOutput.text;
    } else if (firstOutput?.output_text) {
      content = firstOutput.output_text;
    } else if (Array.isArray(data?.output_text) && data.output_text[0]) {
      content = data.output_text[0];
    }

    const suggestions = parseSuggestions((content || '').trim());

    // Hiç servis çıkmazsa: kullanıcıya açıklama mesajı dön
    if (!suggestions.length) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          error: 'NO_MATCH',
          message:
            "We can only help you find home-service pros from the list above (roofing, plumbing, electrical, HVAC, etc.). Please rewrite your request with more detail.",
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        },
      );
    }

    return new Response(JSON.stringify({ suggestions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (err: any) {
    clearTimeout(timeout);
    console.error('Suggestion error:', err);

    const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');

    return new Response(
      JSON.stringify({
        suggestions: [],
        error: aborted ? 'TIMEOUT' : 'UNKNOWN',
        message: aborted
          ? "It took too long to understand your request. Please simplify your description and try again."
          : "We couldn't process your request right now. Please try again in a moment.",
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      },
    );
  }
}
