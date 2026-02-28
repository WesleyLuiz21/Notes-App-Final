# Personal Notes App

A self-hosted personal notes app with normal notes, archiving, and a secret PIN-protected encrypted notes area.

## Features

- **Normal Notes** — create, edit, pin, search, soft-delete
- **Archive** — deleted notes live for 20 days before auto-deletion; restore anytime
- **Secret Notes** — hidden area accessed by pressing backtick (`` ` ``) 3 times quickly; PIN-gated; notes encrypted at rest with AES-256-GCM using a PIN-derived key
- **Security**: argon2id passwords, httpOnly cookies, helmet, CORS allowlist, rate-limited login, no content logging

---

## Project Structure

```
notes-app/
├── backend/          # Node.js + Express API
│   ├── src/
│   │   ├── db/       # Database init, schema, crypto utils
│   │   ├── routes/   # auth, notes, secret
│   │   ├── middleware/
│   │   └── jobs/     # Auto-delete cron job
│   ├── Dockerfile
│   └── .env.example
├── frontend/         # React app
│   ├── src/
│   │   ├── pages/    # Login, Notes, Archive, Secret
│   │   ├── components/
│   │   ├── api/      # API client
│   │   └── styles/
│   └── .env.example
├── docker-compose.yml
└── Caddyfile.example
```

---

## Local Development

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env as needed
npm install
npm run dev
# API runs on http://localhost:3001
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Edit VITE_API_URL=http://localhost:3001
npm install
npm run dev
# App runs on http://localhost:5173
```

### First Run (Account Setup)

Visit the app and click "First time? Create account" on the login screen.
This calls `POST /auth/setup` — only works when no users exist.

### Secret Notes Setup

After logging in:
1. Press backtick (`` ` ``) 3 times quickly to navigate to `/secret`
2. You'll be prompted to create a PIN
3. After setup, use your PIN to unlock the secret area

---

## Environment Variables

### Backend `.env`

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | `development` or `production` | `development` |
| `SESSION_SECRET` | Long random string for sessions | required |
| `DB_PATH` | Path to SQLite file | `./data/app.db` |
| `FRONTEND_ORIGIN` | Frontend URL for CORS | `http://localhost:5173` |

### Frontend `.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL |

---

## Production Deployment (DigitalOcean VPS)

### 1. Create Droplet

- Ubuntu 22.04 LTS, London region
- Basic plan (1 vCPU, 1GB RAM is sufficient)
- SSH keys only, enable backups

### 2. Initial Server Setup

```bash
ssh root@your-server-ip

# Update
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Caddy (for reverse proxy)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y

# Create Docker network for Caddy
docker network create caddy_net

# Create data directory
mkdir -p /srv/notes/db
```

### 3. Deploy

```bash
# On your local machine
git clone <your-repo>
cd notes-app

# Copy files to server
scp -r . root@your-server-ip:/srv/notes/app/

# On server
cd /srv/notes/app
cp .env.example .env
# Edit .env with real values:
#   SESSION_SECRET=<run: openssl rand -hex 32>
#   FRONTEND_ORIGIN=https://notes.yourdomain.com
#   DOMAIN=yourdomain.com

docker compose up -d --build
```

### 4. Configure Caddy

```bash
# Copy example and edit with your domain
cp Caddyfile.example /etc/caddy/Caddyfile
# Edit: replace yourdomain.com with your actual domain

systemctl reload caddy
```

### 5. Deploy Frontend

Build and host the frontend as a static site:

```bash
cd frontend
cp .env.example .env
# Set VITE_API_URL=https://api.notes.yourdomain.com
npm run build
# Upload `dist/` folder to Netlify, Vercel, Cloudflare Pages, or serve via Caddy
```

To serve frontend via Caddy add to Caddyfile:
```
notes.yourdomain.com {
    root * /srv/notes/frontend/dist
    file_server
    try_files {path} /index.html
}
```

---

## Database Migrations

The DB schema is auto-created on first run via `initDb()` in `src/db/database.js`.

To manually inspect the database:
```bash
sqlite3 /srv/notes/db/app.db
.tables
.schema notes
```

---

## Security Notes

- **Passwords** hashed with argon2id
- **Session cookies** are httpOnly, secure (in prod), sameSite:strict
- **Secret notes** encrypted with AES-256-GCM; key derived from PIN via scrypt
- **PIN** stored as SHA-256 hash (only for verification; actual crypto uses the raw PIN + scrypt KDF)
- **Secret session** auto-locks after 15 minutes of inactivity
- **Login** rate-limited to 10 attempts per 15 minutes
- Note contents are never logged

---

## Adding More Projects to the VPS

For each new project:
1. Create a new `docker-compose.yml` in `/srv/<project>/app/`
2. Add a new service to the shared `caddy_net` network
3. Add a Caddy reverse proxy block for the new subdomain
4. Mount a separate `/srv/<project>/db/` volume

Each project gets its own SQLite file and container — fully isolated.
