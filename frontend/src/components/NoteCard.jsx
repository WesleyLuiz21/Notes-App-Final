import './NoteCard.css';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'Z');
  const now = new Date();
  const diff = now - d;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export default function NoteCard({ note, onClick, onDelete, onPin }) {
  const snippet = note.content?.slice(0, 120) || '';

  return (
    <div className={`note-card ${note.pinned ? 'pinned' : ''}`} onClick={onClick}>
      <div className="note-card-header">
        {note.pinned && <span className="pin-badge">📌</span>}
        <span className="note-time">{formatDate(note.updated_at)}</span>
        <div className="note-actions" onClick={e => e.stopPropagation()}>
          <button className="icon-btn" title="Pin" onClick={() => onPin?.(note)}>
            {note.pinned ? '📌' : '📍'}
          </button>
          <button className="icon-btn danger" title="Delete" onClick={() => onDelete(note.id)}>
            ✕
          </button>
        </div>
      </div>
      {note.title && <div className="note-title">{note.title}</div>}
      <div className="note-snippet">{snippet || <span className="empty">Empty note</span>}</div>
    </div>
  );
}
