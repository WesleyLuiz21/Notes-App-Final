import { Router } from 'express';
import { z } from 'zod';
import db from '../db/database.js';
import { requireAuth, requireSecretSession } from '../middleware/auth.js';
import { generateSalt, deriveKey, encrypt, decrypt, hashPin } from '../db/crypto.js';

const router = Router();
router.use(requireAuth);

const pinSchema = z.object({ pin: z.string().min(4).max(20) });
const secretNoteSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  content: z.string().max(100000)
});

// POST /secret/setup — set up PIN for the first time
router.post('/setup', async (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM secret_config LIMIT 1').get();
    if (existing) return res.status(403).json({ error: 'Secret already configured' });
    
    const { pin } = pinSchema.parse(req.body);
    const salt = generateSalt();
    const pinHash = hashPin(pin);
    
    db.prepare('INSERT INTO secret_config (pin_hash, kdf_salt) VALUES (?, ?)').run(pinHash, salt);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /secret/status — check if secret is configured
router.get('/status', (req, res) => {
  const config = db.prepare('SELECT id FROM secret_config LIMIT 1').get();
  res.json({ configured: !!config, unlocked: !!req.session?.secretUnlocked });
});

// POST /secret/unlock — verify PIN
router.post('/unlock', (req, res) => {
  try {
    const { pin } = pinSchema.parse(req.body);
    const config = db.prepare('SELECT * FROM secret_config LIMIT 1').get();
    if (!config) return res.status(404).json({ error: 'Secret not configured' });
    
    const pinHash = hashPin(pin);
    if (pinHash !== config.pin_hash) {
      db.prepare("INSERT INTO audit_log (event) VALUES (?)").run('secret_unlock_failed');
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    
    req.session.secretUnlocked = true;
    req.session.secretUnlockedAt = Date.now();
    
    db.prepare("INSERT INTO audit_log (event) VALUES (?)").run('secret_unlocked');
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /secret/lock
router.post('/lock', (req, res) => {
  req.session.secretUnlocked = false;
  req.session.secretUnlockedAt = null;
  res.json({ ok: true });
});

// All routes below require secret session
router.use(requireSecretSession);

function getKey(pin) {
  const config = db.prepare('SELECT kdf_salt FROM secret_config LIMIT 1').get();
  return deriveKey(pin, config.kdf_salt);
}

// GET /secret/notes — returns encrypted notes, client decrypts with PIN
router.get('/notes', (req, res) => {
  // We return ciphertext; the actual decryption happens server-side when PIN is stored in session
  // But we don't store PIN in session — we store a flag. So we need PIN to decrypt.
  // Return raw encrypted data and let client provide PIN for decrypt call.
  const notes = db.prepare(`
    SELECT id, title_ciphertext, title_nonce, ciphertext, nonce, created_at, updated_at
    FROM secret_notes
    WHERE deleted_at IS NULL
    ORDER BY updated_at DESC
  `).all();
  res.json(notes);
});

// POST /secret/notes/decrypt — decrypt a batch of notes (PIN provided)
router.post('/notes/decrypt', (req, res) => {
  try {
    const { pin, ids } = z.object({ 
      pin: z.string(), 
      ids: z.array(z.number()).optional() 
    }).parse(req.body);
    
    // Verify PIN again
    const config = db.prepare('SELECT * FROM secret_config LIMIT 1').get();
    if (hashPin(pin) !== config.pin_hash) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    
    const key = deriveKey(pin, config.kdf_salt);
    
    let notes;
    if (ids?.length) {
      const placeholders = ids.map(() => '?').join(',');
      notes = db.prepare(`
        SELECT * FROM secret_notes WHERE id IN (${placeholders}) AND deleted_at IS NULL
      `).all(...ids);
    } else {
      notes = db.prepare('SELECT * FROM secret_notes WHERE deleted_at IS NULL ORDER BY updated_at DESC').all();
    }
    
    const decrypted = notes.map(note => {
      try {
        const content = decrypt(note.ciphertext, note.nonce, key);
        const title = note.title_ciphertext 
          ? decrypt(note.title_ciphertext, note.title_nonce, key)
          : null;
        return { id: note.id, title, content, created_at: note.created_at, updated_at: note.updated_at };
      } catch {
        return { id: note.id, title: '[decrypt error]', content: '[decrypt error]', created_at: note.created_at, updated_at: note.updated_at };
      }
    });
    
    res.json(decrypted);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /secret/notes
router.post('/notes', (req, res) => {
  try {
    const { pin, title, content } = z.object({
      pin: z.string(),
      title: z.string().max(255).optional().nullable(),
      content: z.string().max(100000)
    }).parse(req.body);
    
    const config = db.prepare('SELECT * FROM secret_config LIMIT 1').get();
    if (hashPin(pin) !== config.pin_hash) return res.status(401).json({ error: 'Invalid PIN' });
    
    const key = deriveKey(pin, config.kdf_salt);
    
    const { ciphertext, nonce } = encrypt(content, key);
    let titleCiphertext = null, titleNonce = null;
    if (title) {
      const enc = encrypt(title, key);
      titleCiphertext = enc.ciphertext;
      titleNonce = enc.nonce;
    }
    
    const result = db.prepare(`
      INSERT INTO secret_notes (title_ciphertext, title_nonce, ciphertext, nonce) VALUES (?, ?, ?, ?)
    `).run(titleCiphertext, titleNonce, ciphertext, nonce);
    
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /secret/notes/:id
router.put('/notes/:id', (req, res) => {
  try {
    const { pin, title, content } = z.object({
      pin: z.string(),
      title: z.string().max(255).optional().nullable(),
      content: z.string().max(100000)
    }).parse(req.body);
    
    const note = db.prepare('SELECT id FROM secret_notes WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Not found' });
    
    const config = db.prepare('SELECT * FROM secret_config LIMIT 1').get();
    if (hashPin(pin) !== config.pin_hash) return res.status(401).json({ error: 'Invalid PIN' });
    
    const key = deriveKey(pin, config.kdf_salt);
    const { ciphertext, nonce } = encrypt(content, key);
    
    let titleCiphertext = null, titleNonce = null;
    if (title) {
      const enc = encrypt(title, key);
      titleCiphertext = enc.ciphertext;
      titleNonce = enc.nonce;
    }
    
    db.prepare(`
      UPDATE secret_notes SET title_ciphertext=?, title_nonce=?, ciphertext=?, nonce=?, updated_at=datetime('now')
      WHERE id=?
    `).run(titleCiphertext, titleNonce, ciphertext, nonce, req.params.id);
    
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /secret/notes/:id
router.delete('/notes/:id', (req, res) => {
  db.prepare("UPDATE secret_notes SET deleted_at=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
