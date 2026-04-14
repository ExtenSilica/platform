# Launch Readiness Checklist — ExtenSilica XSIL Registry v3

**Date:** March 2026  
**Branch:** `pivot/npmjs-like-xsil-registry`  
**Target:** Public beta launch at `extensilica.com`

**Status legend:**
- ✅ **done** — implemented, tested, and committed
- 🔲 **pending** — designed and documented; implementation not yet started or incomplete
- 🚫 **blocked** — cannot proceed until a prerequisite is resolved (noted inline)

---

## 1. Site Pages

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1.1 | Home page — hero, search bar, featured packages, recent packages, CLI snippet | ✅ done | `app/page.tsx` |
| 1.2 | Search results page — query param, package cards, ISA/keyword filter | ✅ done | `app/search/page.tsx` + `SearchResults` component |
| 1.3 | Package detail page — all sections (Install, Run, README, Versions, Downloads, Reviews, sidebar) | ✅ done | `app/package/[slug]/page.tsx` |
| 1.4 | User profile page — frontend renders username, bio, package list | ✅ done | `app/users/[username]/page.tsx` |
| 1.5 | Dashboard — authenticated user's packages, account summary | ✅ done | `app/dashboard/page.tsx` |
| 1.6 | Publish new package form | ✅ done | `app/publish/new/page.tsx` |
| 1.7 | Publish new version form — file upload, metadata preview, validation | ✅ done | `app/publish/[slug]/version/page.tsx` |
| 1.8 | Edit package metadata form | ✅ done | `app/publish/[slug]/settings/page.tsx` |
| 1.9 | Manage maintainers form | ✅ done | `app/publish/[slug]/maintainers/page.tsx` |
| 1.10 | Register / Login pages | ✅ done | `app/register/page.tsx`, `app/login/page.tsx` |
| 1.11 | 404 not-found page | ✅ done | `app/not-found.tsx` via Next.js |
| 1.12 | Frontend build passes with no TypeScript or lint errors | ✅ done | `npm run build` clean |

---

## 2. Authentication

| # | Item | Status | Notes |
|---|------|--------|-------|
| 2.1 | `POST /auth/register` — email + password, bcrypt-12, unique checks | ✅ done | `authController.ts` |
| 2.2 | `POST /auth/login` — bcrypt compare, opaque token returned | ✅ done | Token is 32 random bytes (hex) |
| 2.3 | `POST /auth/logout` — sets `apiToken = null` on User row | ✅ done | Instant revocation |
| 2.4 | `GET /auth/me` — returns profile of authenticated user | ✅ done | Requires Bearer token |
| 2.5 | `requireAuth` middleware — validates Bearer token via DB lookup | ✅ done | Used by all protected routes |
| 2.6 | User enumeration protection — constant-time response on bad email | ✅ done | Dummy bcrypt compare |
| 2.7 | Token stored in `localStorage` (web) and `~/.extensilica/config.toml` (CLI) | ✅ done | Both clients implemented |
| 2.8 | `PATCH /auth/me` — update bio, avatarUrl | ✅ done | `updateMe` in `authController.ts`; route wired; dashboard profile form added |
| 2.9 | Password change endpoint | ✅ done | `changePassword` in `authController.ts`; `PATCH /auth/me/password` wired; rotates API token on success; dashboard form added |
| 2.10 | Forgot password / email reset flow | ✅ done | Zoho SMTP via `nodemailer`; `PasswordResetToken` model; `POST /auth/forgot-password` + `POST /auth/reset-password`; /forgot-password + /reset-password pages; link on login page |
| 2.11 | Avatar image upload | ✅ done | `POST /auth/me/avatar` (multer, 2 MB, JPEG/PNG/WebP/GIF); served via `/uploads/avatars`; dashboard avatar picker with preview |
| 2.12 | Rate limiting on `/auth/register` and `/auth/login` | ✅ done | `express-rate-limit`: register 5/15 min, login 10/15 min, forgot-password 5/hr; `RateLimit` + `Retry-After` headers; 429 JSON errors |

