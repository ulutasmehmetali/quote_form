import express from 'express';
import { db } from '../db.js';
import { submissions } from '../../shared/schema.js';
import { getClientIP, parseUserAgent } from '../utils/geoip.js';
import { getGeoFromIP } from '../helpers/geo.js';

const router = express.Router();

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-4o-mini';

const MAX_CHARS = Number(process.env.CHAT_MAX_CHARS || '1000');
// Rate limit eased to reduce accidental throttling during chat turns
const RATE_WINDOW_MS = Number(process.env.CHAT_RATE_WINDOW || '10000');
const RATE_MAX_REQUESTS = Number(process.env.CHAT_MAX_REQUESTS || '20');
const DEFAULT_CHAT_SHEETS_URL =
  'https://script.google.com/macros/s/AKfycbyO6-tW17jJ_i9qhOThaOgPHCPUHPHSX4xSBpquSAerQBp3tr37_tehB_0Pj-AGFL09/exec';
const CHAT_SHEETS_URL =
  process.env.CHAT_SHEETS_URL || process.env.SHEETS_URL || process.env.VITE_SHEETS_URL || DEFAULT_CHAT_SHEETS_URL;
const LANG_WHITELIST = (process.env.CHAT_LANGS_WHITELIST || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const rateBuckets = new Map(); // ip -> timestamps
const sendToSheet = async (payload = {}, url = CHAT_SHEETS_URL) => {
  if (!url) throw new Error('Sheet URL not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Sheet sync failed (${res.status}): ${text.slice(0, 200)}`);
    }
    console.info('chat_sheet_sync_success', { url: url.slice(0, 50) + '...' });
  } catch (err) {
    console.warn('Sheet sync failed (chat):', err?.message || err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const SYSTEM_PROMPT = `
You are a concise home-services assistant.
Rules:
- Always respond in English only.
- We only handle home services: Plumbing, Electrical, HVAC, Roofing, Flooring, Fencing, Concrete, Handyman, Cleaning, Remodeling, Painting, Landscaping, Garage Door, Pest Control, Carpentry, Drywall, Tile.
- First, infer the likely service from what the user wrote, state it briefly (1 clause), and suggest that category. If unclear, propose the closest one.
- Collect these fields in order, one per reply: 1) name, 2) phone, 3) email, 4) service (confirm or adjust), 5) city/ZIP, 6) urgency, 7) short description. Ask EXACTLY one short question per reply—never combine fields.
- Never end the conversation; avoid closing or “let me know if…” phrasing. Keep the flow going until permission is given.
- After you have all required fields, ask for permission to share their details with local pros before proceeding.
- If the user is asking anything else, answer briefly and helpfully without pushing the quote flow.
- Never ask for passwords, card numbers, or secrets. If a user shares secrets, warn and do not reuse them.
- Keep replies short (1-3 sentences) and avoid promising prices; say the team will confirm.
- If the topic is outside home services, respond once with a brief apology and list of services we offer, then wait.
`;

const redactText = (text = '') =>
  text
    .replace(/\bsk-[A-Za-z0-9]{10,}\b/g, '[redacted-token]')
    .replace(/\b[A-Za-z0-9]{24,}\b/g, '[redacted-token]')
    .replace(/\b\d{16,}\b/g, '[redacted-number]')
    .slice(0, 2000);

const isAllowedLanguage = (lang = '') => {
  if (!LANG_WHITELIST.length) return true;
  const norm = lang.toLowerCase().split('-')[0];
  return LANG_WHITELIST.includes(norm);
};

const normalizeLang = () => 'en';
const guessLanguageFromText = () => 'en';
const detectLanguage = () => 'en';

const SERVICE_KEYWORDS = [
  'repair', 'install', 'service', 'quote', 'plumb', 'roof', 'hvac', 'electric', 'clean', 'remodel', 'paint',
  'landscap', 'door', 'window', 'fence', 'floor', 'garage', 'concrete', 'tile',
  'handyman', 'handymen', 'handy man', 'handy-men', 'handy men', 'handy',
  'yard', 'water leak', 'help', 'assist', 'assistance',
  'air conditioning', 'heat', 'cool', 'furnace', 'carpentry', 'drywall', 'pest', 'gate', 'fence',
  // Turkish roots
  'tamir', 'onar', 'usta', 'tesisat', 'klima', 'cati', 'boya', 'temiz', 'insaat', 'tadilat', 'bahce', 'kapi', 'pencere',
];

const serviceListMessage =
  'I can help with: Plumbing, Electrical, HVAC, Roofing, Flooring, Fencing, Concrete, Handyman, Cleaning, Remodeling, Painting, Landscaping, Garage Door, Pest Control, Carpentry, Drywall, Tile.';

const LANG_MESSAGES = {
  en: {
    nonService: `I can help with home services. Which one do you need? ${serviceListMessage} Please share your city/ZIP and a short description.`,
    tooLong: 'Message is too long.',
    pii: 'Personal data detected.',
    langBlocked: 'Language not supported for chat.',
    rateLimit: 'Please slow down.',
    intro: 'Tell me what you need (service + city/ZIP + short issue) and I will help.',
  },
};

const getMessage = (lang, key) =>
  (LANG_MESSAGES[lang] && LANG_MESSAGES[lang][key]) || LANG_MESSAGES.en[key] || '';

const looksLikeService = (text = '') => {
  const lower = text.toLowerCase();
  return SERVICE_KEYWORDS.some((k) => lower.includes(k));
};

// Only block likely payment card numbers; allow phone/email so users can share contact info.
const hasPII = (text = '') => /\b\d{13,19}\b/.test(text);

const rateCheck = (key) => {
  const now = Date.now();
  const arr = rateBuckets.get(key) || [];
  const filtered = arr.filter((t) => now - t < RATE_WINDOW_MS);
  if (filtered.length >= RATE_MAX_REQUESTS) {
    rateBuckets.set(key, filtered);
    return false;
  }
  filtered.push(now);
  rateBuckets.set(key, filtered);
  return true;
};

router.post('/chat', async (req, res) => {
  const apiKey = process.env.CHAT_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ reply: 'AI is not configured right now. Please try again later.' });
  }

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = incoming
    .filter((m) => m && typeof m.content === 'string')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: redactText(m.content || ''),
    }))
    .slice(-40);

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const text = lastUser?.content || '';
  const lang = detectLanguage(req, messages);
  const serviceSeen = messages.some((m) => m.role === 'user' && looksLikeService(m.content || ''));

  const ipKey = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  if (!rateCheck(ipKey)) {
    console.warn(JSON.stringify({ event: 'chat_rate_limit', ip: ipKey, reason: 'too_many', lang }));
    return res.status(429).json({ reply: getMessage(lang, 'rateLimit') });
  }

  if (text.length > MAX_CHARS) {
    console.warn(JSON.stringify({ event: 'chat_too_long', ip: ipKey, lang, len: text.length }));
    return res.status(413).json({ reply: getMessage(lang, 'tooLong') });
  }

  if (hasPII(text)) {
    console.warn(JSON.stringify({ event: 'chat_pii_block', ip: ipKey, lang, reason: 'pii_detected' }));
    return res.status(400).json({ reply: getMessage(lang, 'pii') });
  }

  if (!isAllowedLanguage(lang)) {
    console.warn(JSON.stringify({ event: 'chat_lang_block', ip: ipKey, lang, reason: 'lang_not_allowed' }));
    return res.status(400).json({ reply: getMessage(lang, 'langBlocked') });
  }

  if (!messages.length) {
    return res.json({
      reply: getMessage(lang, 'intro'),
    });
  }

  try {
    const ai = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.4,
        max_output_tokens: 160,
      }),
    });

    if (!ai.ok) {
      const safeMsg = ai.status === 401 ? 'AI key invalid' : 'AI service unavailable';
      return res.status(200).json({ reply: safeMsg });
    }

    const json = await ai.json();
    let reply =
      json?.output_text ||
      (json?.output && json.output[0] && json.output[0].content) ||
      (json?.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) ||
      '';

    if (Array.isArray(reply)) {
      reply = reply.map((r) => (r && r.text ? r.text : r.content || '')).join('\n');
    } else if (typeof reply === 'object' && reply !== null) {
      reply = reply.text || reply.content || JSON.stringify(reply);
    }

    if (typeof reply !== 'string') {
      reply = String(reply || '');
    }

    return res.json({ reply: reply.trim() });
  } catch (err) {
    console.error('AI chat error:', { err, lang, ip: ipKey });
    return res.status(200).json({ reply: 'I hit an error. Please try again.' });
  }
});

