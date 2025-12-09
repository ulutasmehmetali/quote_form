import express from 'express';
import { db } from '../db.js';
import { submissions } from '../../shared/schema.js';
import { getClientIP, parseUserAgent } from '../utils/geoip.js';
import { getGeoFromIP } from '../helpers/geo.js';

const router = express.Router();

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `
You are a concise assistant. Detect intent:
- If the user clearly wants a home-service/quote, guide them by asking 1–2 questions at a time until you have: name, phone, email, service needed, city/ZIP, urgency, short description. Ask only missing fields, and only when the user signals they want the service. Never list all questions at once.
- If the user is asking anything else, answer normally without pushing the quote flow.
- Never ask for passwords, card numbers, or secret tokens. If a user shares secrets, warn and do not reuse the secret.
- Keep replies short (1–3 sentences) and avoid promising prices; say the team will confirm.
`;

const redactText = (text = '') =>
  text
    .replace(/\bsk-[A-Za-z0-9]{10,}\b/g, '[redacted-token]')
    .replace(/\b[A-Za-z0-9]{24,}\b/g, '[redacted-token]')
    .replace(/\b\d{16,}\b/g, '[redacted-number]')
    .slice(0, 2000);

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
  const relevantKeywords = ['repair', 'install', 'service', 'quote', 'plumb', 'roof', 'hvac', 'electric', 'clean', 'remodel', 'paint', 'landscap', 'door', 'window', 'fence', 'floor', 'garage'];
  const isRelevant =
    lastUser &&
    relevantKeywords.some((k) => lastUser.content.toLowerCase().includes(k));
  if (!isRelevant) {
    return res.json({
      reply: 'I can help with home services and quotes. Tell me what you need (service, city/ZIP, brief issue).',
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
    console.error('AI chat error:', err);
    return res.status(200).json({ reply: 'I hit an error. Please try again.' });
  }
});

router.post('/chat/submit', async (req, res) => {
  try {
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
You triage home-service requests from images. Respond with JSON ONLY:
{
 "serviceType": "plumbing|electrical|hvac|roofing|flooring|pest control|landscaping|painting|cleaning|remodeling|handyman|garage door|concrete|fencing|other",
 "summary": "one short sentence describing what you see and the likely service needed; if unsure, still give your best guess without asking the user for more info"
}
Always provide a summary even with low confidence. Never invent prices.`;

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
              { type: 'input_image', image_url: { url: image } },
            ],
          },
        ],
        temperature: 0,
        max_output_tokens: 220,
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

export default router;

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
Fill what you can; leave missing as "". "ready" is true only if all required (name, phone, email, serviceType, zipCode, description) are non-empty.
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
