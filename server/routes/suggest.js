import express from 'express';

const router = express.Router();

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const SERVICES = [
  'Air Conditioning', 'Carpentry', 'Cleaning', 'Concrete', 'Drywall', 'Electrician',
  'Fencing', 'Flooring', 'Garage Door Installation', 'Garage Door Repair', 'Handyman',
  'Heating & Furnace', 'HVAC Contractors', 'Landscaping', 'Painting', 'Pest Control',
  'Plumbing', 'Remodeling', 'Roofing', 'Tile',
];

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

const dedupeAllowed = (items) => {
  const allowed = new Map(SERVICES.map(s => [s.toLowerCase(), s]));
  const seen = new Set();
  const out = [];
  
  for (const item of items) {
    let service;
    let reason = '';
    
    if (typeof item === 'object' && item !== null && 'service' in item) {
      service = String(item.service);
      if (item.reason) reason = String(item.reason);
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

const parseSuggestions = (raw) => {
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

/**
 * POST /api/suggest
 * AI-powered service suggestion endpoint
 */
router.post('/suggest', async (req, res) => {
  const query = (req.body?.query || '').toString().trim();
  
  if (!query) {
    return res.json({ suggestions: [] });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set - AI suggestions disabled');
    return res.json({ 
      suggestions: [], 
      error: 'AI suggestions not configured' 
    });
  }

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 150,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: query },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      let errorMessage = 'OpenAI API error';
      
      if (status === 429) {
        errorMessage = 'OpenAI rate limit exceeded';
      } else if (status === 401) {
        errorMessage = 'Invalid OpenAI API key';
      }
      
      console.error(`OpenAI API error: ${status}`, errorMessage);
      return res.json({ 
        suggestions: [], 
        error: errorMessage,
        status 
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content?.trim() || '';
    const suggestions = parseSuggestions(content);

    res.json({ suggestions });

  } catch (error) {
    console.error('AI suggestion error:', error);
    res.json({ 
      suggestions: [], 
      error: 'Failed to get AI suggestions' 
    });
  }
});

export default router;
