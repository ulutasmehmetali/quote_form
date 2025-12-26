import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { users, companyProfiles, proProfiles } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

router.use((req, res, next) => {
  const { method, url, ip, headers, body } = req;
  const safeBody = {
    role: body?.role,
    email: body?.email,
    name: body?.name,
    companyName: body?.companyName,
    position: body?.position,
  };
  console.info('[auth] incoming', {
    method,
    url,
    ip,
    origin: headers?.origin,
    referer: headers?.referer,
    body: safeBody,
  });
  next();
});

const sanitize = (value = '') => value.trim();
const VALID_ROLES = ['company', 'pro'];

const formatUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  companyName: user.companyName,
  position: user.position,
  role: user.role,
});

router.post('/signup', async (req, res) => {
  try {
    const role = sanitize(req.body.role);
    const email = sanitize(req.body.email).toLowerCase();
    const password = sanitize(req.body.password);
    const name = sanitize(req.body.name);
    const companyName = sanitize(req.body.companyName);
    const position = sanitize(req.body.position);

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }
    if (!isStrongPassword(password)) {
      return res
        .status(400)
        .json({ error: 'Password must be at least 10 characters and include uppercase, lowercase, number, and symbol.' });
    }
    if (role === 'company' && !companyName) {
      return res.status(400).json({ error: 'Company name is required for company accounts.' });
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        companyName: role === 'company' ? companyName : null,
        position: role === 'company' ? position || null : null,
        role,
      })
      .returning();

    // Create profile rows to keep role-specific data handy
    if (role === 'company') {
      await db
        .insert(companyProfiles)
        .values({ userId: created.id, companyName, position: position || null });
    } else {
      await db.insert(proProfiles).values({ userId: created.id, title: position || null });
    }

    return res
      .status(201)
      .json({ message: 'Signed up successfully.', user: formatUser(created) });
  } catch (err) {
    console.error('[auth/signup] error', err);
    return res.status(500).json({ error: 'Signup failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const role = sanitize(req.body.role);
    const email = sanitize(req.body.email).toLowerCase();
    const password = sanitize(req.body.password);

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || user.role !== role) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    return res.json({ message: 'Logged in successfully.', user: formatUser(user) });
  } catch (err) {
    console.error('[auth/login] error', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

export default router;
const isStrongPassword = (pwd) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{10,}$/.test(pwd);
