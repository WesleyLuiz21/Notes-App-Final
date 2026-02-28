import { Router } from 'express';
import { z } from 'zod';
import db from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const noteSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  content: z.string().max(100000),
  pinned: z.boolean().optional()
});

// GET /notes
router.get('/', (req, res) => {
  const notes = db.prepare(`
    SELECT id, title, content, pinned, created_at, updated_at
    FROM notes
    WHERE deleted_at IS NULL
    ORDER BY pinned DESC, updated_at DESC
  `).all();
  res.json(notes);
});

// POST /notes
router.post('/', (req, res) => {
  try {
    const { title, content, pinned } = noteSchema.parse(req.body);
    const result = db.prepare(`
      INSERT INTO notes (title, content, pinned) VALUES (?, ?, ?)
    `).run(title ?? null, content, pinned ? 1 : 0);
    
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(note);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /notes/:id
router.put('/:id', (req, res) => {
  try {
    const { title, content, pinned } = noteSchema.parse(req.body);
    const note = db.prepare('SELECT id FROM notes WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    db.prepare(`
      UPDATE notes SET title = ?, content = ?, pinned = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(title ?? null, content, pinned ? 1 : 0, req.params.id);
    
    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid input' });
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /notes/:id — soft delete (archive)
router.delete('/:id', (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  
  db.prepare("UPDATE notes SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  
  res.json({ ok: true });
});

// GET /notes/archive
router.get('/archive', (req, res) => {
  const notes = db.prepare(`
    SELECT id, title, content, pinned, created_at, updated_at, deleted_at
    FROM notes
    WHERE deleted_at IS NOT NULL
    ORDER BY deleted_at DESC
  `).all();
  res.json(notes);
});

// POST /notes/archive/:id/restore
router.post('/archive/:id/restore', (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ? AND deleted_at IS NOT NULL').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Archived note not found' });
  
  db.prepare("UPDATE notes SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?")
    .run(req.params.id);
  
  res.json({ ok: true });
});

// DELETE /notes/archive/:id — hard delete from archive
router.delete('/archive/:id', (req, res) => {
  db.prepare('DELETE FROM notes WHERE id = ? AND deleted_at IS NOT NULL').run(req.params.id);
  res.json({ ok: true });
});

export default router;
