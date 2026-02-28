export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireSecretSession(req, res, next) {
  if (!req.session?.secretUnlocked) {
    return res.status(403).json({ error: 'Secret area locked' });
  }
  next();
}
