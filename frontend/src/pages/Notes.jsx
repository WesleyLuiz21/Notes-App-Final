import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../components/AuthContext';
import NoteCard from '../components/NoteCard';
import NoteEditor from '../components/NoteEditor';
import { useToast } from '../components/useToast';
import './Notes.css';

const SECRET_COMBO_KEY = '`'; // backtick opens secret entrance

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const { logout, user } = useAuth();
  const { toast, showToast } = useToast();
  const navigate = useNavigate();

  const loadNotes = useCallback(async () => {
    const data = await api.getNotes();
    setNotes(data);
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Secret entry: press backtick 3 times quickly
  useEffect(() => {
    let count = 0;
    let timer;
    function onKey(e) {
      if (e.key === SECRET_COMBO_KEY) {
        count++;
        clearTimeout(timer);
        timer = setTimeout(() => { count = 0; }, 600);
        if (count >= 3) {
          count = 0;
          navigate('/secret');
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  async function handleCreate() {
    const note = await api.createNote({ content: '', title: null, pinned: false });
    setNotes(prev => [note, ...prev]);
    setEditingNote(note);
    setIsCreating(true);
  }

  async function handleSave(noteData) {
    if (!editingNote) return;
    const updated = await api.updateNote(editingNote.id, { ...noteData });
    setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, ...updated } : n));
    setEditingNote(prev => ({ ...prev, ...updated }));
  }

  async function handleDelete(id) {
    await api.deleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (editingNote?.id === id) setEditingNote(null);
    showToast('Note archived ✓');
  }

  async function handlePin(note) {
    const updated = await api.updateNote(note.id, { ...note, pinned: !note.pinned });
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, ...updated } : n));
  }

  function handleClose() {
    setEditingNote(null);
    setIsCreating(false);
    loadNotes();
  }

  const filtered = notes.filter(n =>
    !search ||
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="notes-page">
      <header className="notes-header">
        <div className="notes-header-left">
          <span className="logo">📝</span>
          <h1>Notes</h1>
        </div>
        <div className="notes-header-right">
          <input
            className="search-input"
            placeholder="Search…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="btn btn-ghost" onClick={() => navigate('/archive')}>Archive</button>
          <span className="username-label">{user?.username}</span>
          <button className="btn btn-ghost" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="notes-main">
        <div className="notes-toolbar">
          <button className="btn btn-primary" onClick={handleCreate}>+ New Note</button>
          <span className="notes-count">{filtered.length} note{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <p>{search ? 'No notes match your search' : 'No notes yet — create your first one!'}</p>
          </div>
        ) : (
          <div className="notes-grid">
            {filtered.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => setEditingNote(note)}
                onDelete={handleDelete}
                onPin={handlePin}
              />
            ))}
          </div>
        )}
      </main>

      {editingNote && (
        <NoteEditor
          note={editingNote}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
