import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import geoip from 'geoip-lite';
import { db } from './db.ts';
import { submissions, adminUsers, submissionNotes, activityLogs } from '../shared/schema.ts';
import { eq, desc, sql, count, gte, and, like, or, asc } from 'drizzle-orm';
import { getClientIP } from './utils/geoip.js';
import { getGeoFromIP } from './helpers/geo.js';
import { supabase } from './helpers/supabase.js';

function parseNumber(value) {
  if (value === undefined || value === null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchSupabaseFallbackStats() {
  try {
    const [
      { data: totalRows },
      { data: todayRows },
      { data: weekRows },
      { data: monthRows },
      { data: statusData },
      { data: countryData },
      { data: browserData },
      { data: deviceData },
      { data: osData },
      { data: dailyTrendData },
      { data: hourlyData },
      { data: weekdayData },
    ] = await Promise.all([
      supabase.rpc('count_submissions'),
      supabase.rpc('count_submissions_today'),
      supabase.rpc('count_submissions_week'),
      supabase.rpc('count_submissions_month'),
      supabase.rpc('stats_by_status'),
      supabase.rpc('stats_by_country'),
      supabase.rpc('stats_by_browser'),
      supabase.rpc('stats_by_device'),
      supabase.rpc('stats_by_os'),
      supabase.rpc('stats_daily_trend'),
      supabase.rpc('stats_hourly'),
      supabase.rpc('stats_weekday'),
    ]);

    const overview = {
      total: parseNumber(totalRows?.count),
      today: parseNumber(todayRows?.count),
      thisWeek: parseNumber(weekRows?.count),
      thisMonth: parseNumber(monthRows?.count),
    };

    const reduceToObject = (items = [], keyField = 'status') =>
      (items || []).reduce((acc, entry) => {
        if (!entry) return acc;
        const key = entry[keyField];
        if (!key) return acc;
        acc[key] = parseNumber(entry.count);
        return acc;
      }, {});

    const toArray = (items = [], mapper = () => ({})) =>
      (items || [])
        .filter(Boolean)
        .map((entry) => ({
          ...entry,
          count: parseNumber(entry.count),
          ...mapper(entry),
        }));

    const supabaseStats = {
      overview,
      byStatus: reduceToObject(statusData, 'status'),
      byCountry: toArray(countryData, (entry) => ({
        countryCode: entry.country_code || entry.countryCode,
      })),
      byBrowser: toArray(browserData, (entry) => ({ browser: entry.browser })),
      byDeviceType: toArray(deviceData, (entry) => ({
        deviceType: entry.device_type || entry.deviceType || entry.device,
      })),
      byOS: toArray(osData, (entry) => ({ os: entry.os })),
      dailyTrend: Array.isArray(dailyTrendData) ? dailyTrendData.map((entry) => ({
        date: entry?.date,
        count: parseNumber(entry?.count),
      })) : [],
      hourlyActivity: Array.isArray(hourlyData) ? hourlyData.map((entry) => ({
        hour: parseNumber(entry?.hour),
        count: parseNumber(entry?.count),
        avg_session_duration: entry?.avg_session_duration ?? entry?.avgSessionDuration ?? null,
      })) : [],
      weekdayDistribution: Array.isArray(weekdayData) ? weekdayData.map((entry) => ({
        weekday: parseNumber(entry?.weekday),
        count: parseNumber(entry?.count),
      })) : [],
    };

    return supabaseStats;
  } catch (error) {
    console.warn('Supabase fallback error:', error?.message || error);
    return null;
  }
}

const router = express.Router();

const sessions = new Map();
const SESSION_DURATION = 8 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 3;
const failedAttempts = new Map();
const LOCKOUT_DURATION = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const ipCountryCache = new Map();
const regionNameFormatter = new Intl.DisplayNames(['en'], { type: 'region' });

function formatRegionName(code) {
  if (!code) return 'Unknown';
  try {
    const resolved = regionNameFormatter.of(code);
    if (resolved && resolved !== 'Unknown') return resolved;
  } catch {
    // ignore
  }
  return code;
}

async function resolveGeoForIP(ip) {
  if (!ip) return null;
  const offline = geoip.lookup(ip);
  if (offline?.country) {
    return {
      country: formatRegionName(offline.country),
      country_code: offline.country,
    };
  }
  const online = await getGeoFromIP(ip);
  if (online?.country_code && (!online.country || online.country === 'Unknown')) {
    online.country = formatRegionName(online.country_code);
  }
  return online;
}

async function getGeoForIP(ip) {
  if (!ip) return null;
  if (ipCountryCache.has(ip)) {
    return ipCountryCache.get(ip);
  }
  const geo = await resolveGeoForIP(ip);
  if (geo) {
    ipCountryCache.set(ip, geo);
  }
  return geo;
}

function generateSecureSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function generateCSRFToken() {
  return crypto.randomBytes(24).toString('hex');
}

function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/expression\(/gi, '')
    .replace(/url\(/gi, '')
    .replace(/<!--/g, '')
    .replace(/-->/g, '')
    .trim()
    .substring(0, 500);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(sessionId);
    }
  }
}

setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