router.post('/chat/submit', async (req, res) => {
  try {
    if (!CHAT_SHEETS_URL) {
      console.error('Chat sheet URL missing; set CHAT_SHEETS_URL or SHEETS_URL');
      return res.status(500).json({ error: 'Sheet sync not configured' });
    }

    const {
      name = '',
      phone = '',
      email = '',
      serviceType = '',
      zipCode = '',
      urgency = '',
      description = '',
    } = req.body || {};

    if (!name || !phone || !email || !serviceType || !zipCode || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const uaInfo = parseUserAgent(userAgent);
    const geoInfo = await getGeoFromIP(ipAddress);

    const now = new Date();
    const [submission] = await db
      .insert(submissions)
      .values({
        serviceType,
        zipCode,
        customerName: name,
        name,
        email,
        phone,
        status: 'new',
        answers: {
          urgency,
          description,
        },
        ipAddress,
        userAgent,
        browser: uaInfo.browser,
        browserVersion: uaInfo.browserVersion,
        os: uaInfo.os,
        osVersion: uaInfo.osVersion,
        device: uaInfo.device,
        deviceType: uaInfo.deviceType,
        country: geoInfo.country,
        countryCode: geoInfo.country_code,
        city: geoInfo.city,
        region: geoInfo.region,
        timezone: geoInfo.timezone,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const responses = { urgency, description };
    const answers = [
      { questionId: 'urgency', question: 'Urgency', answer: urgency },
      { questionId: 'description', question: 'Description', answer: description },
    ].filter((a) => a.answer);

    const photos = [];
    const sheetPayload = {
      // primary fields
      name,
      full_name: name,
      email,
      phone,
      serviceType,
      service_type: serviceType,
      zipCode,
      zip_code: zipCode,
      responses,
      raw_responses_json: JSON.stringify(responses || {}),
      answers,
      answers_json: JSON.stringify(answers || []),
      responseSummary: answers.map((a) => `${a.question}: ${a.answer || 'n/a'}`).join(' | '),
      response_summary: answers.map((a) => `${a.question}: ${a.answer || 'n/a'}`).join(' | '),
      // photos (none from chat, but keep schema parity)
      photos,
      photoUrls: photos,
      photoCount: photos.length,
      linked_photo: '',
      linked_photo2: '',
      linked_photo3: '',
      linked_photo4: '',
      photo_url: '',
      photo_url_2: '',
      photo_url_3: '',
      photo_url_4: '',
      // metadata
      submittedAt: now.toISOString(),
      submitted_at_utc: now.toISOString(),
      submittedAtLocal: now.toLocaleString(),
      submitted_at_local: now.toLocaleString(),
      source: 'chat',
      submissionId: submission.id,
    };
    try {
      await sendToSheet(sheetPayload);
    } catch (err) {
      const detail = err?.message || 'Sheet sync failed';
      console.error('Chat sheet sync error:', detail);
      return res.status(500).json({ error: 'Failed to sync to sheet', detail });
    }

    return res.json({ success: true, submissionId: submission.id });
  } catch (err) {
    console.error('AI chat submit error:', err);
    return res.status(500).json({ error: 'Failed to save submission' });
  }
});

router.post('/chat/image', async (req, res) => {
  const apiKey = process.env.CHAT_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI not configured' });

  const image = req.body?.image;
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image' });
  }
  const sizeBytes = Buffer.byteLength(image, 'utf8');
  if (sizeBytes > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image too large (max 10MB)' });
  }

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const textContext = incoming
    .filter((m) => m && typeof m.content === 'string')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: redactText(m.content || ''),
    }))
    .slice(-8);

  const visionPrompt = `
You triage home-service requests **only from the pixels of the image**. Never ask the user for more info.
Respond with JSON ONLY:
{
 "serviceType": "plumbing|electrical|hvac|roofing|flooring|pest control|landscaping|painting|cleaning|remodeling|handyman|garage door|concrete|fencing|other",
 "summary": "one sentence that cites 2-3 visual clues (object, material, location of damage) + likely service; include confidence (high/medium/low). If unsure, still describe what is visible and mark low confidence. Summary should use the same language as the most recent user message if available; otherwise English."
}
Rules:
- Use ONLY what you see; do not request clarification.
- Mention the object/area and the visible issue (e.g., hole in wooden door at bottom, scuff on drywall, leaking pipe, broken tile).
- If multiple possibilities, pick the top one and mark confidence low/medium/high.
- Never invent prices.
- If you see IDs, faces, children, or sensitive documents, do NOT summarize the content. Instead return: {"serviceType":"","summary":"Cannot process sensitive content."}`;

  try {
    const ai = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: 'system', content: visionPrompt },
          ...textContext,
          {
            role: 'user',
            content: [
              { type: 'input_text', text: 'Analyze this image and classify the needed service.' },
              { type: 'input_image', image_url: { url: image, detail: 'high' } },
            ],
          },
        ],
        temperature: 0.2,
        max_output_tokens: 320,
        response_format: { type: 'json_object' },
      }),
    });

    if (!ai.ok) return res.status(200).json({ error: 'vision failed' });
    const json = await ai.json();
    let reply =
      json?.output_text ||
      (json?.output && json.output[0] && json.output[0].content) ||
      (json?.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) ||
      '';

    if (Array.isArray(reply)) reply = reply.map((r) => r?.text || r?.content || '').join('\n');
    if (reply && typeof reply === 'object') reply = reply.text || reply.content || JSON.stringify(reply);
    if (typeof reply !== 'string') reply = String(reply || '');

    let parsed = {};
    try {
      parsed = JSON.parse(reply);
    } catch {
      parsed = {};
    }

    const clean = (v) => (typeof v === 'string' ? v.trim().slice(0, 200) : '');
    const serviceType = clean(parsed.serviceType);
    const summary = clean(parsed.summary);
    return res.json({
      serviceType,
      summary: summary || reply,
    });
  } catch (err) {
    console.error('AI image analyze error:', err);
    return res.status(200).json({ error: 'analyze error' });
  }
});

