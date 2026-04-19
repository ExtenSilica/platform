import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
import { authenticate } from './middleware/auth';
import authRoutes from './routes/auth';
import packageRoutes from './routes/packages';
import statsRoutes from './routes/stats';
import orgRoutes from './routes/orgs';
import legalRoutes from './routes/legal';
import userRoutes from './routes/users';
import { initStorage, storage } from './storage';
import { specs } from './swagger';
import { prisma } from './db';
import { recordDownload, refreshWeeklyDownloads } from './analytics';
import { logOAuthStartupSummary } from './config/oauth';

const app = express();
const port = process.env.PORT || 3001;

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
// POST /auth/oauth/exchange — browser handoff after GitHub redirect
// POST /auth/logout    — invalidate token  (requires auth)
// GET  /auth/me        — current user      (requires auth)
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

// ── Analytics / stats ──────────────────────────────────────────
// GET /stats/packages/:name
app.use('/stats', statsRoutes);

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

// Initialize storage driver before accepting traffic.
// Crashes the process on misconfiguration (e.g. bad S3 credentials).
initStorage()
  .then(() => {
    app.listen(port, () => {
      console.log(`XSIL registry listening on port ${port}`);
      logOAuthStartupSummary();
      // Start the weekly-downloads refresh loop after the server is up.
      scheduleWeeklyRefresh();
    });
  })
  .catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