---

## 3. Package Publish

| # | Item | Status | Notes |
|---|------|--------|-------|
| 3.1 | `POST /packages` — create new package record | ✅ done | Validates name format (`[a-z0-9-]+`), unique slug |
| 3.2 | `POST /packages/:name/versions` — multipart upload (file + metadata) | ✅ done | `publishVersion` in `packagesController.ts` |
| 3.3 | Manifest validation — required fields, semver check | ✅ done | CLI pre-validates; backend re-validates |
| 3.4 | Version uniqueness enforcement — 409 on duplicate | ✅ done | Prisma unique constraint `(extensionId, version)` |
| 3.5 | Checksum computation — `checksumPayload`, `checksumArchive` | ✅ done | Computed by CLI; stored per-version |
| 3.6 | `.xsil` file stored in `uploads/` | ✅ done | Dev: local filesystem |
| 3.7 | `latestVersion` recomputed after publish (semver-max non-yanked) | ✅ done | `computeLatestVersion` + `semver` package |
| 3.8 | `PATCH /packages/:name` — edit metadata (description, keywords, etc.) | ✅ done | Owner or maintainer required |
| 3.9 | Maintainer management — add/remove, list | ✅ done | `POST/DELETE /packages/:name/maintainers` |
| 3.10 | `PATCH /packages/:name/versions/:version` — yank / unyank a version | ✅ done | `yankVersion` handler; owner/maintainer auth; recomputes `latestVersion`; reason field; frontend version management panel in settings |
| 3.11 | `.xsilignore` support in CLI `pack_directory` | ✅ done | `IgnoreRules` struct with gitignore semantics (globs, `!` negation, dir-only, built-ins); `pack_directory` + `compute_payload_hash` both honour rules; 5 unit tests pass; `examples/rvx-demo/.xsilignore` added |
| 3.12 | Package name reservation / squatting protection | ✅ done | Reserved-name list + length/format enforcement in `createPackage`; policy in `docs/name-policy-v3.md`. Typosquatting similarity checks and automated abandoned-name reclamation are deferred (documented). |
| 3.13 | Scoped packages (`@org/package`) | ✅ done | `Organization` + `OrgMember` schema; full CRUD controller + routes; `normalizePkgName` middleware so all existing package endpoints accept `@scope/name`; `createPackage` validates org membership; `/orgs/[slug]` profile page; dashboard "Organizations" tab with create-org form and member management |
| 3.14 | S3-compatible object storage for production blobs | ✅ done | `StorageProvider` abstraction in `src/storage.ts`; `local` driver (default) and `s3` driver (`@aws-sdk/client-s3`, supports AWS S3 / R2 / B2 / MinIO); `STORAGE_DRIVER=s3` + S3 env vars to activate; download proxy unchanged so tracking still works; Cloudflare R2 recommended (free tier 10 GB, no egress fees) |

---

## 4. Package Page

| # | Item | Status | Notes |
|---|------|--------|-------|
| 4.1 | Header — name, version badge, description, author link, published date | ✅ done | |
| 4.2 | Install command with one-click copy | ✅ done | Copy button component |
| 4.3 | Run command with one-click copy | ✅ done | |
| 4.4 | README section — rendered Markdown | ✅ done | `react-markdown` |
| 4.5 | Versions table — semver-sorted, publish date, downloads, changelog, copy install command on hover | ✅ done | Fetched server-side |
| 4.6 | Downloads section — stat cards (7d / 30d / all-time), 30-day chart, per-version bar | ✅ done | CSS-only charts; no JS library |
| 4.7 | Reviews section — distribution bars, submission form, review list | ✅ done | `ReviewsSection` client component |
| 4.8 | Metadata sidebar — ISA, toolchain, keywords, license, repository, homepage, maintainers | ✅ done | |
| 4.9 | Average rating + review count in header | ✅ done | Included in `GET /packages/:name` response |
| 4.10 | `latest` badge on most recent non-yanked version | ✅ done | Tied to `pkg.latestVersion` |
| 4.11 | Yanked version badge in version history | ✅ done | Shown when `isYanked = true` |
| 4.12 | Package deprecation notice | ✅ done | `deprecationMessage String?` added to schema; prominent amber banner on package page; deprecated cards in search results; settings page shows message textarea when checkbox is checked; `PATCH /packages/:name` accepts `deprecationMessage` |

