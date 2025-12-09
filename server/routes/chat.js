import express from 'express';
import { db } from '../db.js';
import { submissions } from '../../shared/schema.js';
import { getClientIP, parseUserAgent } from '../utils/geoip.js';
import { getGeoFromIP } from '../helpers/geo.js';

const router = express.Router();

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `
You are a concise assistant for a home-services quote flow. Goal: gather the fields needed to fill a Google Sheet submission like a quote form.
- Collect in a friendly way: customer name, phone, email, service needed, city/ZIP, urgency, and a short description of the issue.
- If any key field is missing, ask a short clarifying question; otherwise, confirm details briefly and suggest submitting.
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

export default router;
