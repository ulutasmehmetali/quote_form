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
import adminRoutes from './adminRoutes.js';

import { db } from './db.js';
import { submissions } from '../shared/schema.js';

import { parseUserAgent, getGeoFromIP, getClientIP } from './utils/geoip.js';
import crypto from 'crypto';
import { logSubmission, logActivity } from './helpers/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

/* -------------------------------------------
   HELMET / SECURITY
------------------------------------------- */

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
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
   CORS (FIXED)
------------------------------------------- */

const frontendOrigin =
  process.env.FRONTEND_URL || 'https://your-domain.com';

const corsOptions = {
  origin: isProduction ? [frontendOrigin] : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Session-Id',
    'X-CSRF-Token',
    'X-Vercel-Protection-Bypass',
    'x-vercel-protection-bypass',
  ],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* LOG CORS */
app.use((req, res, next) => {
  console.log('cors check', {
    origin: req.headers.origin,
    allowedOrigins: corsOptions.origin,
    method: req.method,
    path: req.path,
  });
  next();
});

app.use((req, res, next) => {
  res.on('finish', () => {
    console.log('cors response headers', {
      originHeader: res.getHeader('Access-Control-Allow-Origin'),
      requestMethod: req.method,
      status: res.statusCode,
    });
  });
  next();
});

/* -------------------------------------------
   BODY PARSING
------------------------------------------- */

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Too many uploads.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

app.use('/api/', generalLimiter);
app.use('/api/admin/login', authLimiter);

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

function validatePhone(phone) {
  return /^[\d\s\-\+\(\)]{7,20}$/.test(phone);
}

function validateZipCode(zip) {
  return /^[a-zA-Z0-9\s\-]{3,15}$/.test(zip);
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

app.post('/api/submit', submitLimiter, async (req, res) => {
  try {
    let {
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
    const userAgent = req.headers['user-agent'] || null;
    const uaInfo = parseUserAgent(userAgent);
    const geoInfo = await getGeoFromIP(ipAddress);

    const meta = {
      email,
      phone,
      country: geoInfo.country,
      country_code: geoInfo.countryCode,
      city: geoInfo.city,
      region: geoInfo.region,
      timezone: geoInfo.timezone,
      browser_version: uaInfo.browserVersion,
      os_version: uaInfo.osVersion,
      device_type: uaInfo.deviceType,
      referrer: sanitizeInput(referrer || req.headers['referer'] || null),
      utm_source: sanitizeInput(utmSource || null),
      utm_medium: sanitizeInput(utmMedium || null),
      utm_campaign: sanitizeInput(utmCampaign || null),
      session_duration: typeof sessionDuration === 'number' ? sessionDuration : null,
      page_views: typeof pageViews === 'number' ? pageViews : null,
    };

    const normalized = {
      serviceType,
      zipCode,
      customerName: name,
      answers: typeof answers === 'string' ? JSON.parse(answers) : answers || {},
      photos: photoUrls,
      status: 'new',
      ipAddress,
      userAgent,
      browser: uaInfo.browser,
      device: uaInfo.device,
      meta,
    };

    const [submission] = await db.insert(submissions).values(normalized).returning();

    const submissionMeta = submission?.meta ?? normalized.meta;

    const getField = (obj, camel, snake, fallback) =>
      obj?.[camel] ?? obj?.[snake] ?? fallback;

    distributeToPartners({
      ...submission,
      name: getField(submission, 'customerName', 'customer_name', normalized.customerName),
      email: submissionMeta.email,
      phone: submissionMeta.phone,
      region: submissionMeta.region,
      city: submissionMeta.city,
      country: submissionMeta.country,
    }).catch((err) => console.error('[Partner Distribution] Async error:', err));

    await logSubmission({
      submission_id: submission.id,
      customer_name: submission.customerName,
      service_type: submission.serviceType,
      zip_code: submission.zipCode,
      status: submission.status,
      answers: submission.answers,
      photos: submission.photos,
      device: submission.device,
      browser: submission.browser,
      ip_address: submission.ipAddress,
      user_agent: submission.userAgent,
      meta: submissionMeta,
      created_at: submission.createdAt,
    }).catch((err) => console.error('Supabase log failed:', err));

    await logActivity({
      admin_username: null,
      event_type: 'submission_created',
      payload: { submissionId: submission.id, serviceType: submission.serviceType },
      ip_address: submission.ipAddress,
      user_agent: submission.userAgent,
      result: 'success',
      created_at: submission.createdAt,
    }).catch((err) => console.error('Activity log failed:', err));

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

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Backend server running on port ${PORT}`);
});
