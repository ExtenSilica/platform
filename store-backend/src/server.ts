import path from 'path';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

// Load `.env` from the store-backend root regardless of PM2/systemd cwd (fixes missing PLATFORM_ADMIN_* etc.).
dotenv.config({ path: path.join(__dirname, '..', '.env') });
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { authenticate } from './middleware/auth';
import authRoutes from './routes/auth';
import governanceRoutes from './routes/governance';
import packageRoutes from './routes/packages';
import statsRoutes from './routes/stats';
import orgRoutes from './routes/orgs';
import legalRoutes from './routes/legal';
import userRoutes from './routes/users';
import platformAdminRoutes from './routes/platformAdmin';
import artifactRoutes from './routes/artifacts';
import wizardRoutes from './routes/wizard';
import meRoutes from './routes/me';
import implementationRequestRoutes from './routes/implementationRequests';
import submissionRoutes from './routes/submissions';
import collisionRoutes from './routes/collision';
import { initStorage, storage } from './storage';
import { specs } from './swagger';
import { prisma } from './db';
import { recordDownload, refreshWeeklyDownloads } from './analytics';
import { logOAuthStartupSummary } from './config/oauth';

const app = express();
const port = process.env.PORT || 3001;

// Behind Caddy / nginx / Cloudflare, the proxy sets X-Forwarded-For. Without trust proxy,
// express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. Default: one hop (typical VPS).
// Set TRUST_PROXY=0 (or false/off) only when Node is reached directly with no proxy.
{
  const trimmed = process.env.TRUST_PROXY?.trim() ?? '';
  const lower = trimmed.toLowerCase();
  if (trimmed === '' || lower === '1' || lower === 'true' || lower === 'on') {
    app.set('trust proxy', 1);
  } else if (lower === '0' || lower === 'false' || lower === 'off') {
    app.set('trust proxy', false);
  } else {
    const n = Number(trimmed);
    app.set('trust proxy', Number.isFinite(n) && n > 0 ? n : 1);
  }
}

// One-line proof on boot (grep extensilica-api-out.log if rate-limit still complains).
console.log(
  '[server] trust proxy:',
  (app as express.Application & { settings?: Record<string, unknown> }).settings?.['trust proxy'],
  'TRUST_PROXY env:',
  JSON.stringify(process.env.TRUST_PROXY ?? null),
);

// Ensure uploads directories exist (used by local driver and avatar storage).
const uploadsDir = path.join(__dirname, '../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const uploadsTmpDir = path.join(uploadsDir, 'tmp');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
if (!fs.existsSync(uploadsTmpDir)) fs.mkdirSync(uploadsTmpDir, { recursive: true });

// ── Request logger ─────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.url} ${res.statusCode} - ${Date.now() - start}ms`);
  });
  next();
});

// ── Core middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Resolve the authenticated user for every request (non-blocking).
// Individual routes call requireAuth when they need a user.
app.use(authenticate);

// ── Documentation ──────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ── Avatar images (static, no download tracking) ───────────────
app.use('/uploads/avatars', express.static(avatarsDir));

// ── Uploaded .xsil file blobs (with download tracking) ─────────
//
// Every GET /uploads/:key is intercepted: we look up the matching Version row by
// xsilUrl and fire-and-forget a recordDownload call, then stream the file from
// the active storage backend.  This works identically for local and S3 drivers —
// clients always download through our server, which preserves download tracking.
app.get('/uploads/:key', async (req: Request, res: Response) => {
  const key = req.params.key;
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const xsilUrl = `${baseUrl}/uploads/${key}`;

  // Fire-and-forget analytics (non-blocking).
  prisma.version.findFirst({ where: { xsilUrl } })
    .then((version) => {
      if (version) return recordDownload(version.extensionId, version.id);
    })
    .catch((err) => {
      console.error('[analytics] failed to record download:', err);
    });

  try {
    const { stream, contentLength, contentType } = await storage.get(key);

    res.setHeader('Content-Type', contentType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${key}"`);
    if (contentLength !== undefined) {
      res.setHeader('Content-Length', contentLength);
    }

    stream.on('error', (err) => {
      console.error('[storage] stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Download failed.' });
      else res.destroy();
    });

    stream.pipe(res);
  } catch {
    res.status(404).json({ error: 'File not found.' });
  }
});

// ── Health ─────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'xsil-registry' });
});

// ── Auth endpoints ─────────────────────────────────────────────
// POST /auth/register  — create account
// POST /auth/login     — authenticate, receive token
// GET  /auth/github/start | /auth/github/callback — GitHub OAuth (optional)
// GET  /auth/google/start  | /auth/google/callback  — Google OAuth (optional)
// POST /auth/oauth/exchange — browser handoff after OAuth redirect (GitHub / Google)
// POST /auth/logout    — invalidate token  (requires auth)
// GET  /auth/me        — current user      (requires auth)
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

// ── XSIL governance points (off-chain ledger; optional EVM link for Aragon claim) ──
app.use('/governance', governanceRoutes);
app.use('/api/governance', governanceRoutes);

// ── Analytics / stats ──────────────────────────────────────────
// GET /stats/packages/:name, GET /stats/adoption
app.use('/stats', statsRoutes);
app.use('/api/stats', statsRoutes);

// ── Package registry ───────────────────────────────────────────
// Public: GET /packages, GET /packages/:slug, GET /packages/:slug/:version
// Authenticated: POST /packages, POST /packages/:slug/versions, PATCH /packages/:slug
app.use('/packages', packageRoutes);
app.use('/api/packages', packageRoutes);

