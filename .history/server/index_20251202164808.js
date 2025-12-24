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
import { submissions, adminUsers } from '../shared/schema.js';
import { parseUserAgent, getGeoFromIP, getClientIP } from './utils/geoip.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { logSubmission, logActivity } from './helpers/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
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
}));

app.use(helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true,
  preload: true,
}));

app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));

app.set('trust proxy', 1);

const COOKIE_SECRET = process.env.COOKIE_SECRET || 'miyomint-secure-cookie-secret-2024-change-in-production';
app.use(cookieParser(COOKIE_SECRET));

const frontendOrigin = process.env.FRONTEND_URL || 'https://your-domain.com';
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
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || frontendOrigin);
  res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(','));
  res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
  next();
});
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || frontendOrigin);
  res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(','));
  res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

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

console.log('cors origin', corsOptions.origin);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  skip: (req) => req.path === '/health',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  skipSuccessfulRequests: false,
});

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many form submissions, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Too many file uploads, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

app.use('/api/', generalLimiter);
app.use('/api/admin/login', authLimiter);

app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
}, express.static(join(__dirname, '../uploads'), {
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
  }
}));

app.use('/api/upload', uploadLimiter);
app.use('/api', uploadRoutes);
app.use('/api', suggestRoutes);
app.use('/api/admin', adminRoutes);

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
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

function validatePhone(phone) {
  const phoneRegex = /^[\d\s\-\+\(\)]{7,20}$/;
  return phoneRegex.test(phone);
}

function validateZipCode(zip) {
  const zipRegex = /^[a-zA-Z0-9\s\-]{3,15}$/;
  return zipRegex.test(zip);
}

function getPartnerEncryptionKey() {
  const key = process.env.COOKIE_SECRET || process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Encryption key required in production');
    }
    return 'miyomint-dev-only-key-' + (process.env.REPL_ID || 'local');
  }
  return key;
}

