import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import geoip from 'geoip-lite';
import { db, pool } from './db.js';
import { submissions, adminUsers, submissionNotes, activityLogs, partialForms, adminIpBlacklist, accessLogs, adminDevices } from '../shared/schema.js';
import { eq, desc, sql, count, gte, and, like, or, asc, lt } from 'drizzle-orm';
import { getClientIP, parseUserAgent } from './utils/geoip.js';
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

    const reduceToObject = (items = [], keyField = 'status') => {
      const iterable = Array.isArray(items) ? items : [];
      return iterable.reduce((acc, entry) => {
        if (!entry) return acc;
        const key = entry[keyField];
        if (!key) return acc;
        acc[key] = parseNumber(entry.count);
        return acc;
      }, {});
    };

    const toArray = (items = [], mapper = () => ({})) => {
      const iterable = Array.isArray(items) ? items : [];
      return iterable
        .filter(Boolean)
        .map((entry) => ({
          ...entry,
          count: parseNumber(entry.count),
          ...mapper(entry),
        }));
    };

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
// Admin session süresi (30 dakika)
const SESSION_DURATION = 30 * 60 * 1000;
const SESSION_DURATION_MS = SESSION_DURATION;
const MAX_SESSIONS_PER_USER = 3;
const userSessionLimits = new Map(); // userId -> max sessions override
const knownDeviceFingerprints = new Map(); // userId -> Set<string>
let adminDevicesSupported = true;
const failedAttempts = new Map();
const LOCKOUT_DURATION = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 3;
const ipCountryCache = new Map();
const ipBanCache = new Map();
const IP_BAN_REASON = 'Exceeded admin login attempts';
const regionNameFormatter = new Intl.DisplayNames(['en'], { type: 'region' });
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';
const mfaAttempts = new Map(); // key: userId:ip -> { count, lockoutUntil }
const MAX_MFA_ATTEMPTS = 5;
const MFA_LOCK_MS = 5 * 60 * 1000;
let mfaSupported = true;
let partnerColumnSupported = true;
const authLog = (stage, meta = {}) => {
  try {
    console.warn('[auth]', stage, JSON.stringify(meta));
  } catch {
    console.warn('[auth]', stage, meta);
  }
};
 
async function ensurePartnerColumnSupport() {
  if (partnerColumnSupported === false) return false;
  try {
    const result = await db.execute(sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'admin_users'
        AND column_name = 'partner_api_id'
      LIMIT 1
    `);
    partnerColumnSupported = !!result?.rows?.length;
  } catch (error) {
    partnerColumnSupported = false;
    authLog('partner_column_check_error', { error: error?.message });
  }
  return partnerColumnSupported;
}

async function ensureMfaColumnSupport() {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'admin_users'
        AND column_name IN ('mfa_secret', 'mfa_enabled')
    `);
    const columnCount = Number(result?.rows?.[0]?.count || 0);
    const hasColumns = columnCount >= 2;
    mfaSupported = hasColumns;
  } catch (error) {
    mfaSupported = false;
    authLog('mfa_column_check_error', { error: error?.message });
  }
  return mfaSupported;
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  let output = '';
  buffer.forEach((byte) => {
    bits += byte.toString(2).padStart(8, '0');
    while (bits.length >= 5) {
      const chunk = bits.slice(0, 5);
      bits = bits.slice(5);
      output += BASE32_ALPHABET[parseInt(chunk, 2)];
    }
  });
  if (bits.length) {
    output += BASE32_ALPHABET[parseInt(bits.padEnd(5, '0'), 2)];
  }
  return output;
}

