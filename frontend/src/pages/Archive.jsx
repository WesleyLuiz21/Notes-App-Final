import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../components/useToast';
import './Archive.css';

function daysUntilDelete(deletedAt) {
  const d = new Date(deletedAt + 'Z');
  const deleteOn = new Date(d.getTime() + 20 * 24 * 60 * 60 * 1000);
  const diff = deleteOn - new Date();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export default function Archive() {
  const [notes, setNotes] = useState([]);
  const { toast, showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.getArchive().then(setNotes);
  }, []);

  async function restore(id) {
    await api.restoreNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    showToast('Note restored ✓');
  }

  async function hardDelete(id) {
    await api.hardDeleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    showToast('Note permanently deleted');
  }

  return (
    <div className="archive-page">
      <header className="archive-header">
        <button className="btn btn-ghost" onClick={() => navigate('/notes')}>← Back</button>
        <h1>Archive</h1>
        <span className="archive-info">Notes auto-delete after 20 days</span>
      </header>

      <main className="archive-main">
        {notes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗄️</div>
            <p>Archive is empty</p>
          </div>
        ) : (
          <div className="archive-list">
            {notes.map(note => (
              <div key={note.id} className="archive-item">
                <div className="archive-item-content">
                  {note.title && <div className="archive-title">{note.title}</div>}
                  <div className="archive-snippet">{note.content?.slice(0, 100) || <em>Empty note</em>}</div>
                  <div className="archive-meta">
                    <span className="days-left">{daysUntilDelete(note.deleted_at)}d until deletion</span>
                  </div>
                </div>
                <div className="archive-actions">
                  <button className="btn btn-ghost" onClick={() => restore(note.id)}>Restore</button>
                  <button className="btn btn-danger" onClick={() => hardDelete(note.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