async function logActivity(action, entityType, entityId, adminUser, req, details = {}) {
  try {
    const safeDetails = Object.keys(details || {}).length ? details : null;
    const payload = {
      action,
      entityType,
      entityId,
      adminId: adminUser?.id,
      adminUsername: adminUser?.username,
      details: safeDetails ? JSON.stringify(safeDetails) : null,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']?.substring(0, 500),
    };

    await db.insert(activityLogs).values(payload);
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
}

function isAccountLocked(ip) {
  const attempts = failedAttempts.get(ip);
  if (!attempts) return false;
  
  if (Date.now() > attempts.lockoutUntil) {
    failedAttempts.delete(ip);
    return false;
  }
  
  return attempts.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(ip) {
  const attempts = failedAttempts.get(ip) || { count: 0, lockoutUntil: 0 };
  attempts.count++;
  
  if (attempts.count >= MAX_FAILED_ATTEMPTS) {
    attempts.lockoutUntil = Date.now() + LOCKOUT_DURATION;
  }
  
  failedAttempts.set(ip, attempts);
}

function clearFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

async function requireAuth(req, res, next) {
  const sessionId = req.cookies?.adminSession || req.headers['x-session-id'];
  const session = sessions.get(sessionId);
  
  if (!session || Date.now() > session.expiresAt) {
    if (session) sessions.delete(sessionId);
    res.clearCookie('adminSession');
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
  
  const clientIP = getClientIP(req);
  if (session.ipAddress !== clientIP) {
    sessions.delete(sessionId);
    res.clearCookie('adminSession');
    logActivity('session_ip_mismatch', 'admin', session.user.id, session.user, req, { 
      originalIP: session.ipAddress, 
      newIP: clientIP 
    });
    return res.status(401).json({ error: 'Session invalid' });
  }
  
  session.lastActivity = Date.now();
  session.expiresAt = Date.now() + SESSION_DURATION;
  
  req.adminUser = session.user;
  req.sessionId = sessionId;
  next();
}

function requireCSRF(req, res, next) {
  if (req.method === 'GET') return next();
  
  const sessionId = req.cookies?.adminSession || req.headers['x-session-id'];
  const session = sessions.get(sessionId);
  const csrfToken = req.headers['x-csrf-token'];
  
  if (!session || session.csrfToken !== csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.adminUser || !allowedRoles.includes(req.adminUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function sanitizeArray(arr, maxLength = 50, itemMaxLength = 100) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(item => typeof item === 'string')
    .slice(0, maxLength)
    .map(item => sanitizeInput(item.substring(0, itemMaxLength)));
}

function validateUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function getWebhookEncryptionKey() {
  const key = process.env.COOKIE_SECRET || process.env.WEBHOOK_ENCRYPTION_KEY;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!key) {
    if (isProduction) {
      console.error('CRITICAL: COOKIE_SECRET or WEBHOOK_ENCRYPTION_KEY must be set in production!');
      throw new Error('Webhook encryption key is required in production. Set COOKIE_SECRET or WEBHOOK_ENCRYPTION_KEY environment variable.');
    }
    console.warn('[DEV] Using development-only webhook encryption key. This is NOT secure for production.');
    return 'miyomint-dev-only-webhook-key-' + (process.env.REPL_ID || 'local');
  }
  return key;
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(getWebhookEncryptionKey(), 'webhook-salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return 'v1:' + iv.toString('hex') + ':' + encrypted;
}

function decryptSecret(encryptedData) {
  try {
    if (!encryptedData) return null;
    
    if (!encryptedData.startsWith('v1:')) {
      return null;
    }
    
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    
    const [, ivHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(getWebhookEncryptionKey(), 'webhook-salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt webhook secret:', error.message);
    return null;
  }
}

function signWebhookPayload(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

router.post('/login', async (req, res) => {
  try {
    const clientIP = getClientIP(req);
    
    if (isAccountLocked(clientIP)) {
      return res.status(429).json({ 
        error: 'Too many failed attempts. Please try again in 15 minutes.' 
      });
    }
    
    let { username, password } = req.body;
    
    username = sanitizeInput(username);
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (username.length > 50 || password.length > 100) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.username, username));
    
    if (!user) {
      recordFailedAttempt(clientIP);
      await logActivity('login_failed', 'admin', null, null, req, { username, reason: 'user_not_found' });
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      recordFailedAttempt(clientIP);
      await logActivity('login_failed', 'admin', user.id, null, req, { username, reason: 'wrong_password' });
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    clearFailedAttempts(clientIP);
    
    let userSessionCount = 0;
    for (const [sid, session] of sessions.entries()) {
      if (session.user.id === user.id) {
        userSessionCount++;
        if (userSessionCount >= MAX_SESSIONS_PER_USER) {
          sessions.delete(sid);
          userSessionCount--;
        }
      }
    }
    
    const sessionId = generateSecureSessionId();
    const csrfToken = generateCSRFToken();
    
    sessions.set(sessionId, {
      user: { id: user.id, username: user.username, role: user.role },
      expiresAt: Date.now() + SESSION_DURATION,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ipAddress: clientIP,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      csrfToken,
    });
    
    await db.update(adminUsers)
      .set({ lastLoginAt: new Date(), lastLoginIp: clientIP })
      .where(eq(adminUsers.id, user.id));
    
    await logActivity('login_success', 'admin', user.id, { id: user.id, username: user.username }, req, {});
    
    res.cookie('adminSession', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: SESSION_DURATION,
      path: '/',
    });

    return res.json({
      success: true,
      sessionId,
      csrfToken,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

router.post('/logout', requireAuth, requireCSRF, async (req, res) => {
  await logActivity('logout', 'admin', req.adminUser.id, req.adminUser, req, {});
  sessions.delete(req.sessionId);
  res.clearCookie('adminSession', { path: '/' });
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  const session = sessions.get(req.sessionId);
  res.json({ 
    user: req.adminUser,
    csrfToken: session?.csrfToken 
  });
});

router.get('/submissions', requireAuth, async (req, res) => {
  let page = 1;
  let limit = 20;
  try {
    let {
      status,
      country,
      serviceType,
      search,
      dateFrom,
      dateTo,
      page: pageQuery = 1,
      limit: limitQuery = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    page = Math.max(1, Math.min(parseInt(pageQuery) || 1, 1000));
    limit = Math.max(1, Math.min(parseInt(limitQuery) || 20, 100));
    const offset = (page - 1) * limit;

    const sortMap = {
      createdAt: submissions.createdAt,
      created_at: submissions.createdAt,
      name: submissions.customerName,
      email: submissions.email,
      serviceType: submissions.serviceType,
      status: submissions.status,
      zipCode: submissions.zipCode,
    };

    const normalizedSortBy = sortMap[sortBy] ? sortBy : 'created_at';
    sortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    search = search ? sanitizeInput(search) : null;

    const conditions = [];

    if (status && status !== 'all') {
      const allowedStatuses = ['new', 'contacted', 'in_progress', 'completed', 'cancelled'];
      if (allowedStatuses.includes(status)) {
        conditions.push(eq(submissions.status, status));
      }
    }
    if (country && country !== 'all' && /^[A-Z]{2}$/.test(country)) {
      conditions.push(eq(submissions.countryCode, country));
    }
    if (serviceType && serviceType !== 'all') {
      conditions.push(eq(submissions.serviceType, sanitizeInput(serviceType)));
    }
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(submissions.createdAt, fromDate));
      }
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (!isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        conditions.push(sql`${submissions.createdAt} <= ${toDate}`);
      }
    }
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(or(
        like(submissions.name, searchPattern),
        like(submissions.email, searchPattern),
        like(submissions.phone, searchPattern),
        like(submissions.zipCode, searchPattern)
      ));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderColumn = sortMap[normalizedSortBy];
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    const submissionSelect = {
      id: submissions.id,
      serviceType: submissions.serviceType,
      zipCode: submissions.zipCode,
      name: submissions.name,
      email: submissions.email,
      phone: submissions.phone,
      answers: submissions.answers,
      photoUrls: submissions.photoUrls,
      status: submissions.status,
      ipAddress: submissions.ipAddress,
      country: submissions.country,
      countryCode: submissions.countryCode,
      city: submissions.city,
      region: submissions.region,
      timezone: submissions.timezone,
      userAgent: submissions.userAgent,
      browser: submissions.browser,
      browserVersion: submissions.browserVersion,
      os: submissions.os,
      osVersion: submissions.osVersion,
      device: submissions.device,
      deviceType: submissions.deviceType,
      referrer: submissions.referrer,
      utmSource: submissions.utmSource,
      utmMedium: submissions.utmMedium,
      utmCampaign: submissions.utmCampaign,
      sessionDuration: submissions.sessionDuration,
      pageViews: submissions.pageViews,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
    };

    let query = db.select(submissionSelect).from(submissions);
    if (whereClause) query = query.where(whereClause);
    const results = await query.orderBy(orderDirection).limit(limit).offset(offset);
    const submissionsList = Array.isArray(results) ? results : [];

    const enrichedSubmissions = [];
    for (const submission of submissionsList) {
      if (submission.country && submission.country !== 'Unknown') {
        enrichedSubmissions.push(submission);
        continue;
      }

      const ip = submission.ipAddress;
      if (!ip) {
        enrichedSubmissions.push(submission);
        continue;
      }

      const geo = await getGeoForIP(ip);
      if (geo?.country && geo.country !== 'Unknown') {
        submission.country = geo.country;
        submission.countryCode = geo.country_code;
      }
      enrichedSubmissions.push(submission);
    }

    let countQuery = db.select({ total: count() }).from(submissions);
    if (whereClause) countQuery = countQuery.where(whereClause);
    const countResult = await countQuery;
    const total = Number(countResult[0]?.total ?? 0);

    return res.json({
      submissions: submissionsList,
      total,
      pagination: {
        page,
        limit,
        totalPages: total ? Math.ceil(total / limit) : 0,
      },
    });
  } catch (error) {
    console.error('Submissions error:', error.message);
    return res.json({
      submissions: [],
      total: 0,
      pagination: {
        page,
        limit,
        totalPages: 0,
      },
    });
  }
});

router.get('/submissions/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid submission ID' });
    }
    
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    const notes = await db.select().from(submissionNotes)
      .where(eq(submissionNotes.submissionId, id))
      .orderBy(desc(submissionNotes.createdAt));
    
    const logs = await db.select().from(activityLogs)
      .where(and(eq(activityLogs.entityType, 'submission'), eq(activityLogs.entityId, id)))
      .orderBy(desc(activityLogs.createdAt))
      .limit(50);
    
    await logActivity('view_submission', 'submission', id, req.adminUser, req, {});
    
    res.json({ submission, notes, logs });
  } catch (error) {
    console.error('Submission detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch submission details' });
  }
});

router.patch('/submissions/:id', requireAuth, requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid submission ID' });
    }
    
    let { status, notes } = req.body;
    
    const allowedStatuses = ['new', 'contacted', 'in_progress', 'completed', 'cancelled'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    
    notes = notes ? sanitizeInput(notes) : undefined;
    
    const [current] = await db.select().from(submissions).where(eq(submissions.id, id));
    
    if (!current) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    const updateData = { updatedAt: new Date() };
    const changes = {};
    
    if (status && status !== current.status) {
      updateData.status = status;
      changes.status = { from: current.status, to: status };
    }
    if (notes !== undefined && notes !== current.notes) {
      updateData.notes = notes;
      changes.notes = { from: current.notes?.substring(0, 50), to: notes?.substring(0, 50) };
    }
    
    const [updated] = await db.update(submissions)
      .set(updateData)
      .where(eq(submissions.id, id))
      .returning();
    
    await logActivity('update_submission', 'submission', id, req.adminUser, req, changes);
    
    res.json({ submission: updated });
  } catch (error) {
    console.error('Update submission error:', error.message);
    res.status(500).json({ error: 'Failed to update submission' });
  }
});

