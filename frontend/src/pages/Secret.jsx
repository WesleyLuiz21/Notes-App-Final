import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import NoteCard from '../components/NoteCard';
import NoteEditor from '../components/NoteEditor';
import { useToast } from '../components/useToast';
import './Secret.css';

export default function Secret() {
  const [status, setStatus] = useState(null); // null | { configured, unlocked }
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [setupMode, setSetupMode] = useState(false);
  const [confirmPin, setConfirmPin] = useState('');
  const [notes, setNotes] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [sessionPin, setSessionPin] = useState(''); // keep PIN in memory for crypto ops
  const { toast, showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.secretStatus().then(setStatus).catch(() => navigate('/notes'));
  }, [navigate]);

  const loadNotes = useCallback(async (activePin) => {
    if (!activePin) return;
    const data = await api.decryptSecretNotes(activePin);
    setNotes(data);
  }, []);

  useEffect(() => {
    if (status?.unlocked && sessionPin) {
      loadNotes(sessionPin);
    }
  }, [status, sessionPin, loadNotes]);

  async function handleSetup(e) {
    e.preventDefault();
    setPinError('');
    if (pin !== confirmPin) return setPinError('PINs do not match');
    if (pin.length < 4) return setPinError('PIN must be at least 4 digits');
    
    try {
      await api.secretSetup(pin);
      const s = await api.secretStatus();
      setStatus(s);
      setSetupMode(false);
    } catch (err) {
      setPinError(err.message);
    }
  }

  async function handleUnlock(e) {
    e.preventDefault();
    setPinError('');
    try {
      await api.secretUnlock(pin);
      setSessionPin(pin);
      const s = await api.secretStatus();
      setStatus(s);
    } catch (err) {
      setPinError('Incorrect PIN');
      setPin('');
    }
  }

  async function handleLock() {
    await api.secretLock();
    setSessionPin('');
    setNotes([]);
    const s = await api.secretStatus();
    setStatus(s);
  }

  async function handleCreate() {
    const result = await api.createSecretNote(sessionPin, null, '');
    const newNote = { id: result.id, title: null, content: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setNotes(prev => [newNote, ...prev]);
    setEditingNote(newNote);
  }

  async function handleSave(noteData) {
    if (!editingNote) return;
    await api.updateSecretNote(editingNote.id, sessionPin, noteData.title, noteData.content);
    setNotes(prev => prev.map(n => n.id === editingNote.id ? { ...n, ...noteData, updated_at: new Date().toISOString() } : n));
    setEditingNote(prev => ({ ...prev, ...noteData }));
  }

  async function handleDelete(id) {
    await api.deleteSecretNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
    if (editingNote?.id === id) setEditingNote(null);
    showToast('Secret note deleted');
  }

  if (!status) return <div className="secret-loading">Loading…</div>;

  // Not configured yet
  if (!status.configured || setupMode) {
    return (
      <div className="secret-gate">
        <div className="secret-gate-card">
          <div className="secret-icon">🔐</div>
          <h2>Set Up Secret Notes</h2>
          <p className="secret-desc">Create a PIN to protect your secret notes. The PIN is used to encrypt your data.</p>
          <form onSubmit={handleSetup}>
            <input
              className="pin-input"
              type="password"
              placeholder="Choose PIN (min. 4 chars)"
              value={pin}
              onChange={e => setPin(e.target.value)}
              autoFocus
            />
            <input
              className="pin-input"
              type="password"
              placeholder="Confirm PIN"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
            />
            {pinError && <div className="pin-error">{pinError}</div>}
            <button type="submit" className="btn btn-primary pin-btn">Create Secret Area</button>
          </form>
          <button className="secret-back-btn" onClick={() => navigate('/notes')}>← Back to Notes</button>
        </div>
      </div>
    );
  }

  // PIN gate — locked
  if (!status.unlocked) {
    return (
      <div className="secret-gate">
        <div className="secret-gate-card">
          <div className="secret-icon">🔒</div>
          <h2>Secret Notes</h2>
          <p className="secret-desc">Enter your PIN to access encrypted notes</p>
          <form onSubmit={handleUnlock}>
            <input
              className="pin-input"
              type="password"
              placeholder="Enter PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              autoFocus
            />
            {pinError && <div className="pin-error">{pinError}</div>}
            <button type="submit" className="btn btn-primary pin-btn">Unlock</button>
          </form>
          <button className="secret-back-btn" onClick={() => navigate('/notes')}>← Back to Notes</button>
        </div>
      </div>
    );
  }

  // Unlocked
  return (
    <div className="secret-page">
      <header className="secret-header">
        <button className="btn btn-ghost" onClick={() => navigate('/notes')}>← Back</button>
        <div className="secret-header-title">
          <span>🔓</span>
          <h1>Secret Notes</h1>
        </div>
        <button className="btn btn-ghost lock-btn" onClick={handleLock}>🔒 Lock</button>
      </header>

      <main className="secret-main">
        <div className="notes-toolbar">
          <button className="btn btn-primary" onClick={handleCreate}>+ New Secret Note</button>
          <span className="notes-count">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        </div>

        {notes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤫</div>
            <p>No secret notes yet</p>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={{ ...note, pinned: false }}
                onClick={() => setEditingNote(note)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {editingNote && (
        <NoteEditor
          note={editingNote}
          onSave={handleSave}
          onClose={() => { setEditingNote(null); loadNotes(sessionPin); }}
          isSecret
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