---

## 5. Versioning

| # | Item | Status | Notes |
|---|------|--------|-------|
| 5.1 | Semver enforcement in CLI (`semver::Version::parse`) | ✅ done | `validate_publish_manifest` |
| 5.2 | Semver enforcement in backend (`SEMVER_RE`) | ✅ done | `publishVersion` controller |
| 5.3 | Published versions are immutable — 409 on duplicate | ✅ done | DB unique constraint |
| 5.4 | `latestVersion` = semver-max non-yanked, recomputed on publish | ✅ done | `computeLatestVersion` |
| 5.5 | Backport safety — publishing `1.0.1` after `1.1.0` does not change latest | ✅ done | semver sort; `latest` never moves backwards |
| 5.6 | Versions returned semver-descending in all API responses | ✅ done | `sortBySemverDesc` in `mapPackage` + `listVersions` |
| 5.7 | `GET /packages/:name/versions` endpoint | ✅ done | |
| 5.8 | `GET /packages/:name/latest` (via `GET /packages/:name/latest`) | ✅ done | `"latest"` tag handled in `getPackageVersion` |
| 5.9 | CLI `@version` specifier — `install slug@1.2.0`, `info slug@latest` | ✅ done | `parse_package_arg` + `resolve_version` |
| 5.10 | CLI downgrade protection — refuses older version without `--force` | ✅ done | Semver comparison in `cmd_install` |
| 5.11 | `xsil yank <package>@<version>` CLI command | ✅ done | `Yank` added to `Commands`; `registry.yank_version()` calls `PATCH /packages/:slug/versions/:version`; supports `--reason`, `--restore`, scoped `@scope/pkg@x.y.z`; `parse_package_arg` fixed to handle scoped identifiers |
| 5.12 | Backend yank endpoint — `PATCH /packages/:name/versions/:version` | ✅ done | See 3.10 |

---

## 6. Download Stats

| # | Item | Status | Notes |
|---|------|--------|-------|
| 6.1 | `DownloadEvent` table — daily buckets `(packageId, versionId, day, count)` | ✅ done | Prisma schema |
| 6.2 | `recordDownload` helper — atomic upsert on daily bucket + counter increments | ✅ done | `store-backend/src/analytics.ts` |
| 6.3 | Download tracking middleware on `GET /uploads/:filename` | ✅ done | Fire-and-forget; does not delay file response |
| 6.4 | `Version.downloadCount` and `Extension.totalDownloads` counters | ✅ done | Incremented on every download |
| 6.5 | `GET /stats/packages/:name` — allTime, last7Days, last30Days, dailyHistory, byVersion | ✅ done | `statsController.ts` |
| 6.6 | Zero-gap `dailyHistory` — missing days filled with 0 | ✅ done | `buildDailyHistory` in stats controller |
| 6.7 | Frontend stat cards (7d / 30d / all-time) | ✅ done | Package page Downloads section |
| 6.8 | Frontend 30-day daily bar chart (`DailyChart`) | ✅ done | Pure CSS; no JS chart library |
| 6.9 | Frontend per-version download breakdown (`VersionBreakdown`) | ✅ done | |
| 6.10 | `weeklyDownloads` field on `Extension` — updated periodically | ✅ done | `refreshWeeklyDownloads()` in `analytics.ts`; self-scheduling `setTimeout` loop in `server.ts` (default 1 h, override via `WEEKLY_DOWNLOADS_REFRESH_MS`); also runs at startup; `POST /stats/refresh` for on-demand trigger |

