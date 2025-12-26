import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import uploadRoutes from './routes/upload.js';
import suggestRoutes from './routes/suggest.js';
import chatRoutes from './routes/chat.js';
import statsRoutes from './routes/stats.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './adminRoutes.js';
import adminWebhooksRouter from './adminWebhooks.js';
import adminDashboard from './adminDashboard.js';
import automationRoutes from './automationRoutes.js';
import { runAutomations } from './automationRuntime.js';

import { db } from './db.js';
import { partialForms, submissions, accessLogs } from '../shared/schema.js';
import { eq, desc, sql } from 'drizzle-orm';

import { parseUserAgent, getClientIP } from './utils/geoip.js';
import crypto from 'crypto';
import { getGeoFromIP } from './helpers/geo.js';
import { logSubmission, logActivity } from './helpers/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const ACCESS_LOG_COOKIE = 'access_session_id';
const ACCESS_LOG_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
let accessLogsReady = true;
const forceSkipAccessLogs = process.env.FORCE_SKIP_ACCESS_LOGS === 'true';
let accessLogNoticePrinted = false;
// Default: enable access logs unless explicitly disabled.
let skipAccessLogs =
  forceSkipAccessLogs ||
  process.env.SKIP_ACCESS_LOG_SCHEMA_SYNC === 'true' ||
  process.env.DISABLE_ACCESS_LOGS === 'true';
const bypassAccessLogSchemaCheck =
  process.env.BYPASS_ACCESS_LOG_SCHEMA_CHECK === 'true';

const ACCESS_LOG_COLUMNS = [
  { name: 'user_agent', definition: 'TEXT' },
  { name: 'browser', definition: 'TEXT' },
  { name: 'device_type', definition: 'TEXT' },
  { name: 'device_brand', definition: 'TEXT' },
  { name: 'device_model', definition: 'TEXT' },
  { name: 'country', definition: 'TEXT' },
  { name: 'city', definition: 'TEXT' },
  { name: 'path', definition: 'TEXT' },
  { name: 'method', definition: 'TEXT' },
  { name: 'referer', definition: 'TEXT' },
  { name: 'status_code', definition: 'INTEGER' },
  { name: 'latency_ms', definition: 'INTEGER' },
  { name: 'meta', definition: "JSONB DEFAULT '{}'::jsonb" },
];

