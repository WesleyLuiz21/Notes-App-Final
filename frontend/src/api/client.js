const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
    window.location.href = '/login';
    return;
  }
  
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),
  setup: (username, password) => request('POST', '/auth/setup', { username, password }),

  // Notes
  getNotes: () => request('GET', '/notes'),
  createNote: (note) => request('POST', '/notes', note),
  updateNote: (id, note) => request('PUT', `/notes/${id}`, note),
  deleteNote: (id) => request('DELETE', `/notes/${id}`),

  // Archive
  getArchive: () => request('GET', '/notes/archive'),
  restoreNote: (id) => request('POST', `/notes/archive/${id}/restore`),
  hardDeleteNote: (id) => request('DELETE', `/notes/archive/${id}`),

  // Secret
  secretStatus: () => request('GET', '/secret/status'),
  secretSetup: (pin) => request('POST', '/secret/setup', { pin }),
  secretUnlock: (pin) => request('POST', '/secret/unlock', { pin }),
  secretLock: () => request('POST', '/secret/lock'),
  getSecretNotes: () => request('GET', '/secret/notes'),
  decryptSecretNotes: (pin, ids) => request('POST', '/secret/notes/decrypt', { pin, ids }),
  createSecretNote: (pin, title, content) => request('POST', '/secret/notes', { pin, title, content }),
  updateSecretNote: (id, pin, title, content) => request('PUT', `/secret/notes/${id}`, { pin, title, content }),
  deleteSecretNote: (id) => request('DELETE', `/secret/notes/${id}`)
};