---

## 7. Package Reviews

| # | Item | Status | Notes |
|---|------|--------|-------|
| 7.1 | `Review` table — one per `(packageId, userId)` unique constraint | ✅ done | Prisma schema |
| 7.2 | `GET /packages/:name/reviews` — public, newest-first | ✅ done | `reviewsController.ts` |
| 7.3 | `POST /packages/:name/reviews` — upsert (create or overwrite own review) | ✅ done | Requires Bearer token |
| 7.4 | `DELETE /packages/:name/reviews/me` — delete own review | ✅ done | |
| 7.5 | Rating validation — integer 1–5, enforced at API layer | ✅ done | |
| 7.6 | Comment sanitisation — trimmed, max 1 000 characters | ✅ done | |
| 7.7 | `reviewCount` and `averageRating` in `GET /packages/:name` response | ✅ done | Prisma aggregate computed per request |
| 7.8 | `ReviewsSection` client component — distribution bars, form, list | ✅ done | `components/reviews-section.tsx` |
| 7.9 | `StarPicker` interactive rating input | ✅ done | `components/star-rating.tsx` |
| 7.10 | Authenticated user can see and edit their own existing review | ✅ done | Upsert via `POST`; form pre-fills on re-open |

---

## 8. Legal and Support Pages

| # | Item | Status | Notes |
|---|------|--------|-------|
| 8.1 | Terms of Service — 15 sections including author responsibility and executable artifacts | ✅ done | `app/legal/terms/page.tsx` |
| 8.2 | Privacy Policy — 11 sections; package-centric analytics, no cookies | ✅ done | `app/legal/privacy/page.tsx` |
| 8.3 | FAQ — 25 questions in 5 thematic groups | ✅ done | `app/faq/page.tsx` |
| 8.4 | Shared `LegalPage` layout component — tabbed nav, consistent styling | ✅ done | `components/legal-page.tsx` |
| 8.5 | Footer links to Terms, Privacy, FAQ on every page | ✅ done | |
| 8.6 | Dedicated contact email referenced in legal pages | ✅ done | `legal@extensilica.com` mailbox active (Zoho Mail); linked in Privacy §11, Terms §15, FAQ "delete account", FAQ "report abuse", and FAQ footer CTA |
| 8.7 | DMCA / takedown request process | ✅ done | `/legal/dmca` page with full form; `POST /api/legal/dmca` backend (rate-limited 5/hr); emails `legal@extensilica.com`; counter-notice process documented; ToS §7 + FAQ updated to link there |

---

## 9. First Demo Package

| # | Item | Status | Notes |
|---|------|--------|-------|
| 9.1 | `examples/rvx-demo/` directory created with full package layout | ✅ done | All required dirs present |
| 9.2 | Valid `manifest.json` — all required fields, correct semver, targets | ✅ done | `rvx-demo@1.0.0`, ISA `RV64GC` |
| 9.3 | `checksums.payload` computed and embedded in manifest | ✅ done | `sha256:213d6af5…` — verified by CLI |
| 9.4 | `sim/run.sh` — tries Spike → QEMU → demo mode fallback | ✅ done | Exits 0 on any machine |
| 9.5 | `tests/run.sh` — 4 assertions, all pass | ✅ done | Verified: `xsil test examples/rvx-demo` |
| 9.6 | `xsil run examples/rvx-demo` passes with integrity check | ✅ done | Payload hash verified ✓ |
| 9.7 | `xsil publish examples/rvx-demo --dry-run` passes | ✅ done | Packs to 5 607 bytes, checksums match |
| 9.8 | `README.md` suitable for registry page — badges, quick start, table | ✅ done | |
| 9.9 | `toolchain/README.md` — apt, brew, from-source install instructions | ✅ done | |
| 9.10 | `rvx-demo` seeded in dev database | ✅ done | `store-backend/prisma/seed.ts` |
| 9.11 | `rvx-demo` published to production registry | 🚫 blocked | Blocked on 12.1 (PostgreSQL), 12.3 (TLS), 12.4 (API DNS), 12.5 (frontend DNS). Script ready at `scripts/publish-rvx-demo.sh`. CLI `DEFAULT_REGISTRY` in `cli/src/constants.rs` must be updated to `https://api.extensilica.com` before release build. |