router.post('/chat/extract', async (req, res) => {
  const apiKey = process.env.CHAT_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI not configured' });

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = incoming
    .filter((m) => m && typeof m.content === 'string')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: redactText(m.content || ''),
    }))
    .slice(-40);

  const extractionPrompt = `
Extract lead fields from the conversation if present. Output ONLY JSON:
{
 "name": "",
 "phone": "",
 "email": "",
 "serviceType": "",
 "zipCode": "",
 "urgency": "",
 "description": "",
 "ready": true|false
}
User may write in any language; still fill the fields above. "ready" is true only if all required (name, phone, email, serviceType, zipCode, description) are non-empty.
`;

  try {
    const ai = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: 'system', content: extractionPrompt }, ...messages],
        temperature: 0,
        max_output_tokens: 200,
      }),
    });

    if (!ai.ok) return res.status(200).json({ error: 'extract failed' });
    const json = await ai.json();
    let reply =
      json?.output_text ||
      (json?.output && json.output[0] && json.output[0].content) ||
      (json?.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) ||
      '';

    if (Array.isArray(reply)) reply = reply.map((r) => r?.text || r?.content || '').join('\n');
    if (reply && typeof reply === 'object') reply = reply.text || reply.content || JSON.stringify(reply);
    if (typeof reply !== 'string') reply = String(reply || '');

    let parsed = {};
    try {
      parsed = JSON.parse(reply);
    } catch {
      parsed = {};
    }

    const clean = (v) => (typeof v === 'string' ? v.trim().slice(0, 200) : '');
    const lead = {
      name: clean(parsed.name),
      phone: clean(parsed.phone),
      email: clean(parsed.email),
      serviceType: clean(parsed.serviceType),
      zipCode: clean(parsed.zipCode),
      urgency: clean(parsed.urgency),
      description: clean(parsed.description),
    };
    const ready = !!(lead.name && lead.phone && lead.email && lead.serviceType && lead.zipCode && lead.description);

    return res.json({ lead, ready });
  } catch (err) {
    console.error('AI extract error:', err);
    return res.status(200).json({ error: 'extract error' });
  }
});

export default router;
