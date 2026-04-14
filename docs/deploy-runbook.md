# Deployment Runbook — ExtenSilica Production Launch

**Last updated:** April 2026  
**Target:** `extensilica.com` (Next.js) + `api.extensilica.com` (Express API)  
**Primary path below:** **one VPS** (e.g. Hostinger KVM, Ubuntu 24.04), both apps on the same machine, **Caddy** for HTTPS reverse proxy.

Replace placeholders before you run anything:

| Placeholder | Meaning |
|-------------|---------|
| `YOUR_SERVER_IP` | VPS public IPv4 |
| `GIT_REPO_URL` | Your git remote (HTTPS or SSH), e.g. `https://github.com/you/ExtenSilica.git` |
| `GIT_BRANCH` | Usually `main` |
| `DB_PASSWORD` | Strong password for PostgreSQL user `extensilica` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First registry account (production) |
| `SMTP_PASS` | Zoho app password for `noreply@` |

---

## 0 — DNS (at your registrar, before TLS works)

Point records to **`YOUR_SERVER_IP`**:

| Type | Name | Value |
|------|------|--------|
| A | `@` | `YOUR_SERVER_IP` |
| A | `www` | `YOUR_SERVER_IP` |
| A | `api` | `YOUR_SERVER_IP` |

Wait until `dig +short api.extensilica.com` returns your IP (propagation can take minutes–hours).

---

## 1 — First login and base packages

From your **laptop**:

```bash
ssh root@YOUR_SERVER_IP
```

On the **server** (as `root`):

```bash
apt-get update
apt-get upgrade -y
apt-get install -y curl git ufw postgresql postgresql-contrib
```

Firewall (SSH first, then HTTP/S):

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

---

