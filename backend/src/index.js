import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import session from 'express-session';
import { initDb } from './db/database.js';
import authRouter from './routes/auth.js';
import notesRouter from './routes/notes.js';
import secretRouter from './routes/secret.js';
import { startCleanupJob } from './jobs/cleanup.js';

const app = express();

// Behind Caddy reverse proxy
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// Security headers
app.use(helmet());

// CORS — only allow configured frontend origin
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));

app.options('*', cors()); // handle preflight

// Sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'lax' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

app.use(express.json({ limit: '1mb' }));

// Auto-lock secret session after 15 minutes of inactivity
app.use((req, res, next) => {
  if (req.session?.secretUnlocked && req.session.secretUnlockedAt) {
    const TIMEOUT = 15 * 60 * 1000;
    if (Date.now() - req.session.secretUnlockedAt > TIMEOUT) {
      req.session.secretUnlocked = false;
      req.session.secretUnlockedAt = null;
    } else {
      // Reset timer on activity
      req.session.secretUnlockedAt = Date.now();
    }
  }
  next();
});

// Routes
app.use('/auth', authRouter);
app.use('/notes', notesRouter);
app.use('/secret', secretRouter);

app.get('/health', (req, res) => res.json({ ok: true }));

// Init DB and start server
initDb();
startCleanupJob();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Running on port ${PORT} (${isProd ? 'production' : 'development'})`);
});