function decryptPartnerSecret(encryptedData) {
  try {
    const [ivHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !encrypted) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(getPartnerEncryptionKey(), 'webhook-salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return null;
  }
}

async function distributeToPartners(submission) {
  try {
    const { sql: sqlTag } = await import('drizzle-orm');
    
    const partnersResult = await db.execute(sqlTag`SELECT * FROM partner_apis WHERE is_active = true`);
    
    const partners = partnersResult.rows || [];
    if (partners.length === 0) return;
    
    for (const partner of partners) {
      const serviceTypes = partner.service_types || [];
      if (serviceTypes.length > 0 && !serviceTypes.includes(submission.serviceType)) {
        continue;
      }
      
      try {
        await db.execute(sqlTag`
          INSERT INTO partner_distributions (submission_id, partner_api_id, status, customer_name, customer_email, service_type, started_at)
          VALUES (${submission.id}, ${partner.id}, 'pending', ${submission.name}, ${submission.email}, ${submission.serviceType}, CURRENT_TIMESTAMP)
        `);
        
        const payload = {
          source: 'MIYOMINT',
          timestamp: new Date().toISOString(),
          submission: {
            id: submission.id,
            serviceType: submission.serviceType,
            zipCode: submission.zipCode,
            name: submission.name,
            email: submission.email,
            phone: submission.phone,
            answers: submission.answers,
            city: submission.city,
            region: submission.region,
            country: submission.country,
          }
        };
        
        const authConfig = typeof partner.auth_config === 'string' 
          ? JSON.parse(partner.auth_config) 
          : partner.auth_config || {};
        
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'MIYOMINT-Partner-Integration/1.0',
          ...(typeof partner.headers === 'string' ? JSON.parse(partner.headers) : partner.headers || {}),
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
        } else if (partner.auth_method === 'custom_header' && authConfig.headerName && authConfig.headerValue) {
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
        try { responseText = await response.text(); } catch {}
        
        const status = response.ok ? 'success' : 'failed';
        const respBody = responseText.substring(0, 2000);
        
        await db.execute(sqlTag`
          UPDATE partner_distributions 
          SET status = ${status}, response_status = ${response.status}, response_body = ${respBody}, latency_ms = ${latency}, 
              completed_at = CURRENT_TIMESTAMP, attempt_count = 1
          WHERE submission_id = ${submission.id} AND partner_api_id = ${partner.id} AND status = 'pending'
        `);
        
        if (response.ok) {
          await db.execute(sqlTag`UPDATE partner_apis SET success_count = success_count + 1, last_success_at = CURRENT_TIMESTAMP WHERE id = ${partner.id}`);
        } else {
          await db.execute(sqlTag`UPDATE partner_apis SET failure_count = failure_count + 1, last_failure_at = CURRENT_TIMESTAMP WHERE id = ${partner.id}`);
        }
        
        console.log(`[Partner Distribution] ${partner.name}: ${status} (${latency}ms)`);
      } catch (fetchError) {
        console.error(`[Partner Distribution] ${partner.name} error:`, fetchError.message);
        
        await db.execute(sqlTag`
          UPDATE partner_distributions 
          SET status = 'failed', error_message = ${fetchError.message}, completed_at = CURRENT_TIMESTAMP, attempt_count = 1
          WHERE submission_id = ${submission.id} AND partner_api_id = ${partner.id} AND status = 'pending'
        `);
        
        await db.execute(sqlTag`UPDATE partner_apis SET failure_count = failure_count + 1, last_failure_at = CURRENT_TIMESTAMP WHERE id = ${partner.id}`);
      }
    }
  } catch (error) {
    console.error('[Partner Distribution] Main error:', error.message);
  }
}

app.post('/api/submit', submitLimiter, async (req, res) => {
  try {
    let { serviceType, zipCode, name, email, phone, answers, photoUrls, 
            referrer, utmSource, utmMedium, utmCampaign, sessionDuration, pageViews } = req.body;
    
    serviceType = sanitizeInput(serviceType);
    zipCode = sanitizeInput(zipCode);
    name = sanitizeInput(name);
    email = sanitizeInput(email);
    phone = sanitizeInput(phone);
    
    if (!serviceType || !zipCode || !name || !email || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }
    
    if (!validateZipCode(zipCode)) {
      return res.status(400).json({ error: 'Invalid ZIP code format' });
    }
    
    if (photoUrls && Array.isArray(photoUrls)) {
      photoUrls = photoUrls.filter(url => 
        typeof url === 'string' && 
        (url.startsWith('/uploads/') || url.startsWith('https://'))
      ).slice(0, 6);
    }
    
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

    const payload = {
      serviceType: serviceType,
      zipCode: zipCode,
      customerName: name,
      answers: answers || {},
      photos: photoUrls || [],
      status: 'new',
      ipAddress: ipAddress,
      userAgent: userAgent,
      browser: uaInfo.browser,
      device: uaInfo.device,
      meta,
    };

    console.log('submission payload raw', payload);
    console.log('payload types', {
      serviceType: typeof payload.serviceType,
      zipCode: typeof payload.zipCode,
      customerName: typeof payload.customerName,
      answers: Object.prototype.toString.call(payload.answers),
      photos: Object.prototype.toString.call(payload.photos),
      meta: Object.prototype.toString.call(payload.meta),
    });

    const normalized = {
      serviceType: payload.serviceType,
      zipCode: payload.zipCode,
      customerName: payload.customerName,
      answers:
        typeof payload.answers === 'string'
          ? JSON.parse(payload.answers)
          : payload.answers,
      photos:
        Array.isArray(payload.photos) ? payload.photos : JSON.parse(payload.photos || '[]'),
      status: payload.status || 'new',
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
      browser: payload.browser,
      device: payload.device,
      meta:
        typeof payload.meta === 'string' ? JSON.parse(payload.meta) : payload.meta,
    };

    console.log('submission payload normalized', normalized);

    const [submission] = await db.insert(submissions).values(normalized).returning();

    const submissionMeta = submission?.meta ?? normalized.meta ?? {};
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
    }).catch(err => {
      console.error('[Partner Distribution] Async error:', err?.message ?? err);
    });

    await logSubmission({
      submission_id: getField(submission, 'id', 'id', null),
      customer_name: getField(submission, 'customerName', 'customer_name', normalized.customerName),
      service_type: getField(submission, 'serviceType', 'service_type', normalized.serviceType),
      zip_code: getField(submission, 'zipCode', 'zip_code', normalized.zipCode),
      status: getField(submission, 'status', 'status', normalized.status),
      answers: getField(submission, 'answers', 'answers', normalized.answers),
      photos: getField(submission, 'photos', 'photos', normalized.photos),
      device: getField(submission, 'device', 'device', normalized.device),
      browser: getField(submission, 'browser', 'browser', normalized.browser),
      ip_address: getField(submission, 'ipAddress', 'ip_address', normalized.ipAddress),
      user_agent: getField(submission, 'userAgent', 'user_agent', normalized.userAgent),
      meta: submission?.meta ?? normalized.meta,
      created_at: getField(submission, 'createdAt', 'created_at', new Date().toISOString()),
    }).catch((err) => {
      console.error('Supabase submission log failed:', err?.message ?? err);
    });

    await logActivity({
      admin_username: null,
      event_type: 'submission_created',
      payload: {
        submissionId: submission.id,
        serviceType: submission.serviceType,
      },
      ip_address: submission.ipAddress,
      user_agent: submission.userAgent,
      result: 'success',
      created_at: submission.createdAt,
    }).catch((err) => {
      console.error('Supabase activity log failed:', err.message);
    });

    res.json({ success: true, submissionId: submission.id });
  } catch (error) {
    console.error('Insert error full', error);
    console.error('Insert error message', error?.message);
    console.error('Insert error detail', error?.detail);
    console.error('Insert error code', error?.code);
    console.error('Insert error stack', error?.stack);
    console.error('Insert error normalized payload', normalized);
    res.status(500).json({ error: 'Failed to save submission' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

async function initDefaultAdmin() {
  console.log('Default admin creation is disabled.');
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Backend server running on port ${PORT}`);
  await initDefaultAdmin();
});