function base32Decode(input) {
  if (!input || typeof input !== 'string') return Buffer.alloc(0);
  const sanitized = input.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const char of sanitized) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateMfaSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret, counter) {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

function totp(secret, timestamp = Date.now()) {
  const step = 30;
  const counter = Math.floor(timestamp / 1000 / step);
  return hotp(secret, counter);
}

function verifyTotp(secret, token) {
  const code = token?.toString().trim();
  if (!code || code.length !== 6) return false;
  const now = Date.now();
  const windowMs = 30000;
  const secrets = [0, -1, 1].map((offset) => totp(secret, now + offset * windowMs));
  return secrets.includes(code);
}

function mfaKey(userId, ip) {
  return `${userId || 'anon'}:${ip || 'unknown'}`;
}

function recordMfaAttempt(userId, ip) {
  const key = mfaKey(userId, ip);
  const entry = mfaAttempts.get(key) || { count: 0, lockoutUntil: 0 };
  if (Date.now() < entry.lockoutUntil) return entry;
  entry.count += 1;
  if (entry.count >= MAX_MFA_ATTEMPTS) {
    entry.lockoutUntil = Date.now() + MFA_LOCK_MS;
  }
  mfaAttempts.set(key, entry);
  return entry;
}

function resetMfaAttempts(userId, ip) {
  mfaAttempts.delete(mfaKey(userId, ip));
}

function updateSessionMfaFlag(userId, enabled) {
  for (const [sid, session] of sessions.entries()) {
    if (session.user.id === userId) {
      session.user.mfaEnabled = enabled;
      session.mfaEnabled = enabled;
      sessions.set(sid, session);
    }
  }
}

async function fetchAdminUserSafe(username) {
  try {
    // Use a minimal raw query to avoid column mismatch issues
    const result = await db.execute(sql`
      SELECT 
        id,
        username,
        password_hash AS "passwordHash",
        role,
        last_login_at AS "lastLoginAt",
        last_login_ip AS "lastLoginIp",
        mfa_secret AS "mfaSecret",
        mfa_enabled AS "mfaEnabled"
      FROM admin_users
      WHERE username = ${username}
      LIMIT 1
    `);

    const user = result?.rows?.[0];
    if (!user) return null;

    return {
      ...user,
      partnerApiId: null,
      mfaSecret: user?.mfaSecret || null,
      mfaEnabled: (user?.mfaEnabled && mfaSupported) || false,
    };
  } catch (error) {
    authLog('login_db_error', { error: error?.message });
    throw error;
  }
}

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

const COUNTRY_CODE_OVERRIDES = {
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  'U.S.': 'US',
  'USA': 'US',
  'AMERICA': 'US',
  'US': 'US',
  'UNITED KINGDOM': 'GB',
  'GREAT BRITAIN': 'GB',
  'UK': 'GB',
  'BRITAIN': 'GB',
  'TURKEY': 'TR',
  'TURKIYE': 'TR',
  'TÜRKİYE': 'TR',
  'RUSSIA': 'RU',
  'SOUTH KOREA': 'KR',
  'KOREA, SOUTH': 'KR',
  'NORTH KOREA': 'KP',
  'KOREA, NORTH': 'KP',
  'UAE': 'AE',
  'UNITED ARAB EMIRATES': 'AE',
  'SAUDI ARABIA': 'SA',
  'VIETNAM': 'VN',
  'UKRAINE': 'UA',
};

function normalizeCountryCode(countryCode, countryName) {
  const normalizeCandidate = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');
  const codeCandidate = normalizeCandidate(countryCode);
  if (codeCandidate) {
    if (/^[A-Z]{2}$/.test(codeCandidate)) {
      return codeCandidate;
    }
    if (COUNTRY_CODE_OVERRIDES[codeCandidate]) {
      return COUNTRY_CODE_OVERRIDES[codeCandidate];
    }
  }

  const nameCandidate = normalizeCandidate(countryName);
  if (nameCandidate) {
    if (COUNTRY_CODE_OVERRIDES[nameCandidate]) {
      return COUNTRY_CODE_OVERRIDES[nameCandidate];
    }
    if (/^[A-Z]{2}$/.test(nameCandidate)) {
      return nameCandidate;
    }
  }

  return null;
}

function formatCountryLabel(countryCode, countryName) {
  if (countryName && countryName !== 'Unknown') return countryName;
  if (countryCode && /^[A-Z]{2}$/.test(countryCode)) {
    try {
      const resolved = regionNameFormatter.of(countryCode);
      if (resolved && resolved !== 'Unknown') return resolved;
    } catch {
      // ignore
    }
  }
  return countryName || countryCode || 'Unknown';
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

function getMaxSessionsForUser(userId) {
  return userSessionLimits.get(userId) || MAX_SESSIONS_PER_USER;
}

function buildDeviceLabel(parsedUA) {
  const parts = [];
  if (parsedUA?.device || parsedUA?.os) {
    parts.push(parsedUA.device || parsedUA.os);
  }
  if (parsedUA?.browser) {
    parts.push(parsedUA.browser);
  }
  return parts.join(' · ').trim() || 'Unknown device';
}

function createDeviceFingerprint(ip, parsedUA) {
  const safeIP = ip || 'unknown-ip';
  const devicePart = parsedUA?.device || parsedUA?.os || 'unknown-device';
  const browserPart = parsedUA?.browser || 'unknown-browser';
  return `${safeIP}|${devicePart}|${browserPart}`;
}

async function findDeviceRecord(adminId, fingerprint) {
  if (!adminDevicesSupported || !adminId || !fingerprint) return null;
  try {
    const [row] = await db
      .select({
        id: adminDevices.id,
        deviceName: adminDevices.deviceName,
        fingerprint: adminDevices.fingerprint,
      })
      .from(adminDevices)
      .where(and(eq(adminDevices.adminId, adminId), eq(adminDevices.fingerprint, fingerprint)))
      .limit(1);
    return row || null;
  } catch (error) {
    adminDevicesSupported = false;
    console.warn('admin_devices lookup disabled:', error?.message || error);
    return null;
  }
}

async function upsertDeviceRecord(adminId, fingerprint, deviceName) {
  if (!adminDevicesSupported || !adminId || !fingerprint) return null;
  try {
    const safeName = sanitizeInput(deviceName || 'Device').slice(0, 255) || 'Device';
    const existing = await findDeviceRecord(adminId, fingerprint);
    if (existing) {
      await db
        .update(adminDevices)
        .set({ deviceName: safeName, lastSeenAt: new Date() })
        .where(and(eq(adminDevices.adminId, adminId), eq(adminDevices.fingerprint, fingerprint)));
      return { ...existing, deviceName: safeName };
    }
    await db.insert(adminDevices).values({
      adminId,
      fingerprint,
      deviceName: safeName,
      lastSeenAt: new Date(),
    });
    return { deviceName: safeName, fingerprint };
  } catch (error) {
    adminDevicesSupported = false;
    console.warn('admin_devices upsert disabled:', error?.message || error);
    return null;
  }
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
    const normalizedDetails = (details && typeof details === 'object') ? details : null;
    const safeDetails = normalizedDetails && Object.keys(normalizedDetails).length ? normalizedDetails : null;
    const payload = {
      action,
      entityType,
      entityId,
      adminId: adminUser?.id,
      adminUsername: adminUser?.username,
      details: safeDetails,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent']?.substring(0, 500),
    };

    await db.insert(activityLogs).values(payload);
  } catch (error) {
    console.error('Failed to log activity:', error.message);
  }
}

async function isAccountLocked(ip) {
  if (!ip) return false;
  if (await isIpBanned(ip)) return true;

  const attempts = failedAttempts.get(ip);
  if (!attempts) return false;

  if (Date.now() > attempts.lockoutUntil) {
    failedAttempts.delete(ip);
    return false;
  }

  return attempts.count >= MAX_FAILED_ATTEMPTS;
}

async function recordFailedAttempt(ip) {
  if (!ip) return false;
  const attempts = failedAttempts.get(ip) || { count: 0, lockoutUntil: 0 };
  attempts.count++;

  if (attempts.count >= MAX_FAILED_ATTEMPTS) {
    await banIpAddress(ip, IP_BAN_REASON, 'system');
    return true;
  }

  attempts.lockoutUntil = Date.now() + LOCKOUT_DURATION;
  failedAttempts.set(ip, attempts);
  return false;
}

function clearFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

async function loadIpBanEntry(ip) {
  if (!ip) return null;
  if (ipBanCache.has(ip)) {
    return ipBanCache.get(ip);
  }
  const [entry] = await db.select({
    id: adminIpBlacklist.id,
    ipAddress: adminIpBlacklist.ipAddress,
    reason: adminIpBlacklist.reason,
    createdBy: adminIpBlacklist.createdBy,
    createdAt: adminIpBlacklist.createdAt,
  }).from(adminIpBlacklist).where(eq(adminIpBlacklist.ipAddress, ip)).limit(1);
  ipBanCache.set(ip, entry || null);
  return entry || null;
}

async function isIpBanned(ip) {
  const entry = await loadIpBanEntry(ip);
  return !!entry;
}

async function banIpAddress(ip, reason = IP_BAN_REASON, createdBy = 'system') {
  if (!ip) return;
  try {
    await db.execute(sql`
      INSERT INTO public.admin_ip_blacklist (ip_address, reason, created_by)
      VALUES (${ip}, ${reason}, ${createdBy})
      ON CONFLICT (ip_address) DO UPDATE
      SET reason = EXCLUDED.reason,
          created_by = EXCLUDED.created_by,
          created_at = now();
    `);
  } catch (error) {
    console.error('Failed to write IP blacklist entry:', error);
  } finally {
    failedAttempts.delete(ip);
    ipBanCache.set(ip, { ipAddress: ip, reason, createdBy, createdAt: new Date() });
  }
}

async function unbanIpAddress(ip) {
  if (!ip) return;
  try {
    await db.execute(sql`
      DELETE FROM public.admin_ip_blacklist
      WHERE ip_address = ${ip}
    `);
  } catch (error) {
    console.error('Failed to remove IP blacklist entry:', error);
  } finally {
    failedAttempts.delete(ip);
    ipBanCache.delete(ip);
  }
}

async function fetchBlacklistEntries() {
  return db.select({
    id: adminIpBlacklist.id,
    ipAddress: adminIpBlacklist.ipAddress,
    reason: adminIpBlacklist.reason,
    createdBy: adminIpBlacklist.createdBy,
    createdAt: adminIpBlacklist.createdAt,
  })
  .from(adminIpBlacklist)
  .orderBy(desc(adminIpBlacklist.createdAt));
}

async function requireAuth(req, res, next) {
  const sessionId = req.cookies?.adminSession || req.headers['x-session-id'];
  const session = sessions.get(sessionId);
  
  if (!session || Date.now() > session.expiresAt) {
    authLog('auth_fail_no_session', { path: req.path, sid: sessionId, hasSession: !!session });
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
    
    if (await isAccountLocked(clientIP)) {
      return res.status(429).json({ 
        error: 'Too many failed attempts. Please try again in 15 minutes.' 
      });
    }
    
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    let { username, password } = req.body;
    username = typeof username === 'string' ? username : '';
    password = typeof password === 'string' ? password : '';
    
    username = sanitizeInput(username);
    authLog('login_start', { username, ip: clientIP });
    
    if (!username || !password) {
      authLog('login_missing_fields', { username, ip: clientIP });
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    if (username.length > 50 || password.length > 100) {
      authLog('login_invalid_lengths', { username, ip: clientIP });
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    await ensurePartnerColumnSupport();
    await ensureMfaColumnSupport();

    let user = await fetchAdminUserSafe(username);

    // Bootstrap admin if missing or missing password hash
    const bootstrapUser = process.env.ADMIN_BOOTSTRAP_USER || 'admin';
    const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!user && bootstrapPassword && username === bootstrapUser) {
      const hash = await bcrypt.hash(bootstrapPassword, 12);
      const [created] = await db.insert(adminUsers).values({
        username: bootstrapUser,
        passwordHash: hash,
        role: 'admin',
      }).returning();
      user = { ...created };
      authLog('login_bootstrap_created', { username, ip: clientIP });
    } else if (user && !user.passwordHash && bootstrapPassword && username === bootstrapUser) {
      const hash = await bcrypt.hash(bootstrapPassword, 12);
      await db.update(adminUsers).set({ passwordHash: hash }).where(eq(adminUsers.id, user.id));
      user.passwordHash = hash;
      authLog('login_bootstrap_reset', { username, ip: clientIP });
    }

    if (!user) {
      authLog('login_user_not_found', { username, ip: clientIP });
      const bannedNow = await recordFailedAttempt(clientIP);
      await logActivity('login_failed', 'admin', null, null, req, { username, reason: 'user_not_found' });
      if (bannedNow) {
        await logActivity('ip_banned', 'security', null, null, req, { ipAddress: clientIP, reason: IP_BAN_REASON });
        return res.status(403).json({ error: 'Too many failed attempts. Your IP has been blocked.' });
      }
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!user.passwordHash) {
      authLog('login_missing_hash', { username, ip: clientIP });
      return res.status(500).json({ error: 'Authentication failed' });
    }
    if (!user.passwordHash) {
      authLog('login_missing_hash', { username, ip: clientIP });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, user.passwordHash);
    } catch (err) {
      authLog('login_hash_error', { username, ip: clientIP, error: err?.message });
      return res.status(500).json({ error: 'Authentication failed' });
    }
    
    if (!isValid) {
      authLog('login_wrong_password', { username, ip: clientIP });
      const bannedNow = await recordFailedAttempt(clientIP);
      await logActivity('login_failed', 'admin', user.id, null, req, { username, reason: 'wrong_password' });
      if (bannedNow) {
        await logActivity('ip_banned', 'security', user.id, null, req, { ipAddress: clientIP, reason: IP_BAN_REASON });
        return res.status(403).json({ error: 'Too many failed attempts. Your IP has been blocked.' });
      }
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    clearFailedAttempts(clientIP);

    const mfaEnabled = mfaSupported && user.mfaEnabled;
    const otp = req.body?.otp;

    if (mfaEnabled) {
      const attempt = recordMfaAttempt(user.id, clientIP);
      if (Date.now() < attempt.lockoutUntil) {
        return res.status(429).json({
          error: 'Too many MFA attempts. Please try again in a few minutes.',
          requiresMfa: true,
        });
      }
      if (!otp) {
        authLog('login_mfa_required', { username, ip: clientIP });
        return res.status(401).json({
          error: 'Authentication code required',
          requiresMfa: true,
        });
      }
      if (!verifyTotp(user.mfaSecret, otp)) {
        authLog('login_mfa_invalid', { username, ip: clientIP });
        recordMfaAttempt(user.id, clientIP);
        return res.status(401).json({
          error: 'Invalid authentication code',
          requiresMfa: true,
        });
      }
      resetMfaAttempts(user.id, clientIP);
    }

    const parsedUA = parseUserAgent(req.headers['user-agent']?.substring(0, 500));
    const deviceNameRaw = typeof req.body?.deviceName === 'string' ? req.body.deviceName : '';
    const fingerprint = createDeviceFingerprint(clientIP, parsedUA);
    const deviceSet = knownDeviceFingerprints.get(user.id) || new Set();
    const existingDevice = await findDeviceRecord(user.id, fingerprint);
    const isNewDevice = !existingDevice && !deviceSet.has(fingerprint);
    const deviceName = sanitizeInput(deviceNameRaw || existingDevice?.deviceName || buildDeviceLabel(parsedUA));
    deviceSet.add(fingerprint);
    knownDeviceFingerprints.set(user.id, deviceSet);

    let userSessionCount = 0;
    const maxSessions = getMaxSessionsForUser(user.id);
    const userSessions = [];
    for (const [sid, session] of sessions.entries()) {
      if (session.user.id === user.id) {
        userSessionCount++;
        userSessions.push({ sid, createdAt: session.createdAt });
      }
    }

    if (userSessionCount >= maxSessions) {
      const sorted = userSessions.sort((a, b) => a.createdAt - b.createdAt); // oldest first
      while (sorted.length >= maxSessions) {
        const victim = sorted.shift();
        if (victim) {
          sessions.delete(victim.sid);
          userSessionCount--;
        }
      }
    }
    
    const sessionId = generateSecureSessionId();
    const csrfToken = generateCSRFToken();
    
    const sessionUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      partnerApiId: user.partnerApiId || null,
      mfaEnabled,
    };

    const sessionGeo = await getGeoForIP(clientIP);
    await upsertDeviceRecord(user.id, fingerprint, deviceName);

    sessions.set(sessionId, {
      user: sessionUser,
      expiresAt: Date.now() + SESSION_DURATION,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ipAddress: clientIP,
      userAgent: req.headers['user-agent']?.substring(0, 500),
      deviceName,
      deviceFingerprint: fingerprint,
      newDevice: isNewDevice,
      geo: sessionGeo,
      csrfToken,
    });
    
    await db.update(adminUsers)
      .set({ lastLoginAt: new Date(), lastLoginIp: clientIP })
      .where(eq(adminUsers.id, user.id));
    await logActivity('login_success', 'admin', user.id, sessionUser, req, { deviceName, newDevice: isNewDevice });
    if (isNewDevice) {
      await logActivity('new_device_login', 'security', user.id, sessionUser, req, {
        deviceName,
        ipAddress: clientIP,
      });
      authLog('login_new_device', { username, ip: clientIP, deviceName });
    }
    authLog('login_success', { username, ip: clientIP, deviceName });
    
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
      user: sessionUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    authLog('login_exception', { error: error?.message, stack: error?.stack });
    res.status(500).json({
      error: 'Authentication failed',
      detail: error?.message || 'unknown',
      ...(DEBUG_AUTH ? { stack: error?.stack } : { stack: error?.stack }),
    });
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

router.get('/blacklist', requireAuth, async (req, res) => {
  try {
    const entries = await fetchBlacklistEntries();
    res.json({ blacklist: entries });
  } catch (error) {
    console.error('Blacklist fetch error:', error.message);
    res.status(500).json({ error: 'Failed to load blacklist' });
  }
});

router.post('/blacklist', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const ipAddressRaw = req.body?.ipAddress;
    const reasonRaw = req.body?.reason;
    const ipAddress = ipAddressRaw ? sanitizeInput(String(ipAddressRaw)) : '';
    const reason = reasonRaw ? sanitizeInput(String(reasonRaw)) : 'Manual block';

    if (!ipAddress) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    await banIpAddress(ipAddress, reason, req.adminUser?.username || 'admin');
    await logActivity('ip_banned', 'security', req.adminUser.id, req.adminUser, req, { ipAddress, reason });

    const entries = await fetchBlacklistEntries();
    res.json({ success: true, blacklist: entries });
  } catch (error) {
    console.error('Blacklist create error:', error.message);
    res.status(500).json({ error: 'Failed to add blacklist entry' });
  }
});

router.delete('/blacklist/:ip', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    const ipAddress = req.params?.ip ? sanitizeInput(String(req.params.ip)) : '';
    if (!ipAddress) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    await unbanIpAddress(ipAddress);
    await logActivity('ip_unbanned', 'security', req.adminUser.id, req.adminUser, req, { ipAddress });

    const entries = await fetchBlacklistEntries();
    res.json({ success: true, blacklist: entries });
  } catch (error) {
    console.error('Blacklist delete error:', error.message);
    res.status(500).json({ error: 'Failed to remove blacklist entry' });
  }
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
      photoUrls: submissions.photos,
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
      submissions: enrichedSubmissions,
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
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalRows = await db.select({ total: count() }).from(submissions);
    const todayRows = await db.select({ todayCount: count() }).from(submissions).where(gte(submissions.createdAt, today));
    const weekRows = await db.select({ weekCount: count() }).from(submissions).where(gte(submissions.createdAt, weekAgo));
    const monthRows = await db.select({ monthCount: count() }).from(submissions).where(gte(submissions.createdAt, monthAgo));
    const total = Number(totalRows[0]?.total ?? 0);
    const todayCount = Number(todayRows[0]?.todayCount ?? 0);
    const weekCount = Number(weekRows[0]?.weekCount ?? 0);
    const monthCount = Number(monthRows[0]?.monthCount ?? 0);

    const newFreshRows = await db.select({ count: count() }).from(submissions)
      .where(and(eq(submissions.status, 'new'), gte(submissions.createdAt, threeHoursAgo)));
    const newTodayRows = await db.select({ count: count() }).from(submissions)
      .where(and(eq(submissions.status, 'new'), gte(submissions.createdAt, oneDayAgo), lt(submissions.createdAt, threeHoursAgo)));
    const newYesterdayRows = await db.select({ count: count() }).from(submissions)
      .where(and(eq(submissions.status, 'new'), gte(submissions.createdAt, twoDaysAgo), lt(submissions.createdAt, oneDayAgo)));
    const newOlderRows = await db.select({ count: count() }).from(submissions)
      .where(and(eq(submissions.status, 'new'), lt(submissions.createdAt, twoDaysAgo)));
    const newStatusBuckets = {
      fresh: Number(newFreshRows[0]?.count ?? 0),
      today: Number(newTodayRows[0]?.count ?? 0),
      yesterday: Number(newYesterdayRows[0]?.count ?? 0),
      older: Number(newOlderRows[0]?.count ?? 0),
    };

    const earliestRows = await db.select({ earliestCreatedAt: sql`MIN(${submissions.createdAt})` }).from(submissions);
    const earliestCreatedAt = earliestRows[0]?.earliestCreatedAt ?? null;
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
    const missingCountryRowsCount = await db.select({ missingCountryCount: count() }).from(submissions).where(missingCountryCondition);
    const missingCountryCount = Number(missingCountryRowsCount[0]?.missingCountryCount ?? 0);
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

    const deviceModelRows = await db.select({
      deviceType: submissions.deviceType,
      deviceModel: submissions.device,
      count: count(),
    }).from(submissions)
      .where(sql`${submissions.device} IS NOT NULL AND ${submissions.device} <> ''`)
      .groupBy(submissions.deviceType, submissions.device)
      .orderBy(desc(count()));

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
      .groupBy(sql`EXTRACT(HOUR FROM (${submissions.createdAt} AT TIME ZONE 'America/New_York'))`)
      .orderBy(sql`EXTRACT(HOUR FROM (${submissions.createdAt} AT TIME ZONE 'America/New_York'))`);

    const weekdayDistribution = await db.select({
      weekday: sql`EXTRACT(DOW FROM ${submissions.createdAt})`.as('weekday'),
      count: count(),
    }).from(submissions)
      .groupBy(sql`EXTRACT(DOW FROM ${submissions.createdAt})`)
      .orderBy(sql`EXTRACT(DOW FROM ${submissions.createdAt})`);

    const usCountryCondition = sql`
      (
        ${submissions.countryCode} IN ('US', 'UNITED STATES', 'USA', 'U.S.')
        OR LOWER(${submissions.country}) = 'united states'
      )
    `;

    const usStateCounts = await db.select({
      state: submissions.region,
      count: count(),
    }).from(submissions)
      .where(and(
        usCountryCondition,
        sql`${submissions.region} IS NOT NULL`
      ))
      .groupBy(submissions.region)
      .orderBy(desc(count()));

    const partialDraftRows = await db.select({ partialDraftCount: count() }).from(partialForms);
    const finalPartialDrafts = Number(partialDraftRows[0]?.partialDraftCount ?? 0);

    const countryTotals = new Map();
    const addCountryEntry = (entry) => {
      const count = Number(entry.count || 0);
      if (count <= 0) return;
      const normalizedCode = normalizeCountryCode(entry.countryCode, entry.country);
      const label = formatCountryLabel(normalizedCode, entry.country);
      const key = normalizedCode || label || 'Unknown';
      const existing = countryTotals.get(key);
      countryTotals.set(key, {
        country: label,
        countryCode: normalizedCode || existing?.countryCode || key,
        count: (existing?.count || 0) + count,
      });
    };

    countryCounts.forEach(addCountryEntry);
    inferredCountries.forEach((entry) => addCountryEntry({ ...entry, count: entry.count || 1 }));
    const leftoverUnknown = Math.max(0, (missingCountryCount || 0) - inferredCountTotal);
    if (leftoverUnknown > 0) {
      addCountryEntry({ country: 'Unknown', countryCode: 'XX', count: leftoverUnknown });
    }
    const mergedCountries = Array.from(countryTotals.values()).sort((a, b) => b.count - a.count);

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

    const topDeviceModels = {};
    deviceModelRows.forEach((row) => {
      if (!row.deviceType || !row.deviceModel) return;
      const key = row.deviceType;
      if (!topDeviceModels[key] || (row.count || 0) > (topDeviceModels[key].count || 0)) {
        topDeviceModels[key] = {
          model: row.deviceModel,
          count: Number(row.count || 0),
        };
      }
    });

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
      partialDrafts: finalPartialDrafts,
      newStatusBuckets,
      topDeviceModels,
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
    const countResult = await countQuery;
    const total = Number(countResult[0]?.total ?? 0);
    
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

router.get('/access-logs', requireAuth, async (req, res) => {
  try {
    let { limit = 100 } = req.query;
    limit = Math.max(1, Math.min(parseInt(limit) || 100, 500));

    const logs = await db
      .select({
        id: accessLogs.id,
        sessionId: accessLogs.sessionId,
        userIp: accessLogs.userIp,
        country: accessLogs.country,
        city: accessLogs.city,
        path: accessLogs.path,
        method: accessLogs.method,
        referer: accessLogs.referer,
        enteredAt: accessLogs.enteredAt,
        leftAt: accessLogs.leftAt,
        createdAt: accessLogs.createdAt,
        statusCode: accessLogs.statusCode,
        latencyMs: accessLogs.latencyMs,
        userAgent: accessLogs.userAgent,
      })
      .from(accessLogs)
      .orderBy(desc(accessLogs.createdAt))
      .limit(limit);

    res.json({ logs });
  } catch (error) {
    console.error('Access logs fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch access logs' });
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

router.post('/mfa/enroll', requireAuth, requireCSRF, async (req, res) => {
  try {
    const supported = await ensureMfaColumnSupport();
    if (!supported) {
      return res.status(400).json({ error: 'MFA is not configured on the server. Add mfa_secret and mfa_enabled columns to admin_users.' });
    }

    const secret = generateMfaSecret();
    await db.update(adminUsers)
      .set({ mfaSecret: secret, mfaEnabled: false })
      .where(eq(adminUsers.id, req.adminUser.id));

    const otpAuthUrl = `otpauth://totp/MIYOMINT:${encodeURIComponent(req.adminUser.username)}?secret=${secret}&issuer=MIYOMINT`;
    res.json({ secret, otpAuthUrl });
  } catch (error) {
    console.error('MFA enroll error:', error);
    res.status(500).json({ error: 'Failed to start MFA enrollment', detail: error?.message || 'unknown' });
  }
});

router.post('/mfa/verify', requireAuth, requireCSRF, async (req, res) => {
  try {
    const supported = await ensureMfaColumnSupport();
    if (!supported) {
      return res.status(400).json({ error: 'MFA is not configured on the server. Add mfa_secret and mfa_enabled columns to admin_users.' });
    }

    const code = (req.body?.otp || req.body?.code || '').toString().trim();
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Authentication code is required' });
    }

    const [user] = await db.select({
      mfaSecret: adminUsers.mfaSecret,
    }).from(adminUsers).where(eq(adminUsers.id, req.adminUser.id));

    if (!user?.mfaSecret) {
      return res.status(400).json({ error: 'Enroll MFA before verification' });
    }

    const attempt = recordMfaAttempt(req.adminUser.id, getClientIP(req));
    if (Date.now() < attempt.lockoutUntil) {
      return res.status(429).json({ error: 'Too many MFA attempts. Please try again later.' });
    }

    if (!verifyTotp(user.mfaSecret, code)) {
      recordMfaAttempt(req.adminUser.id, getClientIP(req));
      return res.status(401).json({ error: 'Invalid authentication code' });
    }

    resetMfaAttempts(req.adminUser.id, getClientIP(req));

    await db.update(adminUsers)
      .set({ mfaEnabled: true })
      .where(eq(adminUsers.id, req.adminUser.id));

    updateSessionMfaFlag(req.adminUser.id, true);
    res.json({ success: true });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({ error: 'Failed to verify MFA', detail: error?.message || 'unknown' });
  }
});

router.post('/mfa/disable', requireAuth, requireCSRF, async (req, res) => {
  try {
    const supported = await ensureMfaColumnSupport();
    if (!supported) {
      updateSessionMfaFlag(req.adminUser.id, false);
      return res.json({ success: true, supported: false });
    }

    await db.update(adminUsers)
      .set({ mfaSecret: null, mfaEnabled: false })
      .where(eq(adminUsers.id, req.adminUser.id));

    resetMfaAttempts(req.adminUser.id, getClientIP(req));
    updateSessionMfaFlag(req.adminUser.id, false);
    res.json({ success: true, supported: true });
  } catch (error) {
    console.error('MFA disable error:', error.message);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

router.get('/mfa/status', requireAuth, async (req, res) => {
  try {
    const supported = await ensureMfaColumnSupport();
    if (!supported) {
      return res.json({ enabled: false, supported: false });
    }

    const [user] = await db.select({
      enabled: adminUsers.mfaEnabled,
    }).from(adminUsers).where(eq(adminUsers.id, req.adminUser.id));

    res.json({ enabled: !!user?.enabled, supported: true });
  } catch (error) {
    console.error('MFA status error:', error.message);
    res.status(500).json({ error: 'Failed to fetch MFA status' });
  }
});

router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const results = [];
    const jobs = [];

    for (const [id, session] of sessions.entries()) {
      if (session.user.id !== req.adminUser.id) continue;

      jobs.push((async () => {
        if (!session.geo) {
          session.geo = await getGeoForIP(session.ipAddress);
        }
        let storedDevice = null;
        if (session.deviceFingerprint) {
          storedDevice = await findDeviceRecord(req.adminUser.id, session.deviceFingerprint);
          if (storedDevice?.deviceName) {
            session.deviceName = storedDevice.deviceName;
            session.newDevice = false;
          }
          if (storedDevice) {
            await upsertDeviceRecord(req.adminUser.id, session.deviceFingerprint, session.deviceName || storedDevice.deviceName);
          }
        }
        const location = session.geo
          ? {
              city: session.geo.city,
              country: session.geo.country,
              countryCode: session.geo.country_code || session.geo.countryCode,
              region: session.geo.region,
              timezone: session.geo.timezone,
            }
          : null;

        results.push({
          sessionId: id,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          deviceName: session.deviceName,
          deviceFingerprint: session.deviceFingerprint,
          newDevice: !!session.newDevice,
          location,
          current: id === req.sessionId,
        });
      })());
    }

    await Promise.all(jobs);

    res.json({ sessions: results });
  } catch (error) {
    console.error('Session list error:', error?.message || error);
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

router.post('/sessions/revoke', requireAuth, requireCSRF, (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const session = sessions.get(sessionId);
  if (!session || session.user.id !== req.adminUser.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  sessions.delete(sessionId);
  res.json({ success: true });
});

router.post('/sessions/revoke-all', requireAuth, requireCSRF, (req, res) => {
  let removed = 0;
  let currentRevoked = false;
  for (const [id, session] of sessions.entries()) {
    if (session.user.id === req.adminUser.id) {
      sessions.delete(id);
      removed++;
      if (id === req.sessionId) currentRevoked = true;
    }
  }
  res.clearCookie('adminSession', { path: '/' });
  res.json({ success: true, removed, currentRevoked });
});

router.post('/sessions/label', requireAuth, requireCSRF, (req, res) => {
  const { sessionId, deviceName } = req.body || {};
  if (!sessionId || typeof deviceName !== 'string') {
    return res.status(400).json({ error: 'sessionId and deviceName required' });
  }
  const session = sessions.get(sessionId);
  if (!session || session.user.id !== req.adminUser.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (!session.deviceFingerprint) {
    return res.status(400).json({ error: 'No device fingerprint on session' });
  }
  if (!adminDevicesSupported) {
    return res.status(400).json({ error: 'Device labeling disabled (schema missing)' });
  }
  const safeName = sanitizeInput(deviceName).slice(0, 120) || 'Device';
  session.deviceName = safeName;
  session.newDevice = false;
  const setForUser = knownDeviceFingerprints.get(req.adminUser.id) || new Set();
  setForUser.add(session.deviceFingerprint);
  knownDeviceFingerprints.set(req.adminUser.id, setForUser);
  upsertDeviceRecord(req.adminUser.id, session.deviceFingerprint, safeName).catch(() => {});
  res.json({ success: true, deviceName: safeName });
});

router.get('/session-policy', requireAuth, (req, res) => {
  const maxSessions = getMaxSessionsForUser(req.adminUser.id);
  res.json({ maxSessions, defaultMax: MAX_SESSIONS_PER_USER });
});

router.post('/session-policy', requireAuth, requireCSRF, (req, res) => {
  const maxSessionsRaw = req.body?.maxSessions;
  const parsed = parseInt(maxSessionsRaw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) {
    return res.status(400).json({ error: 'maxSessions must be between 1 and 10' });
  }
  userSessionLimits.set(req.adminUser.id, parsed);
  res.json({ success: true, maxSessions: parsed });
});

router.get('/security/signals', requireAuth, async (req, res) => {
  const ip = getClientIP(req);
  const attempts = failedAttempts.get(ip) || null;
  const banned = await isIpBanned(ip);
  const lockoutRemaining = attempts?.lockoutUntil ? Math.max(0, attempts.lockoutUntil - Date.now()) : 0;
  res.json({
    ip,
    failedAttempts: attempts?.count || 0,
    lockoutUntil: attempts?.lockoutUntil || null,
    lockoutRemaining,
    isBanned: !!banned,
  });
});

router.get('/security/events', requireAuth, async (req, res) => {
  try {
    let { limit = 10 } = req.query;
    limit = Math.max(1, Math.min(parseInt(limit, 10) || 10, 50));
    const actions = ['login_success', 'logout', 'ip_banned', 'ip_unbanned', 'new_device_login', 'session_ip_mismatch', 'ip_banned_manual'];
    const rows = await db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.adminId, req.adminUser.id), or(...actions.map((a) => eq(activityLogs.action, a)))))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    res.json({ events: rows });
  } catch (error) {
    console.error('Security events error:', error?.message || error);
    res.status(500).json({ error: 'Failed to load security events' });
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
    await ensurePartnerColumnSupport();

    const result = partnerColumnSupported
      ? await db.execute(sql`
        SELECT 
          au.id,
          au.username,
          au.role,
          au.created_at,
          au.last_login_at,
          au.last_login_ip,
          au.partner_api_id,
          pa.name as partner_name
        FROM admin_users au
        LEFT JOIN partner_apis pa ON au.partner_api_id = pa.id
        ORDER BY au.created_at DESC
      `)
      : await db.execute(sql`
        SELECT 
          id,
          username,
          role,
          created_at,
          last_login_at,
          last_login_ip
        FROM admin_users
        ORDER BY created_at DESC
      `);

    const users = (result.rows || []).map((row) => ({
      id: row.id,
      username: row.username,
      role: row.role,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      lastLoginIp: row.last_login_ip,
      partnerApiId: partnerColumnSupported ? row.partner_api_id : null,
      partnerName: partnerColumnSupported ? row.partner_name : null,
    }));

    res.json({ users });
  } catch (error) {
    console.error('Admin users error:', error.message);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

router.post('/admin-users', requireAuth, requireRole('admin'), requireCSRF, async (req, res) => {
  try {
    let { username, password, role, partnerApiId } = req.body;

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
        error: 'Password must contain uppercase, lowercase, number, and special character',
      });
    }

    const allowedRoles = ['admin', 'editor', 'viewer', 'partner_owner'];
    if (!allowedRoles.includes(role)) {
      role = 'viewer';
    }

    await ensurePartnerColumnSupport();

    let assignedPartnerId = null;
    if (role === 'partner_owner') {
      if (!partnerColumnSupported) {
        return res.status(400).json({ error: 'Partner assignment is not configured on this deployment.' });
      }
      const parsedPartnerId = Number.parseInt(partnerApiId, 10);
      if (!Number.isFinite(parsedPartnerId) || parsedPartnerId < 1) {
        return res.status(400).json({ error: 'Partner selection is required for partner owners' });
      }
      const partnerExists = await db.execute(sql`
        SELECT id FROM partner_apis WHERE id = ${parsedPartnerId}
      `);
      if (!partnerExists.rows?.[0]) {
        return res.status(400).json({ error: 'Selected partner was not found' });
      }
      assignedPartnerId = parsedPartnerId;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const insertData = {
      username,
      passwordHash,
      role,
      ...(partnerColumnSupported && assignedPartnerId ? { partnerApiId: assignedPartnerId } : {}),
    };

    const returningShape = {
      id: adminUsers.id,
      username: adminUsers.username,
      role: adminUsers.role,
      createdAt: adminUsers.createdAt,
      ...(partnerColumnSupported ? { partnerApiId: adminUsers.partnerApiId } : {}),
    };

    const [newUser] = await db.insert(adminUsers).values(insertData).returning(returningShape);

    await logActivity('create_admin_user', 'admin', newUser.id, req.adminUser, req, {
      username,
      role,
      partnerApiId: partnerColumnSupported ? assignedPartnerId : null,
    });

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
      SELECT 
        p.*,
        aw.id AS workflow_id,
        aw.name AS workflow_name,
        aw.is_active AS workflow_active
      FROM partner_apis p
      LEFT JOIN partner_workflows pw ON pw.partner_api_id = p.id
      LEFT JOIN automation_workflows aw ON aw.id = pw.workflow_id
      ORDER BY p.created_at DESC
    `);

    const partners = (result.rows || []).map((row) => {
      const {
        workflow_id,
        workflow_name,
        workflow_active,
        ...base
      } = row;
      return {
        ...base,
        workflow: workflow_id
          ? { id: workflow_id, name: workflow_name, isActive: Boolean(workflow_active) }
          : null,
      };
    });

    res.json({ partners });
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
    
    const [partner] = result.rows || [];
    if (partner) {
      try {
        const workflowId = crypto.randomUUID();
        const workflowName = `Partner: ${name}`;
        await pool.query(
          `INSERT INTO automation_workflows (id, name, is_active, nodes, edges) VALUES ($1, $2, TRUE, '[]'::jsonb, '[]'::jsonb)`,
          [workflowId, workflowName],
        );
        await pool.query(
          `INSERT INTO partner_workflows (partner_api_id, workflow_id) VALUES ($1, $2)`,
          [partner.id, workflowId],
        );
        partner.workflow = { id: workflowId, name: workflowName, isActive: true };
      } catch (workflowError) {
        console.warn('Failed to create workflow for partner:', workflowError?.message || workflowError);
      }
      await logActivity('create_partner', 'partner', partner.id, req.adminUser, req, { name });
      res.json({ partner });
      return;
    }

    res.status(500).json({ error: 'Failed to create partner' });
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

    const conditions = [];
    const params = [];

    const isPartnerBound = Boolean(req.adminUser?.partnerApiId);
    const requestedPartnerId = partnerId && partnerId !== 'all' ? Number.parseInt(partnerId, 10) : null;
    let effectivePartnerId = null;

    if (isPartnerBound) {
      effectivePartnerId = req.adminUser.partnerApiId;
    } else if (requestedPartnerId) {
      effectivePartnerId = requestedPartnerId;
    }

    if (effectivePartnerId) {
      params.push(effectivePartnerId);
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

router.get('/stats/daily-top-categories', requireAuth, async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT day, category, count FROM (
        SELECT 
          DATE(${submissions.createdAt}) AS day,
          ${submissions.serviceType} AS category,
          COUNT(*) AS count,
          ROW_NUMBER() OVER (PARTITION BY DATE(${submissions.createdAt}) ORDER BY COUNT(*) DESC) AS rn
        FROM ${submissions}
        GROUP BY DATE(${submissions.createdAt}), ${submissions.serviceType}
      ) t
      WHERE rn = 1
      ORDER BY day ASC
      LIMIT 30;
    `);
    res.json(rows);
  } catch (error) {
    console.error('Daily top categories error:', error.message);
    res.status(500).json({ error: 'Failed to fetch daily top categories' });
  }
});

router.get('/distribution-stats', requireAuth, async (req, res) => {
  try {
    const partnerFilter = req.adminUser?.partnerApiId
      ? sql`WHERE pd.partner_api_id = ${req.adminUser.partnerApiId}`
      : sql``;

    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'success') as success,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today
      FROM partner_distributions pd
      ${partnerFilter}
    `);

    let byPartner;
    if (req.adminUser?.partnerApiId) {
      byPartner = await db.execute(sql`
        SELECT pa.id, pa.name, 
          COUNT(pd.id) as total,
          COUNT(*) FILTER (WHERE pd.status = 'success') as success,
          COUNT(*) FILTER (WHERE pd.status = 'failed') as failed
        FROM partner_apis pa
        LEFT JOIN partner_distributions pd ON pa.id = pd.partner_api_id AND pa.id = ${req.adminUser.partnerApiId}
        WHERE pa.id = ${req.adminUser.partnerApiId}
        GROUP BY pa.id, pa.name
        ORDER BY total DESC
      `);
    } else {
      byPartner = await db.execute(sql`
        SELECT pa.id, pa.name, 
          COUNT(pd.id) as total,
          COUNT(*) FILTER (WHERE pd.status = 'success') as success,
          COUNT(*) FILTER (WHERE pd.status = 'failed') as failed
        FROM partner_apis pa
        LEFT JOIN partner_distributions pd ON pa.id = pd.partner_api_id
        GROUP BY pa.id, pa.name
        ORDER BY total DESC
      `);
    }

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
