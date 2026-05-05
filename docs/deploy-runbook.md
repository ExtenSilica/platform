# Deployment Runbook — ExtenSilica Production Launch

**Last updated:** May 2026  
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
apt-get install -y curl git ufw postgresql postgresql-contrib tar
```

The **`tar`** package must be present on this machine: the registry API validates `.xsil` uploads by shelling out to **`tar -xzf`** (see **§6**). On minimal VPS images it is sometimes omitted; on Docker later, use a base image that includes `tar` or install it explicitly (distroless images often have no `tar`, and publishes would fail).

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

**`.xsil` publish validation:** `POST /packages/:name/versions` unpacks each upload with the **system `tar`** binary (`tar -xzf`). The Node process needs **`tar` on `PATH`** — satisfied on this runbook by **`tar` in §1** (`apt-get install … tar`). If you containerise the API, ensure the image includes GNU or BSD `tar`; distroless/minimal images may require adding the `tar` package or choosing a slightly larger base.

Create `store-backend/.env` (adjust every value):

```bash
cat > /opt/extensilica/store-backend/.env << 'EOF'
DATABASE_URL="postgresql://extensilica:DB_PASSWORD@localhost:5432/extensilica?schema=public"
PORT=3001
BASE_URL=https://api.extensilica.com
# Required behind Caddy/nginx (default in code is 1 if unset). Never use false/0 here when
# Caddy sends X-Forwarded-For — express-rate-limit will error. Omit TRUST_PROXY or set TRUST_PROXY=1.
TRUST_PROXY=1
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

**Prisma `P1013` — “invalid port number” in `DATABASE_URL`:** The URL shape is `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`. If `PASSWORD` (or `USER`) contains unescaped `@`, `:`, `/`, `#`, `?`, or `%`, the parser treats part of the password as host/port and fails with this error. Encode those characters for the URL (see [Prisma connection URLs](https://www.prisma.io/docs/orm/reference/connection-urls)). On the server you can print an encoded password with:

```bash
python3 -c "import urllib.parse; print(urllib.parse.quote('YOUR_RAW_PASSWORD', safe=''))"
```

Paste the output as the password segment in `DATABASE_URL`, or set a DB password that uses only letters and digits to avoid encoding.

Start API with PM2 (use **`--cwd`** so `dotenv` and relative paths resolve from the backend tree; same pattern as the frontend):

```bash
pm2 start dist/server.js --name extensilica-api --cwd /opt/extensilica/store-backend
pm2 save
```

If the process was already created without `--cwd`, either delete and recreate it with the line above, or rely on the server loading `/opt/extensilica/store-backend/.env` via `path.join(__dirname, '..', '.env')` after you deploy a recent `store-backend` build.

Do **not** seed demo packages here if you plan to follow **§9** (`publish-rvx-demo.sh`): seeding must run **after** the first admin user exists (**§8**), otherwise packages have no `ownerId` and `rvx-demo@1.0.0` cannot be published. See **§8 — Seed demo catalog** below.

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
test -f .next/BUILD_ID && echo "Next build OK"
pm2 start npm --name extensilica-web --cwd /opt/extensilica/store-frontend -- start
pm2 save
```

The `.next/` folder is **not** in Git; **`next start` only works after a successful `npm run build`** on this server. If `BUILD_ID` is missing, fix compile errors and rerun `npm run build` before starting PM2.

Use **`--cwd`** so the app always runs from the frontend tree even if PM2 was started from another directory. If `pm2 start` is skipped or the process exits, Caddy returns **502** and `curl` to port **3000** fails.

If PM2 shows **errored** and logs say *Could not find a production build in the '.next' directory* / *production-start-no-build-id*: run `npm run build` again (must finish with exit 0), then `pm2 restart extensilica-web` (or `pm2 delete extensilica-web` and `pm2 start` as above).

**Check:**

```bash
pm2 status
pm2 logs extensilica-web --lines 40
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
curl -sS -o /dev/null -w '%{http_code}\n' https://extensilica.com/
```

If **3000** still refuses: confirm `online` in `pm2 status` and read logs (missing `.next` from a failed build, wrong cwd, or crash on boot). Then `pm2 restart extensilica-web`.

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

### Seed demo catalog (optional, run **after** register)

This inserts catalog rows for demo packages. It **assigns `ownerId`** to the user named `extensilica` by default (same username as §8), so later CLI publishes are authorized. It also leaves **`rvx-demo` without a pre-seeded `1.0.0` version**, because **§9** publishes `rvx-demo@1.0.0` from your laptop (using `scripts/publish-rvx-demo.sh`, which packs `store-backend/test/fixtures/rvx-demo/` — a copy of the public reference package); a seeded `1.0.0` row would cause **HTTP 409**.

```bash
cd /opt/extensilica/store-backend
SEED_OWNER_USERNAME=extensilica npm run run-seed
```

If your first admin username is different, set `SEED_OWNER_USERNAME` to match. For a throwaway local database with **no** users, you may use `ALLOW_SEED_WITHOUT_OWNER=1` (not recommended for production).

---

## 9 — CLI: point at production and publish `rvx-demo`

The **`xsil`** CLI lives in the **public** repository **[github.com/ExtenSilica/xsil](https://github.com/ExtenSilica/xsil)** (not in this private tree). Install a release binary or build from that clone.

On your **laptop**, point the CLI at production (no need to edit Rust sources if you use config only):

```bash
mkdir -p ~/.extensilica
cat > ~/.extensilica/config.json << 'EOF'
{
  "registry": "https://api.extensilica.com",
  "token": ""
}
EOF
```

Login (interactive), from your **xsil** clone or with `xsil` on `PATH`:

```bash
cd /path/to/xsil/cli
cargo run -- login
```

Or obtain a token via API and paste into `config.json`.

Publish demo package (script lives in **this** private repo and uses the bundled fixture):

```bash
cd /path/to/ExtenSilica-private
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

**Prerequisite:** your laptop has **pushed** `main` (or the branch you deploy) to the remote the server clones from.

On the **server**, either run the bundled script (same steps as below):

```bash
cd /opt/extensilica
chmod +x scripts/update-server.sh   # once, if needed
GIT_BRANCH=main ./scripts/update-server.sh
```

Or manually:

```bash
cd /opt/extensilica
git pull origin GIT_BRANCH
```

If pull aborts on `store-backend/prisma/seed.js` (“local changes would be overwritten”), that file was a stale `tsc` output on the server. Discard it and pull again: `git restore store-backend/prisma/seed.js` then `git pull`. (The repo no longer tracks `seed.js`; seeding uses `prisma/seed.ts` via `npm run run-seed`.)

```bash
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

Optional: clone lives elsewhere — `EXTENSILICA_ROOT=/path/to/ExtenSilica GIT_BRANCH=main ./scripts/update-server.sh`.

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
| 6–7 | CI in this repo (backend + frontend); public `xsil` has its own CI; Sentry/logs optional | `launch-checklist-v3.md` |

---

## CLI release binary (`DEFAULT_REGISTRY`)

Public **`xsil`** releases are built from **[github.com/ExtenSilica/xsil](https://github.com/ExtenSilica/xsil)** (workflow `.github/workflows/cli-release.yml`). Before tagging, set the default registry in that repo’s `cli/src/constants.rs`:

```rust
pub const DEFAULT_REGISTRY: &str = "https://api.extensilica.com";
```

Then tag **in the public xsil repository** (triggers the release workflow):

```bash
git tag cli/v0.1.0
git push origin cli/v0.1.0
```