---

## 10. CLI Commands

| # | Item | Status | Notes |
|---|------|--------|-------|
| 10.1 | `xsil login` — prompts for email + password, stores token | ✅ done | |
| 10.2 | `xsil logout` — invalidates token on server, clears local config | ✅ done | |
| 10.3 | `xsil whoami` — prints authenticated user profile | ✅ done | |
| 10.4 | `xsil publish <path>` — validates, packs, uploads; supports `--changelog`, `--dry-run` | ✅ done | |
| 10.5 | `xsil install <pkg[@version]>` — resolves, downloads, verifies, extracts | ✅ done | Supports `--force`, `--override-security` |
| 10.6 | `xsil run <pkg[@version]>` — install if needed, execute `entry` | ✅ done | Verified on `rvx-demo` |
| 10.7 | `xsil test <pkg[@version]>` — install if needed, run `testEntry` | ✅ done | Verified on `rvx-demo` |
| 10.8 | `xsil info <pkg[@version]>` — registry metadata + local install status | ✅ done | Handles `@latest` specifier |
| 10.9 | `xsil search <query>` — queries registry, prints package list | ✅ done | |
| 10.10 | Payload hash verification on every install/run | ✅ done | Aborts if mismatch |
| 10.11 | Downgrade protection — refuses `install` of older version without `--force` | ✅ done | |
| 10.12 | `--dry-run` global flag — validates + packs without uploading | ✅ done | |
| 10.13 | `xsil yank <pkg>@<version>` | ✅ done | Implemented — see 5.11 |
| 10.14 | CLI binary distributed as a single static release artifact | ✅ done | `.github/workflows/cli-release.yml` — triggered by `git tag cli/vX.Y.Z`; cross-compiles 5 targets (Linux x86_64 musl, Linux ARM64 musl, macOS Intel, macOS Apple Silicon, Windows x86_64); attaches archives + `SHA256SUMS.txt` to a GitHub Release; Linux musl binaries are fully static |
| 10.15 | Install script (`curl … \| sh`) or package manager distribution | ✅ done | `store-frontend/public/install.sh` served at `https://extensilica.com/install.sh` (Linux + macOS; detects arch; verifies SHA-256; installs to `/usr/local/bin` or `~/.local/bin`). `install.ps1` at `https://extensilica.com/install.ps1` for Windows (`irm … \| iex`; auto-adds to user PATH). Both scripts auto-detect latest release from GitHub API and support `XSIL_VERSION` / `XSIL_INSTALL_DIR` overrides. |

---

## 11. Backend Missing Endpoints

These API routes are specified in `docs/api-v3.md` and are implemented in the backend (see table below for file references). This section is kept as a cross-check against the spec:

| # | Endpoint | Status | Impact |
|---|----------|--------|--------|
| 11.1 | `GET /users/:username` — public profile | ✅ done | `usersController.ts` + `routes/users.ts`; mounted at `/users` and `/api/users`; returns `id`, `username`, `bio`, `avatarUrl`, `createdAt`, `packages[]`; never exposes email/password; 404 on unknown user |
| 11.2 | `PATCH /auth/me` — update bio, avatarUrl | ✅ done | `updateMe` handler, route, and dashboard form all implemented |
| 11.3 | `PATCH /packages/:name/versions/:version` — yank/unyank | ✅ done | Backend: `yankVersion` in `packagesController.ts`; routes `PATCH /packages/:name/versions/:version` + scoped `/@:scope/:name/...`. Web: **Version management** on `/publish/[slug]/settings` (`apiYankVersion`). CLI: **`xsil yank pkg@ver`** / **`xsil yank pkg@ver --restore`** (`5.11`, `10.13`) |
| 11.4 | `POST /packages/:name/deprecate` | ✅ done | **Not implemented as POST** (by design). Deprecation uses **`PATCH /packages/:name`** with `{ isDeprecated, deprecationMessage }` in `updatePackage` — persisted on `Extension`, returned in `mapPackage`, editable in `/publish/[slug]/settings`, shown on package page + search cards. Max 500 chars for message; clearing `isDeprecated` clears the message server-side. |