const ACCESS_LOG_SCHEMA_STEPS = [
  sql`
    CREATE TABLE IF NOT EXISTS public.access_logs (
      id UUID PRIMARY KEY,
      session_id UUID,
      user_ip INET,
      user_agent TEXT,
      browser TEXT,
      device_type TEXT,
      device_brand TEXT,
      device_model TEXT,
      country TEXT,
      city TEXT,
      path TEXT,
      method TEXT,
      referer TEXT,
      status_code INTEGER,
      latency_ms INTEGER,
      meta JSONB DEFAULT '{}'::jsonb,
      entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      left_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `,
  sql`
    CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `,
  sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at') THEN
        CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON public.access_logs
        FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
      END IF;
    END;
    $$;
  `,
  sql`
    CREATE INDEX IF NOT EXISTS idx_access_logs_entered_at ON public.access_logs (entered_at);
  `,
  sql`
    CREATE INDEX IF NOT EXISTS idx_access_logs_user_ip ON public.access_logs (user_ip);
  `,
  sql`
    CREATE INDEX IF NOT EXISTS idx_access_logs_session_id ON public.access_logs (session_id);
  `,
];

/* -------------------------------------------
   HELMET / SECURITY
------------------------------------------- */

const scriptSrc = isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];
const styleSrc = isProduction
  ? ["'self'", "https://fonts.googleapis.com"]
  : ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc,
        styleSrc,
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https://api.openai.com", "https://ipapi.co"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  })
);

app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));

app.set('trust proxy', 1);

/* -------------------------------------------
   COOKIES
------------------------------------------- */

const COOKIE_SECRET =
  process.env.COOKIE_SECRET ||
  'miyomint-secure-cookie-secret-2024-change-in-production';

app.use(cookieParser(COOKIE_SECRET));

/* -------------------------------------------
   CORS (EXPRESS 5 UYUMLU)
------------------------------------------- */

const FRONTEND = process.env.FRONTEND_URL || 'https://quote-form.vercel.app';

const corsOptions = {
  origin: FRONTEND,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-session-id'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions), (req, res) => res.sendStatus(200));

/* -------------------------------------------
   BODY PARSING
------------------------------------------- */

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger to diagnose host/method issues (e.g., 405)
app.use((req, res, next) => {
  console.info('[request]', {
    method: req.method,
    url: req.originalUrl,
    host: req.headers.host,
    origin: req.headers.origin,
    referer: req.headers.referer,
    ip: req.ip,
  });
  next();
});

app.use(async (req, res, next) => {
  if (skipAccessLogs || !accessLogsReady) {
    if (!accessLogNoticePrinted) {
      console.warn('[access_logs] Disabled (env flag or initialization failure).');
      accessLogNoticePrinted = true;
    }
    return next();
  }

  const sessionCookie = req.cookies?.[ACCESS_LOG_COOKIE];
  const sessionId = sessionCookie || crypto.randomUUID();

  if (!sessionCookie) {
    res.cookie(ACCESS_LOG_COOKIE, sessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_LOG_COOKIE_MAX_AGE,
    });
  }

  const userIp = getClientIP(req);
  const userAgent = req.get('User-Agent') || '';
  const referer = req.get('referer') || null;
  const uaDetails = parseUserAgent(userAgent);
  const geoInfo = await getGeoFromIP(userIp);
  const metaPayload = {
    query: cloneForMeta(req.query),
    params: cloneForMeta(req.params),
    originalUrl: req.originalUrl,
    hostname: req.hostname,
  };

  const accessPayload = {
    sessionId,
    userIp,
    userAgent,
    browser: normalizeTextField(uaDetails.browser),
    deviceType: uaDetails.deviceType || 'desktop',
    deviceBrand: normalizeTextField(uaDetails.device),
    deviceModel: normalizeTextField(uaDetails.device),
    country: normalizeTextField(geoInfo?.country),
    city: normalizeTextField(geoInfo?.city),
    path: req.path,
    method: req.method,
    referer: normalizeTextField(referer),
    meta: metaPayload,
  };

  try {
    const [existing] = await db
      .select({ id: accessLogs.id })
      .from(accessLogs)
      .where(eq(accessLogs.sessionId, sessionId))
      .orderBy(desc(accessLogs.enteredAt))
      .limit(1);

    if (existing) {
      await db.update(accessLogs).set(accessPayload).where(eq(accessLogs.id, existing.id));
    } else {
      await db.insert(accessLogs).values(accessPayload);
    }
  } catch (error) {
    console.error('Access log middleware failed:', error);
  }

  const startTime = Date.now();
  res.once('finish', () => {
    const latencyMs = Date.now() - startTime;
    void db
      .update(accessLogs)
      .set({
        leftAt: new Date(),
        statusCode: res.statusCode,
        latencyMs,
      })
      .where(eq(accessLogs.sessionId, sessionId))
      .catch((error) => {
        console.error('Failed to update access log exit time:', error);
      });
  });

  return next();
});

/* -------------------------------------------
   RATE LIMITERS
------------------------------------------- */

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, try later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  skip: (req) => req.path === '/health',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many form submissions.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

const uploadLimiter = rateLimit({
  // Relaxed: allow plenty of photo uploads during a session
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // effectively open for normal usage
  message: { error: 'Too many uploads.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

app.use('/api/', generalLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/admin/webhooks', adminWebhooksRouter);
app.use('/api/admin/dashboard', adminDashboard);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/automations', automationRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', chatRoutes);
app.use('/api', uploadLimiter, uploadRoutes);

/* -------------------------------------------
   STATIC UPLOADS
------------------------------------------- */

app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self'"
    );
    res.setHeader(
      'Cache-Control',
      'public, max-age=31536000, immutable'
    );
    next();
  },
  express.static(join(__dirname, '../uploads'), {
    setHeaders: (res, path) => {
      const ext = path.split('.').pop()?.toLowerCase();
      const mimeTypes = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        heic: 'image/heic',
      };
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
    },
  })
);

/* -------------------------------------------
   HELPER FUNCTIONS
------------------------------------------- */

function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .substring(0, 1000);
}

function validateEmail(email) {
  const r = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return r.test(email) && email.length <= 254;
}

function cloneForMeta(value) {
  try {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
}

function normalizeTextField(value) {
  if (typeof value !== 'string') {
    return value ?? null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (['unknown', 'local', 'localhost', 'nil'].includes(lowered)) {
    return null;
  }
  return trimmed;
}

function validatePhone(phone) {
  return /^[\d\s\-\+\(\)]{7,20}$/.test(phone);
}

function validateZipCode(zip) {
  return /^[a-zA-Z0-9\s\-]{3,15}$/.test(zip);
}

async function ensureAccessLogSchema({ forceSync = false } = {}) {
  if (!forceSync && skipAccessLogs) {
    accessLogsReady = false;
    return;
  }

  if (bypassAccessLogSchemaCheck) {
    console.info('[access_logs] Schema check bypassed by env flag.');
    return;
  }

  const checkExists = async () => {
    const existsResult = await db.execute(
      sql`SELECT to_regclass('public.access_logs') AS tbl`
    );
    return (
      existsResult?.rows?.[0]?.tbl ||
      existsResult?.rows?.[0]?.to_regclass ||
      null
    );
  };

  const permissionHint = (message = '') => {
    if (
      /permission denied/i.test(message) ||
      /must be owner/i.test(message) ||
      /must have/i.test(message)
    ) {
      console.error(
        '[access_logs] Permission issue: DB user may lack CREATE/USAGE on schema public.'
      );
    }
  };

  try {
    const existingName = await checkExists();
    if (existingName) {
      console.info(
        `[access_logs] Table exists (${existingName}); skipping creation.`
      );
      return;
    }

    for (const statement of ACCESS_LOG_SCHEMA_STEPS) {
      await db.execute(statement);
    }
    console.info('[access_logs] Table created and indexes ready.');
  } catch (error) {
    permissionHint(error?.message);
    console.warn(
      '[access_logs] Schema sync failed; disabling access log writes. Error:',
      error?.message || error
    );
    skipAccessLogs = true;
    accessLogsReady = false;
  }
}

/* -------------------------------------------
   PARTNER ENCRYPTION HELPERS
------------------------------------------- */

function getPartnerEncryptionKey() {
  const key = process.env.COOKIE_SECRET || process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!key) return 'miyomint-dev-only-key';
  return key;
}

function decryptPartnerSecret(encryptedData) {
  try {
    const [ivHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !encrypted) return null;

    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(
      getPartnerEncryptionKey(),
      'webhook-salt',
      32
    );
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      key,
      iv
    );

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}
/* --------------------------------------------------------
   PARTNER DISTRIBUTION ENGINE
--------------------------------------------------------- */

async function distributeToPartners(submission) {
  try {
    const { sql: sqlTag } = await import('drizzle-orm');

    const partnersResult = await db.execute(
      sqlTag`SELECT * FROM partner_apis WHERE is_active = true`
    );

    const partners = partnersResult.rows || [];
    if (partners.length === 0) return;

    for (const partner of partners) {
      const serviceTypes = partner.service_types || [];

      if (serviceTypes.length > 0 && !serviceTypes.includes(submission.serviceType)) {
        continue;
      }

      try {
        await db.execute(sqlTag`
          INSERT INTO partner_distributions
            (submission_id, partner_api_id, status, customer_name, customer_email,
             service_type, started_at)
          VALUES (
            ${submission.id},
            ${partner.id},
            'pending',
            ${submission.customerName || submission.name},
            ${submission.email},
            ${submission.serviceType},
            CURRENT_TIMESTAMP
          )
        `);

        const payload = {
          source: 'MIYOMINT',
          timestamp: new Date().toISOString(),
          submission: {
            id: submission.id,
            serviceType: submission.serviceType,
            zipCode: submission.zipCode,
            name: submission.customerName || submission.name,
            email: submission.email,
            phone: submission.phone,
            answers: submission.answers,
            city: submission.city,
            region: submission.region,
            country: submission.country,
          },
        };

        const authConfig =
          typeof partner.auth_config === 'string'
            ? JSON.parse(partner.auth_config)
            : partner.auth_config || {};

        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'MIYOMINT-Partner-Integration/1.0',
          ...(typeof partner.headers === 'string'
            ? JSON.parse(partner.headers)
            : partner.headers || {}),
        };

        if (partner.auth_method === 'api_key' && authConfig.apiKey) {
          const key = decryptPartnerSecret(authConfig.apiKey);
          if (key) headers['X-API-Key'] = key;
        } else if (partner.auth_method === 'bearer' && authConfig.bearerToken) {
          const token = decryptPartnerSecret(authConfig.bearerToken);
          if (token) headers['Authorization'] = `Bearer ${token}`;
        } else if (partner.auth_method === 'basic' && authConfig.username && authConfig.password) {
          const pass = decryptPartnerSecret(authConfig.password);
          if (pass) {
            const creds = Buffer.from(`${authConfig.username}:${pass}`).toString('base64');
            headers['Authorization'] = `Basic ${creds}`;
          }
        } else if (
          partner.auth_method === 'custom_header' &&
          authConfig.headerName &&
          authConfig.headerValue
        ) {
          const value = decryptPartnerSecret(authConfig.headerValue);
          if (value) headers[authConfig.headerName] = value;
        }

        const startTime = Date.now();

        const response = await fetch(partner.endpoint_url, {
          method: partner.http_method || 'POST',
          headers,
          body: partner.http_method !== 'GET' ? JSON.stringify(payload) : undefined,
          signal: AbortSignal.timeout(partner.timeout_ms || 10000),
        });

        const latency = Date.now() - startTime;

        let responseText = '';
        try {
          responseText = await response.text();
        } catch {}

        const status = response.ok ? 'success' : 'failed';
        const respBody = responseText.substring(0, 2000);

        await db.execute(sqlTag`
          UPDATE partner_distributions
          SET status = ${status},
              response_status = ${response.status},
              response_body = ${respBody},
              latency_ms = ${latency},
              completed_at = CURRENT_TIMESTAMP,
              attempt_count = 1
          WHERE submission_id = ${submission.id}
            AND partner_api_id = ${partner.id}
            AND status = 'pending'
        `);

        if (response.ok) {
          await db.execute(
            sqlTag`UPDATE partner_apis 
                   SET success_count = success_count + 1, last_success_at = CURRENT_TIMESTAMP
                   WHERE id = ${partner.id}`
          );
        } else {
          await db.execute(
            sqlTag`UPDATE partner_apis 
                   SET failure_count = failure_count + 1, last_failure_at = CURRENT_TIMESTAMP
                   WHERE id = ${partner.id}`
          );
        }

        console.log(`[Partner Distribution] ${partner.name}: ${status} (${latency}ms)`);

      } catch (fetchError) {
        console.error(`[Partner Distribution] ${partner.name} error:`, fetchError.message);

        await db.execute(sqlTag`
          UPDATE partner_distributions
          SET status = 'failed',
              error_message = ${fetchError.message},
              completed_at = CURRENT_TIMESTAMP,
              attempt_count = 1
          WHERE submission_id = ${submission.id}
            AND partner_api_id = ${partner.id}
            AND status = 'pending'
        `);

        await db.execute(
          sqlTag`UPDATE partner_apis 
                 SET failure_count = failure_count + 1, last_failure_at = CURRENT_TIMESTAMP
                 WHERE id = ${partner.id}`
        );
      }
    }
  } catch (error) {
    console.error('[Partner Distribution] Main error:', error.message);
  }
}

/* --------------------------------------------------------
   MAIN SUBMIT ROUTE
--------------------------------------------------------- */
app.post('/api/draft', async (req, res) => {
  try {
    const {
      draftId,
      serviceType,
      zipCode,
      responses,
      currentStep,
      progress,
      meta,
      email,
      phone,
    } = req.body || {};

    if (!draftId) {
      return res.status(400).json({ error: 'draftId is required' });
    }

    const sanitizedProgress = Number.isFinite(Number(progress)) ? Number(progress) : 0;
    const sanitizedStep = Number.isFinite(Number(currentStep)) ? Number(currentStep) : 0;

    await db.execute(sql`
      INSERT INTO partial_forms
        (draft_id, service_type, zip_code, email, phone, responses, progress, current_step, meta, last_saved_at, created_at)
      VALUES
        (${draftId}, ${serviceType || null}, ${zipCode || null}, ${email || null}, ${phone || null},
         ${JSON.stringify(responses || {})}, ${sanitizedProgress}, ${sanitizedStep}, ${JSON.stringify(meta || {})},
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (draft_id)
      DO UPDATE SET
        service_type = EXCLUDED.service_type,
        zip_code = EXCLUDED.zip_code,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        responses = EXCLUDED.responses,
        progress = EXCLUDED.progress,
        current_step = EXCLUDED.current_step,
        meta = EXCLUDED.meta,
        last_saved_at = CURRENT_TIMESTAMP
    `);

    res.json({ success: true });
  } catch (error) {
    console.error('Draft save error:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

app.delete('/api/draft', async (req, res) => {
  try {
    const { draftId } = req.body || {};
    if (!draftId) {
      return res.status(400).json({ error: 'draftId is required' });
    }
    await db.execute(sql`DELETE FROM partial_forms WHERE draft_id = ${draftId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Draft delete error:', error);
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

app.post('/api/incomplete', async (req, res) => {
  try {
    const {
      draftId,
      serviceType,
      email,
      phone,
      responses,
      progress,
      meta,
      createdBy,
    } = req.body || {};

    if (!draftId) {
      return res.status(400).json({ error: 'draftId is required' });
    }

    const clientIP = getClientIP(req);
    const userAgent = req.headers['user-agent']?.toString().substring(0, 500) || null;
    const normalizedResponses = typeof responses === 'object' && responses ? responses : {};
    const normalizedMeta = typeof meta === 'object' && meta ? meta : {};
    const sanitizedProgress = Number.isFinite(Number(progress)) ? Math.min(100, Math.max(0, Number(progress))) : 0;

    await db.execute(sql`
      INSERT INTO incomplete_forms
        (draft_id, created_by, service_type, email, phone, responses, progress, meta, user_agent, ip_address, created_at, last_seen_at)
      VALUES
        (${draftId},
         ${sanitizeInput(createdBy) || null},
         ${serviceType || null},
         ${email || null},
         ${phone || null},
         ${JSON.stringify(normalizedResponses)},
         ${sanitizedProgress},
         ${JSON.stringify(normalizedMeta)},
         ${userAgent},
         ${clientIP},
         CURRENT_TIMESTAMP,
         CURRENT_TIMESTAMP)
      ON CONFLICT (draft_id)
      DO UPDATE SET
        service_type = EXCLUDED.service_type,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        responses = EXCLUDED.responses,
        progress = EXCLUDED.progress,
        meta = EXCLUDED.meta,
        user_agent = EXCLUDED.user_agent,
        ip_address = EXCLUDED.ip_address,
        last_seen_at = EXCLUDED.last_seen_at
    `);

    res.json({ success: true });
  } catch (error) {
    console.error('Incomplete form save error:', error);
    res.status(500).json({ error: 'Failed to record incomplete form' });
  }
});

app.post('/api/submit', submitLimiter, async (req, res) => {
  try {
    let {
      draftId,
      serviceType,
      zipCode,
      name,
      email,
      phone,
      answers,
      photoUrls,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      sessionDuration,
      pageViews,
    } = req.body;

    serviceType = sanitizeInput(serviceType);
    zipCode = sanitizeInput(zipCode);
    name = sanitizeInput(name);
    email = sanitizeInput(email);
    phone = sanitizeInput(phone);

    if (!serviceType || !zipCode || !name || !email || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!validateEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
    if (!validatePhone(phone)) return res.status(400).json({ error: 'Invalid phone format' });
    if (!validateZipCode(zipCode)) return res.status(400).json({ error: 'Invalid ZIP code format' });

    if (!Array.isArray(photoUrls)) photoUrls = [];

    photoUrls = photoUrls
      .filter((url) => typeof url === 'string' && (url.startsWith('/uploads/') || url.startsWith('https://')))
      .slice(0, 6);

    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'] || '';
    const uaInfo = parseUserAgent(userAgent);
    const geoInfo = await getGeoFromIP(ipAddress);

    const meta = {
      email,
      phone,
      country: geoInfo.country,
      country_code: geoInfo.country_code,
      city: geoInfo.city,
      region: geoInfo.region,
      timezone: geoInfo.timezone,
      browser_version: uaInfo.browserVersion,
      os_version: uaInfo.osVersion,
      device_type: uaInfo.deviceType,
      referrer: sanitizeInput(referrer || req.headers['referer'] || null),
      utm_source: sanitizeInput(utmSource),
      utm_medium: sanitizeInput(utmMedium),
      utm_campaign: sanitizeInput(utmCampaign),
      session_duration: sessionDuration || null,
      page_views: pageViews || null,
    };

    const answersPayload = typeof answers === 'string' ? JSON.parse(answers) : answers || {};

    const normalized = {
      serviceType,
      zipCode,
      customerName: name,
      answers: answersPayload,
      photos: photoUrls,
      status: 'new',
      ipAddress,
      userAgent,
      browser: uaInfo.browser,
      browserVersion: uaInfo.browserVersion || null,
      os: uaInfo.os,
      osVersion: uaInfo.osVersion || null,
      device: uaInfo.device,
      deviceType: uaInfo.deviceType || null,
      meta: {
        ...meta,
        os: uaInfo.os,
        browser: uaInfo.browser,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [submission] = await db
      .insert(submissions)
      .values({
        serviceType: normalized.serviceType,
        zipCode: normalized.zipCode,
        customerName: normalized.customerName,
        answers: normalized.answers,
        photos: normalized.photos || [],
        status: normalized.status,

        ipAddress: normalized.ipAddress,
        userAgent: normalized.userAgent,
        browser: uaInfo.browser,
        browserVersion: uaInfo.browserVersion,
        os: uaInfo.osVersion,
        osVersion: uaInfo.osVersion,
        device: uaInfo.device,
        deviceType: uaInfo.deviceType,

        name: normalized.customerName,
        email: meta.email,
        phone: meta.phone,
        country: geoInfo.country,
        countryCode: geoInfo.country_code,
        city: geoInfo.city,
        region: geoInfo.region,
        timezone: geoInfo.timezone,

        referrer: meta.referrer,
        utmSource: meta.utm_source,
        utmMedium: meta.utm_medium,
        utmCampaign: meta.utm_campaign,
        sessionDuration: meta.session_duration,
        pageViews: meta.page_views,

        meta: meta,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await logSubmission({
      submission_id: submission.id,
      customer_name: normalized.customerName,
      service_type: normalized.serviceType,
      zip_code: normalized.zipCode,
      status: normalized.status,
      answers: normalized.answers,
      photos: normalized.photos,
      device: normalized.device,
      browser: normalized.browser,
      ip_address: normalized.ipAddress,
      user_agent: normalized.userAgent,
      meta: normalized.meta,
      created_at: normalized.createdAt,
    });

    await logActivity({
      admin_username: null,
      event_type: 'submission_created',
      payload: { submissionId: submission.id, serviceType: normalized.serviceType },
      ip_address: normalized.ipAddress,
      user_agent: normalized.userAgent,
      result: 'success',
      created_at: normalized.createdAt,
    });

    distributeToPartners({
      id: submission.id,
      serviceType: normalized.serviceType,
      zipCode: normalized.zipCode,
      name: normalized.customerName,
      email,
      phone,
      city: normalized.meta.city,
      region: normalized.meta.region,
      country: normalized.meta.country,
      answers: normalized.answers,
    });

    if (draftId) {
      try {
        await db.execute(sql`DELETE FROM partial_forms WHERE draft_id = ${draftId}`);
      } catch (deleteError) {
        console.warn('Failed to delete draft record:', deleteError);
      }
    }
    // Trigger automations (non-blocking)
    void runAutomations({
      id: submission.id,
      serviceType: normalized.serviceType,
      zipCode: normalized.zipCode,
      customerName: normalized.customerName,
      email,
      phone,
      country: normalized.meta.country,
      region: normalized.meta.region,
      city: normalized.meta.city,
      createdAt: normalized.createdAt,
      status: normalized.status,
    });
    return res.json({ success: true, submissionId: submission.id });
  } catch (error) {
    console.error('Insert error:', error);
    return res.status(500).json({ error: 'Failed to save submission' });
  }
});

/* --------------------------------------------------------
   HEALTH CHECK
--------------------------------------------------------- */

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

/* --------------------------------------------------------
   GLOBAL ERROR HANDLER
--------------------------------------------------------- */

app.use((err, req, res, next) => {
  console.error('Server error:', err.message);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  return res.status(500).json({ error: 'Internal server error' });
});

/* --------------------------------------------------------
   404 HANDLER
--------------------------------------------------------- */

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/* --------------------------------------------------------
   START SERVER
--------------------------------------------------------- */

function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}

async function bootstrapServer() {
  if (skipAccessLogs) {
    accessLogsReady = false;
    console.warn('[access_logs] Disabled via environment flags.');
  } else if (bypassAccessLogSchemaCheck) {
    console.warn('[access_logs] Schema check bypassed; writes may fail if table is missing.');
  } else {
    try {
      await ensureAccessLogSchema({ forceSync: true });
    } catch (error) {
      accessLogsReady = false;
      console.error(
        '[access_logs] Initialization failed; disabling access log writes.',
        error?.message || error,
      );
    }
  }
  startServer();
}

bootstrapServer().catch((error) => {
  console.error('Server bootstrap failed:', error);
  process.exit(1);
});
