import { useState, useEffect, useRef, useCallback } from 'react';
import './NoteEditor.css';

export default function NoteEditor({ note, onSave, onClose, isSecret = false }) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [saved, setSaved] = useState(true);
  const [copyMsg, setCopyMsg] = useState('');
  const contentRef = useRef(null);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  const triggerSave = useCallback((t, c) => {
    setSaved(false);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await onSave({ title: t, content: c, pinned: note?.pinned || false });
      setSaved(true);
    }, 800);
  }, [note, onSave]);

  function handleTitleChange(e) {
    setTitle(e.target.value);
    triggerSave(e.target.value, content);
  }

  function handleContentChange(e) {
    setContent(e.target.value);
    triggerSave(title, e.target.value);
  }

  async function handleCopy() {
    const textarea = contentRef.current;
    const toCopy = textarea.selectionStart !== textarea.selectionEnd
      ? content.slice(textarea.selectionStart, textarea.selectionEnd)
      : content;
    
    await navigator.clipboard.writeText(toCopy);
    setCopyMsg('Copied!');
    setTimeout(() => setCopyMsg(''), 2000);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="editor-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="editor-modal" onKeyDown={handleKeyDown}>
        <div className="editor-header">
          <input
            className="editor-title-input"
            placeholder="Title (optional)"
            value={title}
            onChange={handleTitleChange}
          />
          <div className="editor-header-actions">
            {isSecret && <span className="secret-badge">🔒 Secret</span>}
            <span className={`save-indicator ${saved ? 'saved' : 'saving'}`}>
              {saved ? '✓ Saved' : 'Saving…'}
            </span>
            <button className="btn btn-ghost editor-copy-btn" onClick={handleCopy} title="Copy content">
              {copyMsg || '📋 Copy'}
            </button>
            <button className="icon-btn" onClick={onClose} title="Close">✕</button>
          </div>
        </div>
        
        <textarea
          ref={contentRef}
          className="editor-content"
          placeholder="Start writing…"
          value={content}
          onChange={handleContentChange}
        />
      </div>
    </div>
  );
}