// ── Organizations ───────────────────────────────────────────────
// Public: GET /orgs, GET /orgs/:slug, GET /orgs/:slug/members
// Authenticated: POST /orgs, PATCH /orgs/:slug, DELETE /orgs/:slug
// Membership: POST/PATCH/DELETE /orgs/:slug/members/:username
app.use('/orgs', orgRoutes);
app.use('/api/orgs', orgRoutes);

// ── User profiles ───────────────────────────────────────────────
// Public: GET /users/:username
app.use('/users', userRoutes);
app.use('/api/users', userRoutes);

// ── Platform admin (operators only; see PLATFORM_ADMIN_* env vars) ────────
app.use('/admin', platformAdminRoutes);
app.use('/api/admin', platformAdminRoutes);

// ── Current user resources (auth required on every endpoint) ────────────────
// /me/ownership-requests, /me/ownership-requests/:id/withdraw
app.use('/me', meRoutes);
app.use('/api/me', meRoutes);

// ── Implementation coordination (Phase C) ─────────────────────────────────
app.use('/implementation-requests', implementationRequestRoutes);
app.use('/api/implementation-requests', implementationRequestRoutes);
app.use('/submissions', submissionRoutes);
app.use('/api/submissions', submissionRoutes);

// ── Tool artifacts (optional uploads + resolve API for resolved manifests) ──
app.use('/artifacts', artifactRoutes);
app.use('/api/artifacts', artifactRoutes);

// ── Extension wizard ────────────────────────────────────────────
// POST /wizard/generate — public; returns a `.xsil` skeleton (gzip tar).
app.use('/wizard', wizardRoutes);
app.use('/api/wizard', wizardRoutes);

// ── Collision detection API (shared with CLI contracts) ─────────────────────
app.use('/api', collisionRoutes);

// ── Legal submissions ───────────────────────────────────────────
// POST /legal/dmca — DMCA / IP takedown request (rate-limited)
app.use('/legal', legalRoutes);
app.use('/api/legal', legalRoutes);

// ── Root ───────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ service: 'ExtenSilica XSIL registry', docs: '/api-docs' });
});

// ── Weekly downloads background refresh ────────────────────────
//
// `weeklyDownloads` on Extension is a pre-computed 7-day rolling counter used
// for sort-by-popularity queries.  It cannot be maintained purely by incrementing
// on each download because old download events need to silently age off.
// Instead we recompute it periodically from DownloadEvent rows.
//
// Interval is configurable via WEEKLY_DOWNLOADS_REFRESH_MS (default: 1 hour).
// The function is also called once at startup so the field is accurate immediately
// after a restart.  A self-scheduling setTimeout is used instead of setInterval
// to prevent overlap if a refresh takes longer than the interval.
const WEEKLY_REFRESH_MS =
  parseInt(process.env.WEEKLY_DOWNLOADS_REFRESH_MS ?? '', 10) || 60 * 60 * 1000;

async function scheduleWeeklyRefresh(): Promise<void> {
  try {
    const count = await refreshWeeklyDownloads();
    console.log(`[analytics] weeklyDownloads refreshed for ${count} packages`);
  } catch (err) {
    console.error('[analytics] weeklyDownloads refresh failed:', err);
  }
  setTimeout(scheduleWeeklyRefresh, WEEKLY_REFRESH_MS);
}

// ── Stale open implementation requests (PR-C11) ─────────────────────────────
//
// Emails creators and upstream maintainers once when a request stays `open`
// longer than STALE_OPEN_DAYS (default 30). Disabled when STALE_OPEN_CHECK_ENABLED=0.

const STALE_OPEN_CHECK_ENABLED = process.env.STALE_OPEN_CHECK_ENABLED !== '0';
const STALE_OPEN_CHECK_MS =
  parseInt(process.env.STALE_OPEN_CHECK_MS ?? '', 10) || 24 * 60 * 60 * 1000;
const STALE_OPEN_DAYS = parseInt(process.env.STALE_OPEN_DAYS ?? '', 10) || 30;

async function scheduleStaleOpenCheck(): Promise<void> {
  if (!STALE_OPEN_CHECK_ENABLED) {
    setTimeout(scheduleStaleOpenCheck, STALE_OPEN_CHECK_MS);
    return;
  }
  try {
    const { runStaleOpenNotifications } = await import('./lib/notifyStaleOpenRequests');
    const result = await runStaleOpenNotifications(STALE_OPEN_DAYS);
    if (result.notified > 0) {
      console.log(
        `[implementation] stale-open: notified ${result.notified} request(s), ${result.emailsSent} email(s) sent (scanned ${result.scanned})`,
      );
    }
  } catch (err) {
    console.error('[implementation] stale-open check failed:', err);
  }
  setTimeout(scheduleStaleOpenCheck, STALE_OPEN_CHECK_MS);
}

// Initialize storage driver before accepting traffic.
// Crashes the process on misconfiguration (e.g. bad S3 credentials).
initStorage()
  .then(() => {
    app.listen(port, () => {
      console.log(`XSIL registry listening on port ${port}`);
      logOAuthStartupSummary();
      // Start background maintenance loops after the server is up.
      scheduleWeeklyRefresh();
      scheduleStaleOpenCheck();
    });
  })
  .catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