---

## 12. Infrastructure and Production

**What belongs here:** Items **12.3–12.8** are **operations-only** — they do not get “implemented” in application source; they complete when **DNS, TLS, secrets, deploy, and first prod data** exist (same idea as **12.3**). **12.6** is filling real secrets on the host (Vercel/Railway/env), not a repo change. **12.10–12.11** are **code you can add in the repo** (Sentry SDK, JSON logger) and then enable in prod with env vars — useful on staging too, not strictly prod-only. **12.9** already has **rate limits on auth** in code; widening limits to *all* public routes is optional hardening. **12.13–12.14** are **done in-repo** (GitHub Actions); they run on every push regardless of environment.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 12.1 | Production PostgreSQL database | ✅ done (code) | Prisma `provider = postgresql`; `DATABASE_URL` in `.env` + `.env.example`; initial migration `prisma/migrations/*_init_postgres/`. **Local dev:** install PostgreSQL on the OS (or use a hosted dev DB); **production:** Neon / Supabase / RDS + `DATABASE_URL` on the server. |
| 12.2 | S3-compatible object storage for `.xsil` blobs | ✅ done | **Already implemented** (`3.14`, `store-backend/src/storage.ts`). `STORAGE_DRIVER=s3` + R2/S3/B2 env vars. **`xsilUrl` stays `BASE_URL/uploads/<key>`** on purpose: the API proxies every download so analytics (`recordDownload`) stay correct; blobs may live in R2 while clients never need a second URL scheme. **CDN-friendly:** put Cloudflare (or any CDN) in front of `BASE_URL`; cache `GET /uploads/*` at the edge if you want. R2 + Cloudflare is a common pattern (no S3 egress to the public internet from the bucket when served via your API + optional CDN). |
| 12.3 | TLS / HTTPS on API and frontend | 🔲 pending (ops) | **Not something the app “implements”** — TLS is terminated by the host (Vercel / Cloudflare / Caddy+Let’s Encrypt / nginx / Railway, etc.). The codebase already assumes `BASE_URL` / `SITE_URL` / `NEXT_PUBLIC_API_URL` can be `https://…` in production; local dev stays `http://localhost`. **Mark this done only after** both `api.extensilica.com` and `extensilica.com` serve HTTPS in prod. See deploy runbook §1.6. |
| 12.4 | `api.extensilica.com` DNS and backend deployment | 🔲 pending (ops) | Point DNS to your API host; deploy Node backend. No app code change. |
| 12.5 | `extensilica.com` DNS and frontend deployment (Vercel / static host) | 🔲 pending (ops) | Connect repo to Vercel (or similar); set `NEXT_PUBLIC_API_URL`. HTTPS usually included. |
| 12.6 | Environment variable secrets (database URL, `BASE_URL`) | 🔲 pending (ops) | Templates exist (`.env.example`); you still copy real secrets into the **production** host — not committed to git. |
| 12.7 | Database migration run in production | 🔲 pending (ops) | One-time: `npx prisma migrate deploy` against prod `DATABASE_URL` after **12.1** DB exists. Same migration files as dev. |
| 12.8 | Production seed (or first real publish) | 🔲 pending (ops) | Optional `npm run run-seed` on prod **or** first real `xsil publish` (e.g. `rvx-demo`, `9.11`). Blocked until API+DB+storage live. |
| 12.9 | Rate limiting on auth endpoints | 🔲 partial | **Code:** `express-rate-limit` on register/login/forgot-password + DMCA (`auth.ts`, `legal.ts`). “All public endpoints” stricter limits = optional follow-up, not required for first HTTPS launch. |
| 12.10 | Error monitoring (Sentry or equivalent) | 🔲 pending | **Code + ops:** add SDK in repo; set `SENTRY_DSN` (or similar) in prod. Can run on staging first. |
| 12.11 | Structured logging (JSON format for log aggregation) | 🔲 pending | **Code:** replace/adorn `console.log` with `pino`/`winston` JSON — deployable to prod and useful locally with `LOG_FORMAT=json`. |
| 12.12 | Health check endpoint | ✅ done | `GET /health → { ok: true }` |
| 12.13 | CI pipeline (lint + build + test on push) | ✅ done | `.github/workflows/ci.yml` — runs on every push/PR; jobs: `cli-check` (fmt + clippy + test + build), `backend-check` (tsc --noEmit), `frontend-check` (next build) |
| 12.14 | CLI release pipeline (cross-compile, publish artifacts) | ✅ done | See 10.14 — `.github/workflows/cli-release.yml` |