## 2 — Node.js 22.x (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v
npm -v
```

Process manager:

```bash
npm install -g pm2
```

---

## 3 — PostgreSQL: user + database

```bash
sudo -u postgres psql -c "CREATE USER extensilica WITH PASSWORD 'DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE extensilica OWNER extensilica;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE extensilica TO extensilica;"
```

(If `CREATE USER` fails because the role already exists, skip user creation or use `DROP USER` only on a fresh machine.)

**Connection string** (same machine, no SSL between app and Postgres — normal on VPS):

```text
postgresql://extensilica:DB_PASSWORD@localhost:5432/extensilica?schema=public
```

(Optional) allow Postgres only on localhost (default on Ubuntu):

```bash
grep listen_addresses /etc/postgresql/*/main/postgresql.conf
# should be localhost or not expose 5432 publicly
```

---

## 4 — Caddy (HTTPS + reverse proxy)

Install:

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
api.extensilica.com {
	reverse_proxy 127.0.0.1:3001
}

extensilica.com, www.extensilica.com {
	reverse_proxy 127.0.0.1:3000
}
EOF
```

Reload Caddy (Let’s Encrypt certificates are obtained automatically):

```bash
systemctl reload caddy
systemctl status caddy --no-pager
```

Until the API and Next apps are listening, Caddy may show **502** — that is expected until steps 6–7 are done.

---

## 5 — Clone the repository

```bash
mkdir -p /opt/extensilica
cd /opt/extensilica
git clone GIT_REPO_URL .
git checkout GIT_BRANCH
```

---

## 6 — Backend: `.env`, install, migrate, build, PM2

Create `store-backend/.env` (adjust every value):

```bash
cat > /opt/extensilica/store-backend/.env << 'EOF'
DATABASE_URL="postgresql://extensilica:DB_PASSWORD@localhost:5432/extensilica?schema=public"
PORT=3001
BASE_URL=https://api.extensilica.com
SITE_URL=https://extensilica.com

# Blobs: start with local disk on the VPS (simplest). Switch to S3/R2 later (see store-backend/.env comments).
STORAGE_DRIVER=local

SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=noreply@extensilica.com
SMTP_PASS=SMTP_PASS
SMTP_FROM="ExtenSilica <noreply@extensilica.com>"

LEGAL_EMAIL=legal@extensilica.com
LEGAL_EMAIL_PASS=

# Optional later:
# STORAGE_DRIVER=s3
# S3_BUCKET=...
# S3_REGION=auto
# S3_ENDPOINT=...
# S3_ACCESS_KEY_ID=...
# S3_SECRET_ACCESS_KEY=...
# S3_FORCE_PATH_STYLE=false
EOF
```

**Edit the file** — replace `DB_PASSWORD`, `SMTP_PASS`, etc.:

```bash
nano /opt/extensilica/store-backend/.env
```

Upload directories:

```bash
mkdir -p /opt/extensilica/store-backend/uploads/tmp /opt/extensilica/store-backend/uploads/avatars
```

Install, generate Prisma client, migrate, compile:

```bash
cd /opt/extensilica/store-backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

Start API with PM2:

```bash
pm2 start /opt/extensilica/store-backend/dist/server.js --name extensilica-api
pm2 save
```

(Optional) seed demo packages:

```bash
cd /opt/extensilica/store-backend
npm run run-seed
```

**Check from the server:**

```bash
curl -sS http://127.0.0.1:3001/health
curl -sS http://127.0.0.1:3001/packages | head -c 200
```

**Check through HTTPS** (after DNS + Caddy):

```bash
curl -sS https://api.extensilica.com/health
curl -sS https://api.extensilica.com/packages | head -c 200
```

---

## 7 — Frontend: `.env.production`, build, PM2

```bash
cd /opt/extensilica/store-frontend
printf '%s\n' 'NEXT_PUBLIC_API_URL=https://api.extensilica.com/api' > .env.production
npm ci
npm run build
pm2 start npm --name extensilica-web -- start
pm2 save
```

**Check:**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
curl -sS -o /dev/null -w '%{http_code}\n' https://extensilica.com/
```

PM2 on boot:

```bash
pm2 startup systemd -u root --hp /root
# run the command PM2 prints, if any
```

---

## 8 — First admin user (production)

From **any machine**:

```bash
curl -sS -X POST 'https://api.extensilica.com/api/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{"username":"extensilica","email":"ADMIN_EMAIL","password":"ADMIN_PASSWORD"}'
```

Expect JSON with user fields (or an error if username/email already taken).

---

## 9 — CLI: point at production and publish `rvx-demo`

On your **laptop** (after changing `DEFAULT_REGISTRY` in `cli/src/constants.rs` and building, or via config):

```bash
mkdir -p ~/.extensilica
cat > ~/.extensilica/config.json << 'EOF'
{
  "registry": "https://api.extensilica.com",
  "token": ""
}
EOF
```

Login (interactive):

```bash
cd /path/to/ExtenSilica/cli
cargo run -- login
```

Or obtain a token via API and paste into `config.json`.

Publish demo package:

```bash
cd /path/to/ExtenSilica
bash scripts/publish-rvx-demo.sh
```

(Script expects `registry` in config to match `https://api.extensilica.com` and will ask for confirmation.)

---

## 10 — Smoke tests

```bash
curl -sS 'https://api.extensilica.com/packages' | head -c 500
curl -sS -o /dev/null -w '%{http_code}\n' 'https://extensilica.com/'
curl -sS -o /dev/null -w '%{http_code}\n' 'https://extensilica.com/install.sh'
curl -sS -X POST 'https://api.extensilica.com/api/auth/forgot-password' \
  -H 'Content-Type: application/json' \
  -d '{"email":"ADMIN_EMAIL"}'
```

---

## 11 — Update deploy (later pushes)

On the **server**:

```bash
cd /opt/extensilica
git pull origin GIT_BRANCH

cd store-backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart extensilica-api

cd ../store-frontend
npm ci
npm run build
pm2 restart extensilica-web
```

---

## 12 — Rollback / ops

```bash
pm2 logs extensilica-api --lines 100
pm2 logs extensilica-web --lines 100
pm2 restart extensilica-api
pm2 restart extensilica-web
```

Bad package version (from laptop, logged in):

```bash
xsil yank rvx-demo@1.0.0 --reason "rollback test"
```

---

## Alternative: frontend on Vercel (not on the VPS)

1. Create project from `store-frontend` on Vercel.  
2. Set environment variable: `NEXT_PUBLIC_API_URL=https://api.extensilica.com/api`  
3. Build command: `npm run build`  
4. Point `extensilica.com` to Vercel (DNS they provide).  
5. Keep **only** `api.extensilica.com` on the VPS Caddyfile:

```caddy
api.extensilica.com {
	reverse_proxy 127.0.0.1:3001
}
```

---

## R2 / S3 blobs (optional upgrade)

When ready, create a bucket + API token at Cloudflare R2, then in `store-backend/.env`:

```bash
STORAGE_DRIVER=s3
S3_BUCKET=extensilica-packages
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false
```

Then:

```bash
pm2 restart extensilica-api
```

---

## Phase checklist (same goals, command-level coverage above)

| Phase | What | Where |
|-------|------|--------|
| 1 | DNS + VPS + Postgres + Caddy | §0–§4 |
| 2 | Secrets in `store-backend/.env` + `store-frontend/.env.production` | §6–§7 |
| 3 | Migrations + API running | §6 |
| 4 | Next build + web running | §7 |
| 5 | First user + optional seed + CLI publish | §8–§9 |
| 6–7 | CI already in repo; Sentry/logs optional | `launch-checklist-v3.md` |

---

## CLI release binary (`DEFAULT_REGISTRY`)

Before shipping public CLI builds, edit `cli/src/constants.rs`:

```rust
pub const DEFAULT_REGISTRY: &str = "https://api.extensilica.com";
```

Then tag (triggers GitHub Actions release):

```bash
git tag cli/v0.1.0
git push origin cli/v0.1.0
```