router.post('/submissions/:id/notes', requireAuth, requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid submission ID' });
    }
    
    let { note } = req.body;
    note = sanitizeInput(note);
    
    if (!note || note.length < 1) {
      return res.status(400).json({ error: 'Note is required' });
    }
    
    if (note.length > 2000) {
      return res.status(400).json({ error: 'Note too long (max 2000 characters)' });
    }
    
    const [submission] = await db.select({ id: submissions.id }).from(submissions).where(eq(submissions.id, id));
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    const [newNote] = await db.insert(submissionNotes).values({
      submissionId: id,
      note,
      adminId: req.adminUser.id,
    }).returning();
    
    await logActivity('add_note', 'submission', id, req.adminUser, req, { notePreview: note.substring(0, 100) });
    
    res.json({ note: newNote });
  } catch (error) {
    console.error('Add note error:', error.message);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [{ total }] = await db.select({ total: count() }).from(submissions);
    const [{ todayCount }] = await db.select({ todayCount: count() }).from(submissions).where(gte(submissions.createdAt, today));
    const [{ weekCount }] = await db.select({ weekCount: count() }).from(submissions).where(gte(submissions.createdAt, weekAgo));
    const [{ monthCount }] = await db.select({ monthCount: count() }).from(submissions).where(gte(submissions.createdAt, monthAgo));

    const [{ earliestCreatedAt }] = await db.select({ earliestCreatedAt: sql`MIN(${submissions.createdAt})` }).from(submissions);
    const earliestDate = earliestCreatedAt ? new Date(earliestCreatedAt) : null;
    const daySpan = earliestDate ? Math.max(1, Math.floor((now.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24))) : 1;
    const avgPerDay = total ? Number((total / daySpan).toFixed(1)) : 0;

    const statusCounts = await db.select({
      status: submissions.status,
      count: count(),
    }).from(submissions).groupBy(submissions.status);

    const completedCount = statusCounts.find(s => s.status === 'completed')?.count || 0;
    const completionRate = total > 0 ? Number(((completedCount / total) * 100).toFixed(1)) : 0;

    const serviceTypeCounts = await db.select({
      serviceType: submissions.serviceType,
      count: count(),
    }).from(submissions).groupBy(submissions.serviceType).orderBy(desc(count())).limit(10);

    const weeklyService = await db.select({
      serviceType: submissions.serviceType,
      count: count(),
    }).from(submissions)
      .where(gte(submissions.createdAt, weekAgo))
      .groupBy(submissions.serviceType)
      .orderBy(desc(count()))
      .limit(1);
    const weeklyTrendService = weeklyService[0] ? {
      serviceType: weeklyService[0].serviceType,
      count: weeklyService[0].count,
    } : null;

    const countryCounts = await db.select({
      country: submissions.country,
      countryCode: submissions.countryCode,
      count: count(),
    }).from(submissions)
      .where(sql`${submissions.country} IS NOT NULL AND ${submissions.country} <> '' AND ${submissions.country} <> 'Unknown'`)
      .groupBy(submissions.country, submissions.countryCode)
      .orderBy(desc(count()))
      .limit(15);

    const missingCountryCondition = sql`${submissions.country} IS NULL OR ${submissions.country} = '' OR ${submissions.country} = 'Unknown'`;
    const [{ missingCountryCount }] = await db.select({ missingCountryCount: count() }).from(submissions).where(missingCountryCondition);
    const inferredCountries = [];
    const seenIps = new Set();
    const missingCountryRows = await db.select({
      ipAddress: submissions.ipAddress,
    }).from(submissions)
      .where(missingCountryCondition)
      .orderBy(desc(submissions.createdAt))
      .limit(50);

    let inferredCountTotal = 0;
    for (const row of missingCountryRows) {
      if (!row.ipAddress || seenIps.has(row.ipAddress)) continue;
      seenIps.add(row.ipAddress);
      try {
        const geo = await getGeoForIP(row.ipAddress);
        if (geo?.country && geo.country !== 'Unknown') {
          inferredCountries.push({
            country: geo.country,
            countryCode: geo.country_code,
            count: 1,
          });
          inferredCountTotal++;
        }
      } catch (geoError) {
        console.warn('Failed to infer country for IP', row.ipAddress, geoError?.message);
      }
      if (seenIps.size >= 25) {
        break;
      }
    }

    const browserCounts = await db.select({
      browser: submissions.browser,
      count: count(),
    }).from(submissions).where(sql`${submissions.browser} IS NOT NULL`).groupBy(submissions.browser).orderBy(desc(count()));

    const deviceTypeCounts = await db.select({
      deviceType: submissions.deviceType,
      count: count(),
    }).from(submissions).where(sql`${submissions.deviceType} IS NOT NULL`).groupBy(submissions.deviceType).orderBy(desc(count()));

    const osCounts = await db.select({
      os: submissions.os,
      count: count(),
    }).from(submissions).where(sql`${submissions.os} IS NOT NULL`).groupBy(submissions.os).orderBy(desc(count()));

    const dailySubmissions = await db.select({
      date: sql`DATE(${submissions.createdAt})`.as('date'),
      count: count(),
    }).from(submissions)
      .where(gte(submissions.createdAt, monthAgo))
      .groupBy(sql`DATE(${submissions.createdAt})`)
      .orderBy(sql`DATE(${submissions.createdAt})`);

    const trendMap = new Map(dailySubmissions.map((entry) => {
      const key = entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : `${entry.date}`;
      return [key, entry.count];
    }));

    const dailyTrend = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dailyTrend.push({ date: key, count: trendMap.get(key) ?? 0 });
    }

    const hourlyActivity = await db.select({
      hour: sql`EXTRACT(HOUR FROM (${submissions.createdAt} AT TIME ZONE 'America/New_York'))`.as('hour'),
      count: count(),
      avg_session_duration: sql`AVG(${submissions.sessionDuration})`.as('avg_session_duration'),
    }).from(submissions)
      .where(sql`${submissions.sessionDuration} IS NOT NULL`)
      .groupBy(sql`EXTRACT(HOUR FROM (${submissions.createdAt} AT TIME ZONE 'America/New_York'))`)
      .orderBy(sql`EXTRACT(HOUR FROM (${submissions.createdAt} AT TIME ZONE 'America/New_York'))`);

    const weekdayDistribution = await db.select({
      weekday: sql`EXTRACT(DOW FROM ${submissions.createdAt})`.as('weekday'),
      count: count(),
    }).from(submissions)
      .groupBy(sql`EXTRACT(DOW FROM ${submissions.createdAt})`)
      .orderBy(sql`EXTRACT(DOW FROM ${submissions.createdAt})`);

    const usStateCounts = await db.select({
      state: submissions.region,
      count: count(),
    }).from(submissions)
      .where(and(
        eq(submissions.countryCode, 'US'),
        sql`${submissions.region} IS NOT NULL`
      ))
      .groupBy(submissions.region)
      .orderBy(desc(count()));

    const countryMap = new Map();
    const mergeCountry = (entry) => {
      const key = (entry.country && entry.country !== 'Unknown') ? entry.country : (entry.countryCode || 'Unknown');
      const existing = countryMap.get(key);
      countryMap.set(key, {
        country: entry.country || existing?.country || key,
        countryCode: entry.countryCode || existing?.countryCode,
        count: (existing?.count || 0) + (entry.count || 0),
      });
    };

    countryCounts.forEach(mergeCountry);
    inferredCountries.forEach((entry) => mergeCountry({ ...entry, count: entry.count || 1 }));
    const leftoverUnknown = Math.max(0, (missingCountryCount || 0) - inferredCountTotal);
    if (leftoverUnknown > 0) {
      mergeCountry({
        country: 'Unknown',
        countryCode: 'XX',
        count: leftoverUnknown,
      });
    }
    const mergedCountries = Array.from(countryMap.values());

    const localByStatus = statusCounts.reduce((acc, { status, count }) => {
      acc[status] = count;
      return acc;
    }, {});
    const fallbackNeeded =
      total === 0 ||
      Object.keys(localByStatus).length === 0 ||
      mergedCountries.length === 0 ||
      browserCounts.length === 0 ||
      deviceTypeCounts.length === 0 ||
      osCounts.length === 0 ||
      dailyTrend.length === 0 ||
      hourlyActivity.length === 0 ||
      weekdayDistribution.length === 0;
    const supsStats = fallbackNeeded ? await fetchSupabaseFallbackStats() : null;

    const finalOverview = {
      total: total || supsStats?.overview?.total || 0,
      today: todayCount || supsStats?.overview?.today || 0,
      thisWeek: weekCount || supsStats?.overview?.thisWeek || 0,
      thisMonth: monthCount || supsStats?.overview?.thisMonth || 0,
      avgPerDay,
    };

    const calculateFallbackCompletion = (statsObj, totalValue) => {
      if (!statsObj || !totalValue) return 0;
      const completedFromSup = statsObj.completed || 0;
      return Number(((completedFromSup / totalValue) * 100).toFixed(1));
    };
    const fallbackCompletionRate = supsStats ? calculateFallbackCompletion(supsStats.byStatus, supsStats.overview.total) : 0;
    const finalCompletionRate = total > 0 ? completionRate : fallbackCompletionRate;
    const finalByStatus = Object.keys(localByStatus).length ? localByStatus : supsStats?.byStatus || {};
    const finalByCountry = mergedCountries.length ? mergedCountries : supsStats?.byCountry || [];
    const finalByBrowser = browserCounts.length ? browserCounts : supsStats?.byBrowser || [];
    const finalByDeviceType = deviceTypeCounts.length ? deviceTypeCounts : supsStats?.byDeviceType || [];
    const finalByOS = osCounts.length ? osCounts : supsStats?.byOS || [];
    const finalDailyTrend = dailyTrend.length ? dailyTrend : supsStats?.dailyTrend || [];
    const finalHourlyActivity = hourlyActivity.length ? hourlyActivity : supsStats?.hourlyActivity || [];
    const finalWeekdayDistribution = weekdayDistribution.length ? weekdayDistribution : supsStats?.weekdayDistribution || [];

    res.json({
      overview: {
        ...finalOverview,
      },
      weeklyTrendService,
      completionRate: finalCompletionRate,
      byStatus: finalByStatus,
      byServiceType: serviceTypeCounts,
      byCountry: finalByCountry,
      byBrowser: finalByBrowser,
      byDeviceType: finalByDeviceType,
      byOS: finalByOS,
      dailyTrend: finalDailyTrend,
      hourlyActivity: finalHourlyActivity,
      weekdayDistribution: finalWeekdayDistribution,
      byUSState: usStateCounts,
    });
  } catch (error) {
    console.error('Stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

router.get('/logs', requireAuth, async (req, res) => {
  try {
    let { action, entityType, adminId, page = 1, limit = 50 } = req.query;
    
    page = Math.max(1, Math.min(parseInt(page) || 1, 1000));
    limit = Math.max(1, Math.min(parseInt(limit) || 50, 100));
    const offset = (page - 1) * limit;
    
    let conditions = [];
    
    if (action && action !== 'all') {
      conditions.push(eq(activityLogs.action, sanitizeInput(action)));
    }
    if (entityType && entityType !== 'all') {
      conditions.push(eq(activityLogs.entityType, sanitizeInput(entityType)));
    }
    if (adminId && adminId !== 'all') {
      const parsedAdminId = parseInt(adminId);
      if (!isNaN(parsedAdminId) && parsedAdminId > 0) {
        conditions.push(eq(activityLogs.adminId, parsedAdminId));
      }
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    let query = db.select().from(activityLogs);
    if (whereClause) query = query.where(whereClause);
    const logs = await query.orderBy(desc(activityLogs.createdAt)).limit(limit).offset(offset);
    
    let countQuery = db.select({ total: count() }).from(activityLogs);
    if (whereClause) countQuery = countQuery.where(whereClause);
    const [{ total }] = await countQuery;
    
    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Logs error:', error.message);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.get('/filters', requireAuth, async (req, res) => {
  try {
    const countries = await db.selectDistinct({ 
      country: submissions.country, 
      countryCode: submissions.countryCode 
    }).from(submissions).where(sql`${submissions.country} IS NOT NULL`);
    
    const serviceTypes = await db.selectDistinct({ 
      serviceType: submissions.serviceType 
    }).from(submissions);
    
    const statuses = ['new', 'contacted', 'in_progress', 'completed', 'cancelled'];
    
    res.json({
      countries: countries.filter(c => c.country),
      serviceTypes: serviceTypes.map(s => s.serviceType),
      statuses,
    });
  } catch (error) {
    console.error('Filters error:', error.message);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

router.delete('/submissions/:id', requireAuth, requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid submission ID' });
    }
    
    const [current] = await db.select().from(submissions).where(eq(submissions.id, id));
    if (!current) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    await db.delete(submissionNotes).where(eq(submissionNotes.submissionId, id));
    
    const [deleted] = await db.delete(submissions)
      .where(eq(submissions.id, id))
      .returning();
    
    await logActivity('delete_submission', 'submission', id, req.adminUser, req, { 
      deletedSubmission: { 
        name: deleted.name?.substring(0, 50), 
        email: deleted.email?.substring(0, 50), 
        serviceType: deleted.serviceType 
      } 
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete submission error:', error.message);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

router.post('/change-password', requireAuth, requireCSRF, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    
    if (newPassword.length > 100) {
      return res.status(400).json({ error: 'Password too long' });
    }
    
    const passwordStrength = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
    if (!passwordStrength.test(newPassword)) {
      return res.status(400).json({ 
        error: 'Password must contain uppercase, lowercase, number, and special character' 
      });
    }
    
    const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, req.adminUser.id));
    
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      await logActivity('change_password_failed', 'admin', req.adminUser.id, req.adminUser, req, { reason: 'wrong_current_password' });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.update(adminUsers).set({ passwordHash: newHash }).where(eq(adminUsers.id, req.adminUser.id));
    
    for (const [sid, session] of sessions.entries()) {
      if (session.user.id === req.adminUser.id && sid !== req.sessionId) {
        sessions.delete(sid);
      }
    }
    
    await logActivity('change_password', 'admin', req.adminUser.id, req.adminUser, req, {});
    
    res.json({ success: true, message: 'Password changed successfully. Other sessions have been logged out.' });
  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ==================== PROFESSIONALS ROUTES ====================

router.get('/professionals', requireAuth, async (req, res) => {
  try {
    let { status, serviceType, search, page = 1, limit = 20 } = req.query;
    
    page = Math.max(1, Math.min(parseInt(page) || 1, 1000));
    limit = Math.max(1, Math.min(parseInt(limit) || 20, 100));
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM professionals WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM professionals WHERE 1=1';
    const params = [];
    
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND status = $${params.length}`;
      countQuery += ` AND status = $${params.length}`;
    }
    
    if (search) {
      const searchTerm = `%${sanitizeInput(search)}%`;
      params.push(searchTerm);
      query += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR company_name ILIKE $${params.length})`;
      countQuery += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR company_name ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const result = await db.execute(sql.raw(query, params));
    const countResult = await db.execute(sql.raw(countQuery, params.slice(0, -2)));
    
    res.json({
      professionals: result.rows || [],
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows?.[0]?.total || 0),
        totalPages: Math.ceil((countResult.rows?.[0]?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Professionals error:', error.message);
    res.status(500).json({ error: 'Failed to fetch professionals' });
  }
});

router.post('/professionals', requireAuth, requireRole('admin', 'editor'), requireCSRF, async (req, res) => {
  try {
    let { name, email, phone, companyName, serviceTypes, zipCodes, licenseNumber, notes } = req.body;
    
    name = sanitizeInput(name);
    email = sanitizeInput(email);
    phone = sanitizeInput(phone);
    companyName = sanitizeInput(companyName);
    licenseNumber = sanitizeInput(licenseNumber);
    notes = sanitizeInput(notes);
    
    const sanitizedServiceTypes = sanitizeArray(serviceTypes, 20, 50);
    const sanitizedZipCodes = sanitizeArray(zipCodes, 100, 10);
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const result = await db.execute(sql`
      INSERT INTO professionals (name, email, phone, company_name, service_types, zip_codes, license_number, notes)
      VALUES (${name}, ${email}, ${phone}, ${companyName}, ${sanitizedServiceTypes}, ${sanitizedZipCodes}, ${licenseNumber}, ${notes})
      RETURNING *
    `);
    
    await logActivity('create_professional', 'professional', result.rows[0].id, req.adminUser, req, { name, email });
    
    res.json({ professional: result.rows[0] });
  } catch (error) {
    console.error('Create professional error:', error.message);
    if (error.message.includes('unique')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create professional' });
  }
});

router.patch('/professionals/:id', requireAuth, requireRole('admin', 'editor'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid professional ID' });
    }
    
    let { name, email, phone, companyName, serviceTypes, zipCodes, licenseNumber, insuranceVerified, backgroundChecked, status, notes } = req.body;
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push(`name = $${values.length + 1}`); values.push(sanitizeInput(name)); }
    if (email !== undefined) { updates.push(`email = $${values.length + 1}`); values.push(sanitizeInput(email)); }
    if (phone !== undefined) { updates.push(`phone = $${values.length + 1}`); values.push(sanitizeInput(phone)); }
    if (companyName !== undefined) { updates.push(`company_name = $${values.length + 1}`); values.push(sanitizeInput(companyName)); }
    if (serviceTypes !== undefined) { updates.push(`service_types = $${values.length + 1}`); values.push(sanitizeArray(serviceTypes, 20, 50)); }
    if (zipCodes !== undefined) { updates.push(`zip_codes = $${values.length + 1}`); values.push(sanitizeArray(zipCodes, 100, 10)); }
    if (licenseNumber !== undefined) { updates.push(`license_number = $${values.length + 1}`); values.push(sanitizeInput(licenseNumber)); }
    if (insuranceVerified !== undefined) { updates.push(`insurance_verified = $${values.length + 1}`); values.push(Boolean(insuranceVerified)); }
    if (backgroundChecked !== undefined) { updates.push(`background_checked = $${values.length + 1}`); values.push(Boolean(backgroundChecked)); }
    if (status !== undefined) { 
      const allowedStatuses = ['pending', 'approved', 'suspended', 'rejected'];
      if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
      updates.push(`status = $${values.length + 1}`); values.push(status); 
    }
    if (notes !== undefined) { updates.push(`notes = $${values.length + 1}`); values.push(sanitizeInput(notes)); }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    values.push(id);
    const query = `UPDATE professionals SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`;
    
    const result = await db.execute(sql.raw(query, values));
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Professional not found' });
    }
    
    await logActivity('update_professional', 'professional', id, req.adminUser, req, {});
    
    res.json({ professional: result.rows[0] });
  } catch (error) {
    console.error('Update professional error:', error.message);
    res.status(500).json({ error: 'Failed to update professional' });
  }
});

router.delete('/professionals/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid professional ID' });
    }
    
    const result = await db.execute(sql`DELETE FROM professionals WHERE id = ${id} RETURNING *`);
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Professional not found' });
    }
    
    await logActivity('delete_professional', 'professional', id, req.adminUser, req, { name: result.rows[0].name });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete professional error:', error.message);
    res.status(500).json({ error: 'Failed to delete professional' });
  }
});

// ==================== SERVICE CATEGORIES ROUTES ====================

router.get('/service-categories', requireAuth, async (req, res) => {
  try {
    const result = await db.execute(sql`SELECT * FROM service_categories ORDER BY sort_order, name`);
    res.json({ categories: result.rows || [] });
  } catch (error) {
    console.error('Service categories error:', error.message);
    res.status(500).json({ error: 'Failed to fetch service categories' });
  }
});

router.post('/service-categories', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    let { name, description, icon, color, sortOrder } = req.body;
    
    name = sanitizeInput(name);
    description = sanitizeInput(description);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const result = await db.execute(sql`
      INSERT INTO service_categories (name, slug, description, icon, color, sort_order)
      VALUES (${name}, ${slug}, ${description}, ${icon}, ${color}, ${sortOrder || 0})
      RETURNING *
    `);
    
    await logActivity('create_category', 'service_category', result.rows[0].id, req.adminUser, req, { name });
    
    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('Create category error:', error.message);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.patch('/service-categories/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    
    let { name, description, icon, color, isActive, sortOrder } = req.body;
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) { 
      updates.push(`name = $${values.length + 1}`); 
      values.push(sanitizeInput(name));
      const slug = sanitizeInput(name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      updates.push(`slug = $${values.length + 1}`);
      values.push(slug);
    }
    if (description !== undefined) { updates.push(`description = $${values.length + 1}`); values.push(sanitizeInput(description)); }
    if (icon !== undefined) { updates.push(`icon = $${values.length + 1}`); values.push(icon); }
    if (color !== undefined) { updates.push(`color = $${values.length + 1}`); values.push(color); }
    if (isActive !== undefined) { updates.push(`is_active = $${values.length + 1}`); values.push(isActive); }
    if (sortOrder !== undefined) { updates.push(`sort_order = $${values.length + 1}`); values.push(sortOrder); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    values.push(id);
    const query = `UPDATE service_categories SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`;
    
    const result = await db.execute(sql.raw(query, values));
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    await logActivity('update_category', 'service_category', id, req.adminUser, req, {});
    
    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('Update category error:', error.message);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/service-categories/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid category ID' });
    }
    
    const result = await db.execute(sql`DELETE FROM service_categories WHERE id = ${id} RETURNING *`);
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    await logActivity('delete_category', 'service_category', id, req.adminUser, req, { name: result.rows[0].name });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error.message);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// ==================== WEBHOOKS ROUTES ====================

router.get('/webhooks', requireAuth, async (req, res) => {
  try {
    const result = await db.execute(sql`SELECT id, name, url, events, is_active, last_triggered_at, failure_count, created_at FROM webhooks ORDER BY created_at DESC`);
    res.json({ webhooks: result.rows || [] });
  } catch (error) {
    console.error('Webhooks error:', error.message);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

router.post('/webhooks', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    let { name, url, events } = req.body;
    
    name = sanitizeInput(name);
    
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }
    
    if (!validateUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL format. Must be http or https.' });
    }
    
    const sanitizedEvents = sanitizeArray(events, 10, 50);
    const secretKey = crypto.randomBytes(32).toString('hex');
    const encryptedSecret = encryptSecret(secretKey);
    
    const result = await db.execute(sql`
      INSERT INTO webhooks (name, url, events, secret_key)
      VALUES (${sanitizeInput(name)}, ${sanitizeInput(url)}, ${sanitizedEvents}, ${encryptedSecret})
      RETURNING id, name, url, events, is_active, created_at
    `);
    
    await logActivity('create_webhook', 'webhook', result.rows[0].id, req.adminUser, req, { name });
    
    res.json({ webhook: result.rows[0], secretKey });
  } catch (error) {
    console.error('Create webhook error:', error.message);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

router.patch('/webhooks/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid webhook ID' });
    }
    
    let { name, url, events, isActive } = req.body;
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push(`name = $${values.length + 1}`); values.push(sanitizeInput(name)); }
    if (url !== undefined) { 
      if (!validateUrl(url)) { return res.status(400).json({ error: 'Invalid URL' }); }
      updates.push(`url = $${values.length + 1}`); values.push(sanitizeInput(url)); 
    }
    if (events !== undefined) { updates.push(`events = $${values.length + 1}`); values.push(sanitizeArray(events, 10, 50)); }
    if (isActive !== undefined) { updates.push(`is_active = $${values.length + 1}`); values.push(Boolean(isActive)); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    values.push(id);
    const query = `UPDATE webhooks SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING id, name, url, events, is_active, last_triggered_at, failure_count, created_at`;
    
    const result = await db.execute(sql.raw(query, values));
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    await logActivity('update_webhook', 'webhook', id, req.adminUser, req, {});
    
    res.json({ webhook: result.rows[0] });
  } catch (error) {
    console.error('Update webhook error:', error.message);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

router.delete('/webhooks/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid webhook ID' });
    }
    
    const result = await db.execute(sql`DELETE FROM webhooks WHERE id = ${id} RETURNING *`);
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    await logActivity('delete_webhook', 'webhook', id, req.adminUser, req, { name: result.rows[0].name });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete webhook error:', error.message);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

router.post('/webhooks/:id/test', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid webhook ID' });
    }
    
    const result = await db.execute(sql`SELECT * FROM webhooks WHERE id = ${id}`);
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const webhook = result.rows[0];
    
    try {
      const timestamp = new Date().toISOString();
      const testPayload = JSON.stringify({
        event: 'test',
        timestamp,
        data: { message: 'This is a test webhook from MIYOMINT' },
      });
      
      const decryptedSecret = decryptSecret(webhook.secret_key);
      if (!decryptedSecret) {
        return res.status(400).json({ 
          error: 'Webhook secret cannot be decrypted. Please delete and recreate this webhook to generate a new secret.',
          needsRegeneration: true 
        });
      }
      
      const signature = signWebhookPayload(decryptedSecret, testPayload);
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Timestamp': timestamp,
          'X-Webhook-Event': 'test',
        },
        body: testPayload,
        signal: AbortSignal.timeout(10000),
      });
      
      await db.execute(sql`UPDATE webhooks SET last_triggered_at = CURRENT_TIMESTAMP, failure_count = 0 WHERE id = ${id}`);
      
      res.json({ success: true, status: response.status, message: 'Webhook test sent successfully' });
    } catch (fetchError) {
      await db.execute(sql`UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ${id}`);
      res.json({ success: false, error: fetchError.message });
    }
  } catch (error) {
    console.error('Test webhook error:', error.message);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// ==================== ADMIN USERS MANAGEMENT ====================

router.get('/admin-users', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    
    const result = await db.select({
      id: adminUsers.id,
      username: adminUsers.username,
      role: adminUsers.role,
      createdAt: adminUsers.createdAt,
      lastLoginAt: adminUsers.lastLoginAt,
      lastLoginIp: adminUsers.lastLoginIp,
    }).from(adminUsers).orderBy(desc(adminUsers.createdAt));
    
    res.json({ users: result });
  } catch (error) {
    console.error('Admin users error:', error.message);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

router.post('/admin-users', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    
    let { username, password, role } = req.body;
    
    username = sanitizeInput(username);
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'Username must be 3-50 characters' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    const passwordStrength = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
    if (!passwordStrength.test(password)) {
      return res.status(400).json({ 
        error: 'Password must contain uppercase, lowercase, number, and special character' 
      });
    }
    
    const allowedRoles = ['admin', 'editor', 'viewer'];
    if (!allowedRoles.includes(role)) {
      role = 'viewer';
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    const [newUser] = await db.insert(adminUsers).values({
      username,
      passwordHash,
      role,
    }).returning({ id: adminUsers.id, username: adminUsers.username, role: adminUsers.role, createdAt: adminUsers.createdAt });
    
    await logActivity('create_admin_user', 'admin', newUser.id, req.adminUser, req, { username, role });
    
    res.json({ user: newUser });
  } catch (error) {
    console.error('Create admin user error:', error.message);
    if (error.message.includes('unique')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

router.delete('/admin-users/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    if (id === req.adminUser.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const [deleted] = await db.delete(adminUsers).where(eq(adminUsers.id, id)).returning();
    
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    for (const [sid, session] of sessions.entries()) {
      if (session.user.id === id) {
        sessions.delete(sid);
      }
    }
    
    await logActivity('delete_admin_user', 'admin', id, req.adminUser, req, { username: deleted.username });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete admin user error:', error.message);
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

// ==================== EXPORT ROUTES ====================

router.get('/export/submissions', requireAuth, requireRole('admin', 'editor'), async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const results = await db.select().from(submissions).orderBy(desc(submissions.createdAt)).limit(10000);
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=submissions.json');
      return res.send(JSON.stringify(results, null, 2));
    }
    
    const headers = ['ID', 'Service Type', 'ZIP Code', 'Name', 'Email', 'Phone', 'Status', 'Country', 'City', 'Created At'];
    const csvRows = [headers.join(',')];
    
    for (const row of results) {
      csvRows.push([
        row.id,
        `"${escapeHtml(row.serviceType || '')}"`,
        `"${escapeHtml(row.zipCode || '')}"`,
        `"${escapeHtml(row.name || '')}"`,
        `"${escapeHtml(row.email || '')}"`,
        `"${escapeHtml(row.phone || '')}"`,
        row.status,
        `"${escapeHtml(row.country || '')}"`,
        `"${escapeHtml(row.city || '')}"`,
        row.createdAt,
      ].join(','));
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=submissions.csv');
    res.send(csvRows.join('\n'));
    
    await logActivity('export_submissions', 'submission', null, req.adminUser, req, { format, count: results.length });
  } catch (error) {
    console.error('Export error:', error.message);
    res.status(500).json({ error: 'Failed to export submissions' });
  }
});

// ==================== SYSTEM INFO ====================

router.get('/system-info', requireAuth, async (req, res) => {
  try {
    const [submissionCount] = await db.select({ count: count() }).from(submissions);
    const [professionalCount] = await db.execute(sql`SELECT COUNT(*) as count FROM professionals`);
    const [categoryCount] = await db.execute(sql`SELECT COUNT(*) as count FROM service_categories`);
    const [webhookCount] = await db.execute(sql`SELECT COUNT(*) as count FROM webhooks`);
    const [adminCount] = await db.select({ count: count() }).from(adminUsers);
    
    res.json({
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      submissions: submissionCount?.count || 0,
      professionals: professionalCount.rows?.[0]?.count || 0,
      categories: categoryCount.rows?.[0]?.count || 0,
      webhooks: webhookCount.rows?.[0]?.count || 0,
      admins: adminCount?.count || 0,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (error) {
    console.error('System info error:', error.message);
    res.status(500).json({ error: 'Failed to fetch system info' });
  }
});

// ==================== PARTNER API ROUTES ====================

router.get('/partners', requireAuth, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT id, name, endpoint_url, http_method, auth_method, is_active, service_types, 
             timeout_ms, retry_count, success_count, failure_count, last_success_at, last_failure_at, 
             notes, created_at, updated_at
      FROM partner_apis 
      ORDER BY created_at DESC
    `);
    res.json({ partners: result.rows || [] });
  } catch (error) {
    console.error('Partners error:', error.message);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

router.post('/partners', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    let { name, endpointUrl, httpMethod, authMethod, authConfig, headers, serviceTypes, timeoutMs, retryCount, notes } = req.body;
    
    name = sanitizeInput(name);
    notes = sanitizeInput(notes);
    
    if (!name || !endpointUrl) {
      return res.status(400).json({ error: 'Name and endpoint URL are required' });
    }
    
    if (!validateUrl(endpointUrl)) {
      return res.status(400).json({ error: 'Invalid endpoint URL' });
    }
    
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH'];
    httpMethod = allowedMethods.includes(httpMethod?.toUpperCase()) ? httpMethod.toUpperCase() : 'POST';
    
    const allowedAuthMethods = ['none', 'api_key', 'bearer', 'basic', 'custom_header'];
    authMethod = allowedAuthMethods.includes(authMethod) ? authMethod : 'api_key';
    
    let encryptedAuthConfig = {};
    if (authConfig && typeof authConfig === 'object') {
      if (authConfig.apiKey) {
        encryptedAuthConfig.apiKey = encryptSecret(authConfig.apiKey);
      }
      if (authConfig.bearerToken) {
        encryptedAuthConfig.bearerToken = encryptSecret(authConfig.bearerToken);
      }
      if (authConfig.username) {
        encryptedAuthConfig.username = authConfig.username;
      }
      if (authConfig.password) {
        encryptedAuthConfig.password = encryptSecret(authConfig.password);
      }
      if (authConfig.headerName) {
        encryptedAuthConfig.headerName = authConfig.headerName;
      }
      if (authConfig.headerValue) {
        encryptedAuthConfig.headerValue = encryptSecret(authConfig.headerValue);
      }
    }
    
    const sanitizedServiceTypes = sanitizeArray(serviceTypes, 20, 50);
    
    const result = await db.execute(sql`
      INSERT INTO partner_apis (name, endpoint_url, http_method, auth_method, auth_config, headers, service_types, timeout_ms, retry_count, notes)
      VALUES (${name}, ${sanitizeInput(endpointUrl)}, ${httpMethod}, ${authMethod}, ${JSON.stringify(encryptedAuthConfig)}, ${JSON.stringify(headers || {})}, ${sanitizedServiceTypes}, ${timeoutMs || 10000}, ${retryCount || 3}, ${notes})
      RETURNING id, name, endpoint_url, http_method, auth_method, is_active, service_types, timeout_ms, retry_count, notes, created_at
    `);
    
    await logActivity('create_partner', 'partner', result.rows[0].id, req.adminUser, req, { name });
    
    res.json({ partner: result.rows[0] });
  } catch (error) {
    console.error('Create partner error:', error.message);
    res.status(500).json({ error: 'Failed to create partner' });
  }
});

router.patch('/partners/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid partner ID' });
    }
    
    let { name, endpointUrl, httpMethod, authMethod, authConfig, headers, serviceTypes, timeoutMs, retryCount, isActive, notes } = req.body;
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) { updates.push(`name = $${values.length + 1}`); values.push(sanitizeInput(name)); }
    if (endpointUrl !== undefined) { 
      if (!validateUrl(endpointUrl)) return res.status(400).json({ error: 'Invalid URL' });
      updates.push(`endpoint_url = $${values.length + 1}`); values.push(sanitizeInput(endpointUrl)); 
    }
    if (httpMethod !== undefined) { updates.push(`http_method = $${values.length + 1}`); values.push(httpMethod.toUpperCase()); }
    if (authMethod !== undefined) { updates.push(`auth_method = $${values.length + 1}`); values.push(authMethod); }
    if (authConfig !== undefined) {
      let encryptedAuthConfig = {};
      if (authConfig.apiKey) encryptedAuthConfig.apiKey = encryptSecret(authConfig.apiKey);
      if (authConfig.bearerToken) encryptedAuthConfig.bearerToken = encryptSecret(authConfig.bearerToken);
      if (authConfig.username) encryptedAuthConfig.username = authConfig.username;
      if (authConfig.password) encryptedAuthConfig.password = encryptSecret(authConfig.password);
      if (authConfig.headerName) encryptedAuthConfig.headerName = authConfig.headerName;
      if (authConfig.headerValue) encryptedAuthConfig.headerValue = encryptSecret(authConfig.headerValue);
      updates.push(`auth_config = $${values.length + 1}`); values.push(JSON.stringify(encryptedAuthConfig));
    }
    if (headers !== undefined) { updates.push(`headers = $${values.length + 1}`); values.push(JSON.stringify(headers)); }
    if (serviceTypes !== undefined) { updates.push(`service_types = $${values.length + 1}`); values.push(sanitizeArray(serviceTypes, 20, 50)); }
    if (timeoutMs !== undefined) { updates.push(`timeout_ms = $${values.length + 1}`); values.push(parseInt(timeoutMs) || 10000); }
    if (retryCount !== undefined) { updates.push(`retry_count = $${values.length + 1}`); values.push(parseInt(retryCount) || 3); }
    if (isActive !== undefined) { updates.push(`is_active = $${values.length + 1}`); values.push(Boolean(isActive)); }
    if (notes !== undefined) { updates.push(`notes = $${values.length + 1}`); values.push(sanitizeInput(notes)); }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    if (updates.length === 1) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    values.push(id);
    const query = `UPDATE partner_apis SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING id, name, endpoint_url, http_method, auth_method, is_active, service_types, timeout_ms, retry_count, notes, success_count, failure_count, last_success_at, last_failure_at, updated_at`;
    
    const result = await db.execute(sql.raw(query, values));
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    
    await logActivity('update_partner', 'partner', id, req.adminUser, req, {});
    
    res.json({ partner: result.rows[0] });
  } catch (error) {
    console.error('Update partner error:', error.message);
    res.status(500).json({ error: 'Failed to update partner' });
  }
});

router.delete('/partners/:id', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid partner ID' });
    }
    
    const result = await db.execute(sql`DELETE FROM partner_apis WHERE id = ${id} RETURNING *`);
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    
    await logActivity('delete_partner', 'partner', id, req.adminUser, req, { name: result.rows[0].name });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete partner error:', error.message);
    res.status(500).json({ error: 'Failed to delete partner' });
  }
});

router.post('/partners/:id/test', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid partner ID' });
    }
    
    const result = await db.execute(sql`SELECT * FROM partner_apis WHERE id = ${id}`);
    
    if (!result.rows?.[0]) {
      return res.status(404).json({ error: 'Partner not found' });
    }
    
    const partner = result.rows[0];
    const authConfig = typeof partner.auth_config === 'string' ? JSON.parse(partner.auth_config) : partner.auth_config;
    
    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      source: 'MIYOMINT',
      message: 'This is a test request from MIYOMINT Partner Integration',
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'MIYOMINT-Partner-Integration/1.0',
      ...(typeof partner.headers === 'string' ? JSON.parse(partner.headers) : partner.headers || {}),
    };
    
    if (partner.auth_method === 'api_key' && authConfig.apiKey) {
      const decryptedKey = decryptSecret(authConfig.apiKey);
      if (decryptedKey) headers['X-API-Key'] = decryptedKey;
    } else if (partner.auth_method === 'bearer' && authConfig.bearerToken) {
      const decryptedToken = decryptSecret(authConfig.bearerToken);
      if (decryptedToken) headers['Authorization'] = `Bearer ${decryptedToken}`;
    } else if (partner.auth_method === 'basic' && authConfig.username && authConfig.password) {
      const decryptedPass = decryptSecret(authConfig.password);
      if (decryptedPass) {
        const credentials = Buffer.from(`${authConfig.username}:${decryptedPass}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
    } else if (partner.auth_method === 'custom_header' && authConfig.headerName && authConfig.headerValue) {
      const decryptedValue = decryptSecret(authConfig.headerValue);
      if (decryptedValue) headers[authConfig.headerName] = decryptedValue;
    }
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(partner.endpoint_url, {
        method: partner.http_method || 'POST',
        headers,
        body: partner.http_method !== 'GET' ? JSON.stringify(testPayload) : undefined,
        signal: AbortSignal.timeout(partner.timeout_ms || 10000),
      });
      
      const latency = Date.now() - startTime;
      let responseText = '';
      try { responseText = await response.text(); } catch {}
      
      res.json({ 
        success: response.ok, 
        status: response.status, 
        statusText: response.statusText,
        latency,
        response: responseText.substring(0, 500),
      });
    } catch (fetchError) {
      res.json({ success: false, error: fetchError.message, latency: Date.now() - startTime });
    }
  } catch (error) {
    console.error('Test partner error:', error.message);
    res.status(500).json({ error: 'Failed to test partner' });
  }
});

// ==================== DISTRIBUTION LOGS ROUTES ====================

router.get('/distribution-logs', requireAuth, async (req, res) => {
  try {
    let { partnerId, status, submissionId, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
    
    page = Math.max(1, Math.min(parseInt(page) || 1, 1000));
    limit = Math.max(1, Math.min(parseInt(limit) || 50, 100));
    const offset = (page - 1) * limit;
    
    let conditions = [];
    const params = [];
    
    if (partnerId && partnerId !== 'all') {
      params.push(parseInt(partnerId));
      conditions.push(`pd.partner_api_id = $${params.length}`);
    }
    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`pd.status = $${params.length}`);
    }
    if (submissionId) {
      params.push(parseInt(submissionId));
      conditions.push(`pd.submission_id = $${params.length}`);
    }
    if (dateFrom) {
      params.push(new Date(dateFrom));
      conditions.push(`pd.created_at >= $${params.length}`);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      params.push(toDate);
      conditions.push(`pd.created_at <= $${params.length}`);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const query = `
      SELECT pd.*, pa.name as partner_name, pa.endpoint_url as partner_url
      FROM partner_distributions pd
      LEFT JOIN partner_apis pa ON pd.partner_api_id = pa.id
      ${whereClause}
      ORDER BY pd.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);
    
    const countQuery = `SELECT COUNT(*) as total FROM partner_distributions pd ${whereClause}`;
    
    const result = await db.execute(sql.raw(query, params));
    const countResult = await db.execute(sql.raw(countQuery, params.slice(0, -2)));
    
    res.json({
      logs: result.rows || [],
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows?.[0]?.total || 0),
        totalPages: Math.ceil((countResult.rows?.[0]?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Distribution logs error:', error.message);
    res.status(500).json({ error: 'Failed to fetch distribution logs' });
  }
});

router.post('/distribution-logs/:id/retry', requireAuth, requireRole('admin', 'editor'), requireCSRF, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid log ID' });
    }
    
    const logResult = await db.execute(sql`
      SELECT pd.*, pa.*, s.name, s.email, s.phone, s.service_type as submission_service_type, s.zip_code, s.answers
      FROM partner_distributions pd
      JOIN partner_apis pa ON pd.partner_api_id = pa.id
      JOIN submissions s ON pd.submission_id = s.id
      WHERE pd.id = ${id}
    `);
    
    if (!logResult.rows?.[0]) {
      return res.status(404).json({ error: 'Distribution log not found' });
    }
    
    const log = logResult.rows[0];
    
    const submissionData = {
      id: log.submission_id,
      serviceType: log.submission_service_type,
      zipCode: log.zip_code,
      name: log.name,
      email: log.email,
      phone: log.phone,
      answers: log.answers,
      timestamp: new Date().toISOString(),
    };
    
    const authConfig = typeof log.auth_config === 'string' ? JSON.parse(log.auth_config) : log.auth_config;
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'MIYOMINT-Partner-Integration/1.0',
      ...(typeof log.headers === 'string' ? JSON.parse(log.headers) : log.headers || {}),
    };
    
    if (log.auth_method === 'api_key' && authConfig?.apiKey) {
      const decryptedKey = decryptSecret(authConfig.apiKey);
      if (decryptedKey) headers['X-API-Key'] = decryptedKey;
    } else if (log.auth_method === 'bearer' && authConfig?.bearerToken) {
      const decryptedToken = decryptSecret(authConfig.bearerToken);
      if (decryptedToken) headers['Authorization'] = `Bearer ${decryptedToken}`;
    }
    
    const startTime = Date.now();
    
    await db.execute(sql`UPDATE partner_distributions SET status = 'retrying', attempt_count = attempt_count + 1, started_at = CURRENT_TIMESTAMP WHERE id = ${id}`);
    
    try {
      const response = await fetch(log.endpoint_url, {
        method: log.http_method || 'POST',
        headers,
        body: log.http_method !== 'GET' ? JSON.stringify(submissionData) : undefined,
        signal: AbortSignal.timeout(log.timeout_ms || 10000),
      });
      
      const latency = Date.now() - startTime;
      let responseText = '';
      try { responseText = await response.text(); } catch {}
      
      const newStatus = response.ok ? 'success' : 'failed';
      
      await db.execute(sql`
        UPDATE partner_distributions 
        SET status = ${newStatus}, response_status = ${response.status}, response_body = ${responseText.substring(0, 2000)}, 
            latency_ms = ${latency}, completed_at = CURRENT_TIMESTAMP, error_message = NULL
        WHERE id = ${id}
      `);
      
      if (response.ok) {
        await db.execute(sql`UPDATE partner_apis SET success_count = success_count + 1, last_success_at = CURRENT_TIMESTAMP WHERE id = ${log.partner_api_id}`);
      } else {
        await db.execute(sql`UPDATE partner_apis SET failure_count = failure_count + 1, last_failure_at = CURRENT_TIMESTAMP WHERE id = ${log.partner_api_id}`);
      }
      
      res.json({ success: response.ok, status: response.status, latency });
    } catch (fetchError) {
      const latency = Date.now() - startTime;
      await db.execute(sql`
        UPDATE partner_distributions 
        SET status = 'failed', error_message = ${fetchError.message}, latency_ms = ${latency}, completed_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `);
      await db.execute(sql`UPDATE partner_apis SET failure_count = failure_count + 1, last_failure_at = CURRENT_TIMESTAMP WHERE id = ${log.partner_api_id}`);
      
      res.json({ success: false, error: fetchError.message, latency });
    }
  } catch (error) {
    console.error('Retry distribution error:', error.message);
    res.status(500).json({ error: 'Failed to retry distribution' });
  }
});

router.get('/distribution-stats', requireAuth, async (req, res) => {
  try {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'success') as success,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today
      FROM partner_distributions
    `);
    
    const byPartner = await db.execute(sql`
      SELECT pa.id, pa.name, 
        COUNT(pd.id) as total,
        COUNT(*) FILTER (WHERE pd.status = 'success') as success,
        COUNT(*) FILTER (WHERE pd.status = 'failed') as failed
      FROM partner_apis pa
      LEFT JOIN partner_distributions pd ON pa.id = pd.partner_api_id
      GROUP BY pa.id, pa.name
      ORDER BY total DESC
    `);
    
    res.json({
      overview: stats.rows?.[0] || { total: 0, success: 0, failed: 0, pending: 0, today: 0 },
      byPartner: byPartner.rows || [],
    });
  } catch (error) {
    console.error('Distribution stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch distribution stats' });
  }
});

export { requireAuth, requireRole, requireCSRF };
export default router;