---

## Summary

| Area | Done | Pending | Blocked |
|------|------|---------|---------|
| Site pages | 12 / 12 | 0 | 0 |
| Authentication | 7 / 12 | 5 | 0 |
| Package publish | 9 / 14 | 5 | 0 |
| Package page | 11 / 12 | 1 | 0 |
| Versioning | 10 / 12 | 2 | 0 |
| Download stats | 9 / 10 | 1 | 0 |
| Reviews | 10 / 10 | 0 | 0 |
| Legal pages | 5 / 7 | 2 | 0 |
| Demo package | 10 / 11 | 1 | 0 |
| CLI commands | 12 / 15 | 3 | 0 |
| Missing endpoints | 4 / 4 | 0 | 0 |
| Infrastructure | 5 / 14 | 9 | 0 |
| **Total** | **104 / 133** | **28** | **1** |

**Product core (features a user would encounter in a normal session) is ~79% complete.**  
**Infrastructure (required for any production launch) is the critical path.**

---

## Deployment runbook

All post-deploy actions, in sequential order, are tracked in **[`docs/deploy-runbook.md`](./deploy-runbook.md)**.  
Update that file as each step is completed.

---

## Recommended next steps before launch

### P0 — must-have before opening to any users
1. Stand up production PostgreSQL + run migrations (`12.1`, `12.7`)
2. ~~Stand up S3-compatible blob storage; point `BASE_URL` at it (`12.2`, `12.8`) — code DONE; needs account + bucket + env vars~~  ← Cloudflare R2 recommended
3. Enable TLS on both `api.extensilica.com` and `extensilica.com` (`12.3`)
4. Implement `GET /users/:username` backend route (`11.1`)
5. ~~Rate-limit `/auth/register` and `/auth/login` (`2.12`) — DONE~~
6. Publish `rvx-demo` to the production registry (`9.11`)

### P1 — should have for a credible public beta
7. ~~`PATCH /packages/:name/versions/:version` (`3.10`, `5.12`, `11.3`) — DONE~~
   ~~`xsil yank` CLI (`5.11`, `10.13`) — DONE~~
8. ~~`PATCH /auth/me` profile update (`2.8`, `11.2`) — DONE~~
9. Set up CI pipeline (lint + build) (`12.13`)
10. Set up CLI release artifact pipeline (`10.14`)

### P2 — nice to have before general availability
11. ~~Password reset flow (`2.10`) — DONE~~
12. ~~`.xsilignore` support in CLI pack (`3.11`) — DONE~~
13. ~~Package name reservation / squatting protection (`3.12`) — DONE~~
14. ~~`weeklyDownloads` background refresh job (`6.10`)~~ ✅
15. Error monitoring + structured logging (`12.10`, `12.11`)
16. ~~Organization / scoped packages (`3.13`) — DONE~~
