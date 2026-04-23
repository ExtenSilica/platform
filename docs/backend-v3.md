# Backend Architecture v3 — XSIL Package Registry Service

**Status:** Target definition (not yet fully implemented)  
**Date:** March 2026  
**Branch:** `pivot/npmjs-like-xsil-registry`  
**Related:** [product-architecture-v3.md](./product-architecture-v3.md), [spec/xsil.md](https://github.com/ExtenSilica/xsil/blob/main/spec/xsil.md)

---

## Purpose

`store-backend` is the authoritative backend service for the ExtenSilica registry. It owns all mutable state in the system: user identities, package ownership, version metadata, file artifact references, download counters, reviews, and search indexes.

It does **not** own `.xsil` binary blobs directly — those live in a separate file store (§6). It stores only the metadata and the URL pointer to the blob.

---

## Current State vs. Target State

| Area | Current (v2) | Target (v3) |
|------|-------------|-------------|
| Auth | None | Email/password + API token |
| Users | None | `User` table with ownership |
| Packages | `Extension` model (no owner) | `Package` model with `ownerId` |
| Versions | `Version` model (no size, no readme) | `Version` model with `size`, `readmeContent`, `checksums` |
| File storage | `xsilUrl` field (placeholder URL) | URL pointing to managed blob store |
| Downloads | `downloads` int on `Extension` (never incremented) | `DownloadEvent` table + aggregation |
| Reviews | None (empty array stub in response) | `Review` table |
| Search | `LIKE` on `name`/`description` | Full-text index on name, description, keywords |
| Publish | None (read-only registry) | `POST /packages`, `POST /packages/:slug/versions` |
| Analytics | None | Per-package download stats (daily/weekly/total) |
| Stale models | `category`, `screenshots`, `rating`, `boards` | Removed or repurposed |
| Legacy routes | `/extensions`, `/trust/*` | Deprecated |

---

## Responsibilities

The backend is responsible for exactly these concerns:

1. **Identity** — register users, authenticate requests, issue and validate API tokens.
2. **Package ownership** — associate packages with user accounts; enforce that only the owner can publish or yank versions.
3. **Package metadata** — store and serve the manifest-derived fields (name, description, author, ISA, keywords, license, targets, checksums) as structured records.
4. **Version catalog** — maintain an ordered, immutable list of published versions per package; track yank status.
5. **File artifact references** — store the URL and integrity checksums for the `.xsil` blob in the file store; serve the blob via a download endpoint that also records the event.
6. **Download accounting** — record a `DownloadEvent` on every blob fetch; aggregate into per-package counters.
7. **Reviews** — store user reviews per package; surface aggregate rating.
8. **Search** — respond to full-text search queries over name, description, and keywords.

The backend is **not** responsible for:

- Executing `.xsil` packages (that is the CLI's job)
- Validating `payloadHash` at upload time (the CLI does this before publishing)
- Serving rendered HTML (that is the frontend's job)
- Storing raw `.xsil` binary blobs (that is the file store's job)

---

## Persistence Model

**Engine:** SQLite (development), PostgreSQL (production)  
**ORM:** Prisma

### Entity relationship overview

```
User ──< Package ──< Version ──< DownloadEvent
              │
              └──< Review ──> User
```

### Table definitions

#### `User`

```
id            Int      PK autoincrement
username      String   unique  — registry handle; used in /~<username> URLs
email         String   unique
passwordHash  String           — bcrypt
apiToken      String   unique  — random 32-byte hex; regenerated on each login
bio           String?
website       String?
createdAt     DateTime default now()
updatedAt     DateTime updatedAt
```

- `apiToken` is the credential used by the CLI (`Authorization: Bearer <token>`).
- `passwordHash` is never returned in any API response.
- `email` is never returned in public endpoints.

#### `Package`

```
id              Int      PK autoincrement
slug            String   unique  — from manifest.name; immutable after first publish
name            String           — display name (may differ from slug)
description     String           — short description (≤ 280 chars)
shortDesc       String?
author          String           — publisher display name (denormalized from User.username)
ownerId         Int      FK → User (onDelete: Restrict)
keywords        String           — CSV, indexed for search
license         String?          — SPDX identifier
repository      String?
homepage        String?
iconUrl         String?
latestVersion   String?          — denormalized; updated on every successful publish
totalDownloads  Int      default 0   — aggregated from DownloadEvent
weeklyDownloads Int      default 0   — updated by scheduled job
createdAt       DateTime default now()
updatedAt       DateTime updatedAt
```

Fields removed from v2 `Extension`: `category`, `screenshots`, `rating`.  
`rating` is replaced by the aggregate of `Review.rating` computed at query time.

#### `Version`

```
id               Int      PK autoincrement
packageId        Int      FK → Package (onDelete: Cascade)
version          String           — semver; unique per package
changelog        String
isa              String           — RISC-V ISA string
toolchain        String?          — toolchain triple/version string
targets          String           — JSON blob of targets object from manifest
keywords         String?          — CSV; version-level override of package keywords
readmeContent    String?          — raw Markdown content of README.md from the archive
size             Int              — total archive size in bytes
xsilUrl          String           — URL in the file store
checksumPayload  String?          — sha256:<hex> of non-manifest files
checksumArchive  String?          — sha256:<hex> of the full .xsil archive
downloadCount    Int      default 0   — per-version counter
isYanked         Boolean  default false
publishedAt      DateTime default now()

@@unique([packageId, version])
```

Fields renamed/replaced from v2 `Version`:
- `payloadHash` → `checksumPayload` (legacy field kept for migration compatibility)
- `packageHash` → `checksumArchive`
- `boards` removed (was an opaque FPGA JSON blob; use `targets` instead)
- `isRevoked` → `isYanked` (clearer registry semantics)
- Added: `size`, `readmeContent`, `checksumArchive`, `downloadCount`

#### `DownloadEvent`

```
id          Int      PK autoincrement
packageId   Int      FK → Package (onDelete: Cascade)
versionId   Int      FK → Version (onDelete: Cascade)
ipHash      String?          — SHA-256 of client IP (never stored raw)
userAgent   String?
country     String?          — derived from IP via GeoIP lookup (optional)
recordedAt  DateTime default now()
```

Deduplication: one event per `(ipHash, versionId)` per 24-hour window prevents
simple download inflation. If `ipHash` is null (anonymous/masked), the event is
counted unconditionally.

#### `Review`

```
id          Int      PK autoincrement
packageId   Int      FK → Package (onDelete: Cascade)
userId      Int      FK → User (onDelete: Cascade)
rating      Int              — 1 to 5
body        String?          — plain text; optional
createdAt   DateTime default now()
updatedAt   DateTime updatedAt

@@unique([packageId, userId])   — one review per user per package
```

---

## API Responsibilities

All endpoints return JSON. Error responses use `{ "error": "<message>" }`.  
Authenticated endpoints require `Authorization: Bearer <token>`.

### Auth — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | — | Create account. Body: `{ username, email, password }`. Returns `{ token, user }`. |
| `POST` | `/auth/login` | — | Authenticate. Body: `{ email, password }`. Returns `{ token, user }`. Regenerates token. |
| `GET`  | `/auth/me` | Required | Returns authenticated user's profile (no email, no hash). |
| `POST` | `/auth/logout` | Required | Invalidates the current API token. |

### Users — `/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/users/:username` | — | Public profile: `{ username, bio, website, packages[] }`. |

### Packages — `/packages`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/packages` | — | List all packages. Query: `?q=`, `?keyword=`, `?isa=`, `?page=`, `?limit=`. |
| `GET`  | `/packages/search` | — | Full-text search alias. Same query params as list. |
| `GET`  | `/packages/:slug` | — | Package metadata + latest non-yanked version. |
| `GET`  | `/packages/:slug/versions` | — | All versions ordered by `publishedAt desc`. |
| `GET`  | `/packages/:slug/versions/:version` | — | Single version metadata. |
| `POST` | `/packages` | Required | Claim a package slug. Body: `{ slug, description, license?, repository?, homepage?, keywords? }`. Owner becomes authenticated user. |
| `POST` | `/packages/:slug/versions` | Required, Owner | Publish a new version. Multipart: `.xsil` file + manifest JSON fields. Backend stores blob and creates `Version` record. |
| `POST` | `/packages/:slug/versions/:version/yank` | Required, Owner | Mark version as yanked. Body: `{ reason? }`. |
| `PATCH`| `/packages/:slug` | Required, Owner | Update mutable package metadata: `description`, `keywords`, `license`, `repository`, `homepage`, `iconUrl`. |

### Downloads — `/packages/:slug/versions/:version/download`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/packages/:slug/versions/:version/download` | — | Redirect (302) or proxy stream to the blob store URL. Records a `DownloadEvent`. Refuses yanked versions (returns 410 Gone). |

### Reviews — `/packages/:slug/reviews`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/packages/:slug/reviews` | — | List reviews. Returns `{ reviews[], averageRating, count }`. |
| `POST` | `/packages/:slug/reviews` | Required | Submit a review. Body: `{ rating, body? }`. One per user per package. |
| `DELETE` | `/packages/:slug/reviews/:id` | Required, Author | Delete own review. |

### Analytics — `/packages/:slug/analytics`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET`  | `/packages/:slug/analytics` | Required, Owner | Download stats: `{ daily[], weekly[], total, byVersion[] }`. |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | `{ ok: true, version: "<semver>" }`. Used by load balancers and uptime monitors. |

### Deprecated routes (to be removed)

The following routes exist for backward CLI/frontend compatibility and will be removed after clients are updated:

- `GET /extensions` → alias for `GET /packages`
- `GET /extensions/:name` → alias for `GET /packages/:slug`
- `GET /api/extensions` → alias for `GET /packages`
- `GET /api/extensions/:name` → alias for `GET /packages/:slug`
- `GET|POST /trust/*` → static stubs; no longer meaningful

---

## Separation: Metadata Storage vs. File Storage

The backend maintains a strict separation between structured metadata and binary blobs.

```
┌─────────────────────────────────┐    ┌────────────────────────────────┐
│       Metadata Database         │    │        File Store              │
│    (SQLite / PostgreSQL)        │    │   (local disk / S3-compatible) │
│                                 │    │                                │
│  User, Package, Version,        │    │  .xsil archive files           │
│  DownloadEvent, Review          │    │  stored as:                    │
│                                 │    │  /<slug>/<version>.xsil        │
│  Version.xsilUrl ───────────────┼───▶│                                │
│  Version.checksumArchive        │    │  Integrity: checksumArchive    │
│  Version.checksumPayload        │    │  verified by CLI at install    │
└─────────────────────────────────┘    └────────────────────────────────┘
```

### Rules

1. **The database never stores raw binary data.** Only the URL and checksums are stored.
2. **`Version.xsilUrl` is an opaque URL.** The backend constructs it when accepting an upload; clients (website and CLI) use it without knowing the storage backend.
3. **Integrity is enforced at the edges:**
   - At **publish time**: the CLI computes checksums locally before uploading.
   - At **install time**: the CLI recomputes `checksumPayload` after download.
   - The backend stores both checksums from the upload request and re-exposes them in version metadata.
4. **The download endpoint is a thin proxy.** It records the `DownloadEvent`, then issues a redirect (or streams) to the blob store. The backend does not re-validate the blob on every download.

### File store layout

```
/xsil-store/
  <slug>/
    <version>.xsil
```

In production, this maps to an S3 bucket or compatible object store (e.g. Cloudflare R2, MinIO). In development, `registry/storage/` (the existing Verdaccio volume) can serve this role temporarily.

---

## Middleware Stack

```
request
  │
  ├─ cors()                    — allow all origins (configurable)
  ├─ express.json()            — parse JSON bodies
  ├─ requestLogger()           — log method, path, status, duration
  ├─ authenticate()            — optional; attaches req.user if valid token present
  │
  ├─ /auth/*                   — no auth required
  ├─ /packages (GET)           — no auth required
  ├─ /packages (POST/PATCH)    — requireAuth middleware
  │     └─ requireOwner()      — check Package.ownerId === req.user.id
  ├─ /packages/:slug/versions (POST) — requireAuth + requireOwner
  ├─ /packages/:slug/analytics — requireAuth + requireOwner
  ├─ /packages/:slug/reviews   — GET: public; POST/DELETE: requireAuth
  │
  └─ errorHandler()            — catch uncaught errors, return { error }
```

---

## Search Indexing

### Current approach (v2)

`LIKE '%q%'` on `name`, `description`, `shortDescription` — case-insensitive substring match on SQLite. Works for small catalogs, does not scale.

### Target approach (v3)

Use SQLite FTS5 (Full-Text Search) extension in development; PostgreSQL full-text search (`tsvector`/`tsquery`) in production.

Indexed fields: `name`, `description`, `keywords`, `author`.

The search response is sorted by a relevance score, with `totalDownloads` as a secondary sort for ties.

---

## Download Counter Aggregation

`DownloadEvent` is the event log. Counters on `Package` and `Version` are denormalized
summaries updated by a background job:

```
Scheduled job (runs every hour):
  1. COUNT DownloadEvent.recordedAt > now() - 7d GROUP BY packageId
     → UPDATE Package SET weeklyDownloads = <count>

  2. COUNT DownloadEvent GROUP BY packageId
     → UPDATE Package SET totalDownloads = <count>

  3. COUNT DownloadEvent GROUP BY versionId
     → UPDATE Version SET downloadCount = <count>
```

Counters are never decremented if events are removed (privacy-related IP purges do not affect counters).

---

## Publish Flow (Backend Perspective)

```
POST /packages/:slug/versions
  Content-Type: multipart/form-data
  Authorization: Bearer <token>

  Fields:
    file          .xsil archive (binary)
    version       semver string
    changelog     string
    isa           string
    targets       JSON string
    toolchain     string (optional)
    keywords      CSV string (optional)
    checksumPayload  sha256:<hex>
    checksumArchive  sha256:<hex>
    size          integer (bytes)
    readmeContent string (optional, Markdown)

Server-side steps:
  1. Authenticate request; resolve User from token.
  2. Verify Package.ownerId === User.id (403 if not).
  3. Validate that Version with this semver does not already exist (409 if duplicate).
  4. Validate semver format; reject non-semver versions.
  5. Write .xsil file to file store at /<slug>/<version>.xsil.
  6. Verify the stored file's SHA-256 matches checksumArchive (400 if mismatch).
  7. INSERT Version record with all fields + constructed xsilUrl.
  8. UPDATE Package SET latestVersion = <version>, updatedAt = now()
     (only if this version is semver-greater than current latestVersion).
  9. Return 201 { version, xsilUrl, publishedAt }.
```

---

## Version Resolution (Backend Perspective)

```
GET /packages/:slug
  → Returns Package + latest non-yanked Version record.
  → "Latest" = highest semver among non-yanked versions.
  → isYanked versions are included in GET /packages/:slug/versions
    but excluded from the default detail response.

GET /packages/:slug/versions/:version
  → Returns the specific Version even if yanked.
  → Adds isYanked: true in the response body when applicable.

GET /packages/:slug/versions/:version/download
  → If isYanked: respond 410 Gone with { error: "This version has been yanked." }
  → Otherwise: record DownloadEvent, redirect to xsilUrl.
```

---

## Notes on Removed Concepts

The following concepts existed in v1/v2 and are explicitly removed:

| Concept | Reason for removal |
|---------|-------------------|
| `developerPublicKey` / `developerCertificate` | Organization trust chain for monetized distribution; not needed for an open registry |
| `developerVerification.level` | Verification tier tied to licensing/payment; no tiers in v3 |
| `category` (fixed enum) | Replaced by free-form `keywords` field |
| `screenshots` | Specific to browser extension presentation; not relevant for RISC-V packages |
| `rating` (float on Package) | Replaced by `Review.rating` aggregated at query time |
| `boards` (opaque JSON on Version) | Renamed and absorbed into `targets` (the manifest's targets object) |
| `isRevoked` (Version) | Renamed to `isYanked` for clarity and alignment with npm semantics |
| `/trust/*` endpoints | Static org key/revocation endpoints from the signature-chain model; not needed |
| `category` query filter | Replaced by `?keyword=` on the search endpoint |
