import { Router } from 'express';
import argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import db from '../db/database.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many login attempts, try again later' }
});

const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200)
});

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
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
    
    req.session.userId = user.id;
    req.session.username = user.username;
    
    db.prepare("INSERT INTO audit_log (event) VALUES (?)").run('user_login');
    
    res.json({ ok: true, username: user.username });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// GET /auth/me
router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ userId: req.session.userId, username: req.session.username });
});

// POST /auth/setup — first-time user creation (only if no users exist)
router.post('/setup', async (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM users LIMIT 1').get();
    if (existing) return res.status(403).json({ error: 'Setup already completed' });
    
    const { username, password } = loginSchema.parse(req.body);
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
