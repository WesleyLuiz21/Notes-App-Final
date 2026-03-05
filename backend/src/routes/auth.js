import { Router } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import db from '../db/database.js';

const router = Router();

// Rate limit login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Basic credential schema
const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

// Helper: promisify req.session.save / destroy
const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

const destroySession = (req) =>
  new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const username = parsed.username.trim();
    const password = parsed.password;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      // Prevent timing attacks
      await argon2.hash('dummy-password');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Set session values
    req.session.userId = user.id;
    req.session.username = user.username;

    // Persist session BEFORE responding, so Set-Cookie is sent reliably
    await saveSession(req);

    db.prepare('INSERT INTO audit_log (event) VALUES (?)').run('user_login');

    return res.json({ ok: true, username: user.username });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  try {
    await destroySession(req);

    // Clear the default express-session cookie (unless you changed the name in session config)
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
      path: '/',
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /auth/me
router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  return res.json({ userId: req.session.userId, username: req.session.username });
});

// POST /auth/setup — first-time user creation (only if no users exist)
router.post('/setup', async (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM users LIMIT 10').get();
    if (existing) return res.status(403).json({ error: 'Setup already completed' });

    const parsed = loginSchema.parse(req.body);
    const username = parsed.username.trim();
    const password = parsed.password;

    const hash = await argon2.hash(password, { type: argon2.argon2id });

    const result = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username, hash);

    // Auto-login after setup
    req.session.userId = result.lastInsertRowid;
    req.session.username = username;

    await saveSession(req);

    return res.json({ ok: true, username });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    console.error('Setup error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
