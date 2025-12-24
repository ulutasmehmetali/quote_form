import express from 'express';
import crypto from 'crypto';

import { supabase } from './helpers/supabase.js';
import { requireAuth, requireRole } from './adminRoutes.js';

const router = express.Router();

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => requireRole('admin')(req, res, next));
};

function sanitizeEvents(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((event) => (typeof event === 'string' ? event.trim() : ''))
    .filter(Boolean);
}

router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('List webhooks error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ webhooks: data });
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, url, events } = req.body;
  const secretKey = crypto.randomBytes(32).toString('hex');

  const normalizedEvents = sanitizeEvents(events);

  const { data, error } = await supabase
    .from('webhooks')
    .insert([
      {
        name,
        url,
        events: normalizedEvents,
        secret_key: secretKey,
        is_active: true,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Create webhook error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({
    success: true,
    secretKey,
    webhook: data,
  });
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, url, events, isActive } = req.body;
  const updates = {};

  if (name !== undefined) updates.name = name;
  if (url !== undefined) updates.url = url;
  if (events !== undefined) updates.events = sanitizeEvents(events);
  if (isActive !== undefined) updates.is_active = isActive;

  const { data, error } = await supabase
    .from('webhooks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Update webhook error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true, webhook: data });
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete webhook error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

router.post('/:id/test', requireAdmin, async (req, res) => {
  const { id } = req.params;

  const { data: hook, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !hook) {
    return res.status(404).json({ error: 'Webhook bulunamadı' });
  }

  const payload = {
    test: true,
    message: 'Webhook test başarılı',
    timestamp: new Date().toISOString(),
  };

  const signature = crypto
    .createHmac('sha256', hook.secret_key)
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    const response = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: JSON.stringify(payload),
    });

    let responseText = '';
    try {
      responseText = await response.text();
    } catch (readErr) {
      console.error('Webhook test read error:', readErr.message);
    }

    await supabase.from('webhook_logs').insert([
      {
        webhook_id: id,
        status: response.ok ? 'success' : 'failed',
        response_code: response.status,
        response_body: responseText,
      },
    ]);

    return res.json({
      success: response.ok,
      status: response.status,
      response: responseText,
    });
  } catch (err) {
    console.error('Webhook test error:', err.message);
    await supabase.from('webhook_logs').insert([
      {
        webhook_id: id,
        status: 'failed',
        response_code: 0,
        response_body: err.message,
      },
    ]);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post('/:id/test/custom', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const payload = req.body?.payload && typeof req.body.payload === 'object'
    ? { ...req.body.payload, test: true, timestamp: new Date().toISOString() }
    : { test: true, timestamp: new Date().toISOString(), message: 'Webhook custom test' };

  const { data: hook, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !hook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }

  const signature = crypto
    .createHmac('sha256', hook.secret_key)
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    const response = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    await supabase.from('webhook_logs').insert([
      {
        webhook_id: id,
        status: response.ok ? 'success' : 'failed',
        response_code: response.status,
        response_body: responseText,
      },
    ]);

    return res.json({
      success: response.ok,
      status: response.status,
      response: responseText,
    });
  } catch (err) {
    await supabase.from('webhook_logs').insert([
      {
        webhook_id: id,
        status: 'failed',
        response_code: 0,
        response_body: err.message,
      },
    ]);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/logs', requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const status = req.query.status;
  let query = supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  res.json({ logs: data || [] });
});
export default router;
