# ExtenSilica Platform Architecture — v3

**Status:** Canonical  
**Date:** March 2026  
**Branch:** `pivot/npmjs-like-xsil-registry`

This document is the single authoritative reference for the ExtenSilica v3 platform. It supersedes `extensilica-architecture.md`, `product-architecture-v3.md`, and all earlier architecture sketches.

---

## Table of Contents

1. [Product Definition](#1-product-definition)
2. [The `.xsil` Package Format](#2-the-xsil-package-format)
3. [The Website](#3-the-website)
4. [The Registry Backend](#4-the-registry-backend)
5. [The CLI](#5-the-cli)
6. [Authentication Model](#6-authentication-model)
7. [Publishing Flow](#7-publishing-flow)
8. [Install Flow](#8-install-flow)
9. [Versioning Flow](#9-versioning-flow)
10. [Analytics Flow](#10-analytics-flow)
11. [Review Flow](#11-review-flow)
12. [Legal and Support Pages](#12-legal-and-support-pages)

---

## 1. Product Definition

ExtenSilica is a **public registry and execution ecosystem for `.xsil` packages**, focused on reproducible RISC-V extensions and implementations.

It is analogous to [npmjs.com](https://www.npmjs.com/) — but for the RISC-V ecosystem. Users discover, publish, install, and run RISC-V packages. Packages are versioned, self-describing, and designed to run without undeclared host dependencies.

### What ExtenSilica is

| Component | Role |
|-----------|------|
| **Website** | Public registry index — search, package pages, user profiles, documentation |
| **Registry backend** | Source of truth for metadata, versions, files, analytics, reviews |
| **CLI (`xsil`)** | Publish, install, run, test, and query packages from the terminal |
| **`.xsil` format** | The canonical unit of distribution — versioned, portable, self-describing |

### Why it exists

RISC-V extensions, softcores, and toolchains have historically been scattered across repositories with no standard format, no reproducible execution model, and no central discovery layer. ExtenSilica solves this by:

- **Reproducibility** — A `.xsil` package bundles everything needed to run: the ISA description, simulation scripts, toolchain, and test suite. `xsil run <package>` works without manual environment setup.
- **Discoverability** — A public website lets users search and browse packages like they would on npm, with metadata-rich package pages.
- **Versioning** — Semantic versioning is mandatory. Published versions are immutable. The `latest` tag is always the semver-greatest non-yanked version.
- **Simplicity** — No blockchain, no wallets, no pay-per-flash, no commercial license tokens. A package registry with the same model developers already know from npm, crates.io, or PyPI.

### What ExtenSilica is not

- Not a simulation framework — packages bring their own simulator (Spike, QEMU, or others).
- Not an FPGA toolchain — packages optionally include pre-synthesized bitstreams; the platform does not run synthesis.
- Not a marketplace — there are no paid packages, no credits, no licensing tokens.
- Not a browser extension store — all packages are RISC-V software/hardware artifacts.

---

## 2. The `.xsil` Package Format

### 2.1 Definition

A `.xsil` file is a **gzip-compressed tar archive** (identical bytes to `.tar.gz`, with a renamed extension) containing a `manifest.json` at the archive root and a structured directory layout.

One `.xsil` file = one package name at one immutable version.

### 2.2 Archive layout

```
manifest.json          required  — package identity and execution model
README.md              required  — human-readable overview (rendered on package page)
docs/                  required  — extended documentation
tests/                 required  — test suite and test vectors
sim/                   required  — simulation scripts and entry point
toolchain/             required  — self-contained compiler tree
bitstream/             optional  — FPGA bitstreams (only when targets.fpga is present)
assets/                optional  — auxiliary files
```

### 2.3 Manifest fields

#### Required

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Registry slug. Lowercase alphanumeric and hyphens. Unique in registry. |
| `version` | string | Semantic Versioning 2.0.0 — `MAJOR.MINOR.PATCH` (pre-release and build metadata allowed). |
| `description` | string | Short plain-text description (≤ 280 characters). |
| `author` | string | Publisher name or username. |
| `isa` | string | RISC-V ISA string (e.g. `RV64GCV`, `RV32IMAC_Xcustom`). |
| `entry` | string | Path (relative to unpacked root) to the primary execution script. Used by `xsil run`. |
| `toolchain` | object | Describes the bundled toolchain (`prefix`, `version`, `path`). |
| `targets` | object | Supported execution backends. At least one of `spike`, `qemu`, or `fpga`. |
| `checksums` | object | Integrity digests — `archive` (SHA-256 of full `.xsil`) and `payload` (SHA-256 of non-manifest files). |

#### Optional

| Field | Type | Description |
|-------|------|-------------|
| `license` | string | SPDX identifier (e.g. `MIT`, `Apache-2.0`). |
| `repository` | string | Source repository URL. |
| `homepage` | string | Project homepage URL. |
| `keywords` | string[] | Search tags (lowercase, no spaces). |
| `readme` | string | Path to README inside archive (default `README.md`). |
| `testEntry` | string | Path to test entry point. Defaults to `tests/run.sh`. |
| `changelog` | string | Release notes for this version. |

### 2.4 Execution classes

Packages declare supported execution backends in `targets`:

| Key | Class | Notes |
|-----|-------|-------|
| `spike` | Simulator | Spike ISS; the standard default |
| `qemu` | Simulator | QEMU system or user emulation |
| `fpga` | FPGA | Optional; requires `bitstream/` |

`xsil run` defaults to the simulator class. FPGA execution is only triggered explicitly (`--target fpga`) or when no simulator target is declared.

**No global board catalog.** FPGA targets are publisher-defined inside the package. The platform has no enumeration of supported boards.

### 2.5 Integrity model

Two SHA-256 checksums are recorded in `manifest.json`:

| Checksum | Covers |
|----------|--------|
| `checksums.archive` | Entire `.xsil` tarball — verified by CLI before extraction |
| `checksums.payload` | All non-manifest files — verified by CLI after extraction |

If either checksum fails, the CLI aborts installation with a clear error. There is no developer key signing or platform CA in v3.

---

## 3. The Website

**Technology:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui  
**Deployed at:** `extensilica.com`

### 3.1 Page inventory

| Route | Description |
|-------|-------------|
| `/` | Homepage: hero, search bar, featured packages, recent packages, example CLI snippets |
| `/search?q=` | Search results: package cards with keyword and ISA filter |
| `/package/[slug]` | Package detail page |
| `/~[username]` | Publisher profile page |
| `/dashboard` | Authenticated user dashboard (my packages, account settings) |
| `/publish/new` | Create a new package |
| `/publish/[slug]/version` | Publish a new version |
| `/publish/[slug]/settings` | Edit package metadata |
| `/publish/[slug]/maintainers` | Manage package maintainers |
| `/legal/terms` | Terms of Service |
| `/legal/privacy` | Privacy Policy |
| `/faq` | Frequently Asked Questions |

### 3.2 Package detail page

The package detail page (`/package/[slug]`) is the core discovery surface. It is modelled after the npmjs.com package page and contains:

**Header**
- Package name and latest version badge
- Short description and author link
- `xsil install <slug>` one-click copy command
- Average star rating and review count (if any reviews exist)
- Repository and homepage links

**Sections**

| Section | Content |
|---------|---------|
| Install | `xsil install <slug>` — copy button |
| Run | `xsil run <slug>` — copy button |
| README | Rendered Markdown from the package's `README.md` |
| Versions | Semver-sorted table: version, date, downloads, changelog excerpt, install command (hover) |
| Downloads | Stat cards (last 7 days, last 30 days, all time), 30-day daily chart, per-version bar breakdown |
| Reviews | Average rating distribution, submission form (authenticated), list of all reviews |

**Sidebar**
- ISA string
- Toolchain
- Targets
- Keywords
- License
- Total and weekly downloads
- Published / Updated dates
- Maintainers list

### 3.3 Rendering strategy

The package page is a **Next.js server component** (fetches data at request time from the registry API). Interactive sub-sections — reviews form, copy buttons, download charts — are **client components** embedded as islands. This allows good SEO with minimal JavaScript for the static parts.

### 3.4 Authentication state

The web UI stores the API token in `localStorage`. An `AuthContext` / `useAuth` hook is available to all client components. Authenticated routes redirect unauthenticated users to `/login`.

---

## 4. The Registry Backend

**Technology:** Node.js, Express, Prisma ORM, SQLite (dev) / PostgreSQL (prod)  
**API base:** `https://api.extensilica.com`  
**Deployed at:** separate service from the frontend

### 4.1 Responsibilities

The backend is the **single source of truth** for all registry data. It:

- Stores and validates user accounts and API tokens.
- Accepts new package publications (multipart file upload + JSON metadata).
- Serves package metadata, version lists, and `.xsil` file blobs.
- Records download events and exposes aggregated analytics.
- Stores and serves package reviews.
- Manages package maintainer relationships.

The backend does **not** run packages, perform synthesis, or inspect binary content.

### 4.2 Data model

```
User ─────────────────────────┐
 │                             │
 ├──< ownedPackages            │
 ├──< maintainerships          │
 └──< reviews                  │
                               │
Extension (Package) ───────────┘
 ├── slug (unique)
 ├── name, description, author
 ├── keywords, license
 ├── repositoryUrl, homepageUrl
 ├── latestVersion (semver-max non-yanked)
 ├── totalDownloads, weeklyDownloads
 ├── isDeprecated
 ├──< Version[]
 │    ├── version (semver string, unique per package)
 │    ├── xsilUrl (blob storage URL)
 │    ├── checksum, checksumPayload
 │    ├── isa, toolchain, targets (JSON), size
 │    ├── downloadCount
 │    ├── isYanked, yankReason
 │    └──< DownloadEvent[]
 │         ├── day ("YYYY-MM-DD")
 │         └── count (incremented per download per day)
 ├──< Review[]
 │    ├── userId (FK → User)
 │    ├── rating (1–5 integer)
 │    └── comment (optional text)
 └──< Maintainer[]
      ├── userId (FK → User)
      └── role ("owner" | "maintainer")
```

**Key invariants:**
- `(extensionId, version)` is unique — versions are immutable once published.
- `(packageId, userId)` is unique in `Review` — one review per user per package.
- `(packageId, versionId, day)` is unique in `DownloadEvent` — daily bucket strategy.

### 4.3 API surface

All responses are `application/json`. Errors always return `{ "error": "<message>" }`.

#### Public endpoints (no auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/packages` | List/search packages (`?q=`, `?isa=`, `?keyword=`, pagination) |
| `GET` | `/packages/:name` | Package detail with all versions |
| `GET` | `/packages/:name/versions` | All versions, semver-descending |
| `GET` | `/packages/:name/:version` | Single version (`latest` tag supported) |
| `GET` | `/packages/:name/reviews` | All reviews for a package |
| `GET` | `/users/:username` | Public user profile |
| `GET` | `/stats/packages/:name` | Download analytics |
| `GET` | `/uploads/:filename` | `.xsil` blob download (with transparent download tracking) |

#### Authenticated endpoints (Bearer token required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Login; returns API token |
| `POST` | `/auth/logout` | Invalidate token |
| `GET` | `/auth/me` | Current user profile |
| `POST` | `/packages` | Create new package |
| `POST` | `/packages/:name/versions` | Publish new version (multipart: file + metadata) |
| `PATCH` | `/packages/:name` | Edit package metadata |
| `PATCH` | `/users/me` | Edit own profile |
| `POST` | `/packages/:name/reviews` | Submit or update own review |
| `DELETE` | `/packages/:name/reviews/me` | Delete own review |
| `POST` | `/packages/:name/maintainers` | Add maintainer |
| `DELETE` | `/packages/:name/maintainers/:username` | Remove maintainer |

#### HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Validation error |
| 401 | Unauthenticated |
| 403 | Authenticated but not authorised |
| 404 | Not found |
| 409 | Conflict (duplicate version, duplicate username) |
| 410 | Gone (yanked version) |
| 500 | Internal server error |

### 4.4 File storage

In development, `.xsil` files are written to `store-backend/uploads/`. In production, blobs should be stored in an S3-compatible object store with the `xsilUrl` pointing to the public CDN URL.

File downloads are served through the Express server (not directly from the blob store) so that download events can be recorded transparently without requiring client-side tracking.

---

## 5. The CLI

**Binary:** `xsil`  
**Language:** Rust  
**Config:** `~/.extensilica/config.toml`

The CLI is the primary interface for publishers. End users can also use it to install and run packages without visiting the website.

### 5.1 Command reference

| Command | Auth | Description |
|---------|------|-------------|
| `xsil login` | — | Prompt for credentials; store returned token |
| `xsil logout` | ✓ | Invalidate token on server; remove from local config |
| `xsil whoami` | ✓ | Print authenticated user profile |
| `xsil publish <path>` | ✓ | Pack (if directory) and publish `.xsil` to registry |
| `xsil install <pkg[@version]>` | — | Download and unpack to `~/.extensilica/packages/` |
| `xsil run <pkg[@version]>` | — | Install if needed, then execute the package entry point |
| `xsil test <pkg[@version]>` | — | Install if needed, then run the package test entry point |
| `xsil info <pkg[@version]>` | — | Print package metadata and version details |
| `xsil search <query>` | — | Query `GET /packages?q=` and print results |

### 5.2 Version specifiers

All commands that accept a package argument understand the `@version` specifier:

```bash
xsil install rvv-demo@1.2.0        # exact version
xsil install rvv-demo@latest       # semver-greatest non-yanked version (default)
xsil info    rvv-demo@latest       # version info for the latest tag
xsil run     rvv-demo@0.9.0-beta   # pre-release version
```

`@latest` is always resolved at command time against the live registry, not cached.

### 5.3 Local package layout

Installed packages are unpacked to:

```
~/.extensilica/packages/
  <slug>/
    <version>/
      manifest.json
      sim/
      toolchain/
      ...
```

`xsil run` and `xsil test` invoke entry points relative to the unpacked directory. The bundled toolchain is used; no system-wide compiler is required.

### 5.4 Config file

```toml
# ~/.extensilica/config.toml
registry = "https://api.extensilica.com"
token    = "a3f8c2d1e9b7f6..."   # set by xsil login, cleared by xsil logout
```

The config file is not created until the first `xsil login`.

---

## 6. Authentication Model

### 6.1 Overview

Authentication is intentionally simple — the same model used by npm, crates.io, and PyPI. No OAuth, no JWTs, no Web3.

| Property | Value |
|----------|-------|
| Mechanism | Email + password login |
| Token format | 64-char hex string (32 random bytes) |
| Token lifetime | Until the next login or explicit logout |
| Server storage | `User.apiToken`, bcrypt-hashed |
| Client storage (CLI) | `~/.extensilica/config.toml` |
| Client storage (web) | `localStorage` |
| Password hashing | bcrypt, 12 rounds |
| Validation | DB lookup on every request (instant revocation) |

### 6.2 Auth flows

**Registration**
```
POST /auth/register  { username, email, password }
  → validate fields (format, uniqueness)
  → bcrypt.hash(password, 12)
  → INSERT User
  → generate token
  ← 201 { user, token }
```

**Login**
```
POST /auth/login  { email, password }
  → find User by email
  → bcrypt.compare(password, passwordHash)
  → generate new token; invalidate old token
  ← 200 { user, token }
```

**Request authentication**
```
Authorization: Bearer <token>
  → findUnique User where apiToken = token
  → attach user to req.user
  → route handler proceeds
```

**Logout**
```
POST /auth/logout
  → SET User.apiToken = NULL
  ← 200 { ok: true }
```

### 6.3 Account creation rules

| Field | Rule |
|-------|------|
| `username` | 2–32 chars. `[a-z0-9_-]`. Unique (case-insensitive). Immutable after creation. |
| `email` | Must contain `@`. Stored lowercase. Unique. Never returned in public API responses. |
| `password` | Minimum 8 characters. |

### 6.4 Protected endpoints

All write endpoints (publishing, editing metadata, managing maintainers, submitting reviews) require a valid Bearer token. Endpoints that require owner or maintainer status enforce this at the handler level (`requireAuth` middleware + role check).

---

## 7. Publishing Flow

### 7.1 Summary

```
Publisher                  CLI                  Backend
    │                       │                      │
    │  xsil publish ./pkg   │                      │
    │──────────────────────►│                      │
    │                       ├── read manifest       │
    │                       ├── validate semver     │
    │                       ├── compute checksums   │
    │                       ├── pack → .xsil        │
    │                       │                      │
    │                       │  POST /packages/:name/versions
    │                       │  (multipart: file + metadata)
    │                       │─────────────────────►│
    │                       │                      ├── verify token
    │                       │                      ├── verify maintainer
    │                       │                      ├── check version uniqueness
    │                       │                      ├── validate manifest fields
    │                       │                      ├── validate semver
    │                       │                      ├── store .xsil blob
    │                       │                      ├── INSERT Version row
    │                       │                      ├── recompute latestVersion
    │                       │                      │   (semver-max non-yanked)
    │                       │                      ├── UPDATE Extension
    │                       │                 201  │
    │                       │◄─────────────────────│
    │  ✔ Published 1.2.0    │                      │
    │◄──────────────────────│                      │
```

### 7.2 CLI validation (pre-upload)

Before making any network request, `xsil publish` validates locally:

1. `manifest.json` exists and is valid JSON.
2. All required manifest fields are present.
3. `version` is a valid semver string.
4. `entry` path exists inside the archive.
5. `checksums.archive` and `checksums.payload` are computed and written into the manifest.

Failures are reported with the exact field name and exit code `1`.

### 7.3 Backend validation (server-side)

After receiving the multipart upload, the backend checks:

1. Bearer token is valid and the caller is an owner or maintainer of the package.
2. Package `name` in the manifest matches the route `:name`.
3. Version is a valid semver string (`SEMVER_RE`).
4. Version does not already exist for this package (`409` if duplicate).
5. File is a valid gzip-compressed tar archive.

### 7.4 First publish (creating a new package)

`POST /packages` creates the package record first. The `name` in the manifest becomes the slug. Package names must be globally unique, lowercase, and match `[a-z0-9-]+`.

Subsequent `POST /packages/:name/versions` calls add versions to the existing package.

### 7.5 Post-publish state

After a successful publish:
- The `.xsil` blob is stored and accessible at `/uploads/<filename>`.
- The `Version` row is created with `isYanked = false`.
- `Extension.latestVersion` is recomputed to the semver-greatest non-yanked version across all versions of the package.
- The new version is immediately visible on the website package page and installable via `xsil install`.

---

## 8. Install Flow

### 8.1 Summary

```
User                       CLI                  Backend / Blob store
  │                         │                         │
  │  xsil install rvv-demo  │                         │
  │────────────────────────►│                         │
  │                         │  GET /packages/rvv-demo │
  │                         │────────────────────────►│
  │                         │◄────────────────────────│
  │                         ├── resolve version        │
  │                         │   (latest = semver-max  │
  │                         │    non-yanked)           │
  │                         │                         │
  │                         │  GET /uploads/<file>.xsil
  │                         │────────────────────────►│
  │                         │◄── .xsil stream ─────── │ ← download tracked
  │                         │                         │
  │                         ├── verify checksums       │
  │                         ├── extract to             │
  │                         │   ~/.extensilica/        │
  │                         │   packages/rvv-demo/     │
  │                         │   1.2.0/                 │
  │  ✔ Installed rvv-demo@1.2.0                       │
  │◄────────────────────────│                         │
```

### 8.2 Steps

1. **Resolve version.** Query `GET /packages/:name` to retrieve the `latestVersion` (or the specific version if `@version` was provided). If the version is yanked, the CLI refuses to install it and tells the user.
2. **Download.** Fetch the `.xsil` file from `xsilUrl`. The backend handler records a download event fire-and-forget before streaming the file.
3. **Verify integrity.** Compute SHA-256 of the downloaded archive and compare to `checksums.archive`. If mismatched: abort, delete downloaded file, print error.
4. **Extract.** Unpack the gzip-compressed tar archive to `~/.extensilica/packages/<slug>/<version>/`.
5. **Verify payload.** Compute SHA-256 of all non-manifest files and compare to `checksums.payload`. If mismatched: abort, delete extracted directory.
6. **Done.** The package is available locally for `xsil run` and `xsil test`.

### 8.3 Re-install behaviour

If `~/.extensilica/packages/<slug>/<version>/` already exists, `xsil install` skips the download and reports the package as already installed. Use `--force` to re-download and overwrite.

---

## 9. Versioning Flow

### 9.1 Rules

| Rule | Enforcement |
|------|-------------|
| Version string must be valid semver | CLI (`semver::Version::parse`) + backend (`SEMVER_RE`) |
| Published versions are immutable | Unique constraint `(extensionId, version)` + pre-publish check |
| `latestVersion` = semver-max non-yanked version | Recomputed on every publish |
| Versions are returned semver-descending | `sortBySemverDesc` applied in `mapPackage` and `listVersions` |
| `latest` tag is resolved at runtime, not at publish time | CLI `resolve_version` + `GET /packages/:name/:version` with `"latest"` |

### 9.2 Immutability

Publishing `1.0.0` twice returns `409 Conflict`. The only way to fix a released version is to publish a new version number (e.g. `1.0.1`). If a version is critically broken, it can be **yanked**:

```bash
xsil yank rvv-demo@1.0.0
```

Yanked versions are hidden from install resolution but remain in the registry for audit. They appear in the version history table with a "yanked" badge. Yanking is reversible.

### 9.3 Latest tag resolution

```
GET /packages/rvv-demo/latest
  → find all non-yanked versions of rvv-demo
  → semver.maxSatisfying(versions, '*')
  → return Version row for that version
```

Installing a package without specifying a version (`xsil install rvv-demo`) always resolves `latest` against the live registry at install time.

### 9.4 Backport safety

Publishing an older patch after a newer minor has shipped does not change the latest tag:

```
existing: 1.1.0 → latestVersion = "1.1.0"
publish:  1.0.1
result:   latestVersion = "1.1.0"   (unchanged — 1.1.0 > 1.0.1)
```

### 9.5 Version identifiers summary

| Specifier | Resolves to |
|-----------|-------------|
| `@1.2.0` | Exactly version `1.2.0`; fails if yanked |
| `@latest` | Semver-greatest non-yanked version |
| _(none)_ | Equivalent to `@latest` |

---

## 10. Analytics Flow

### 10.1 Design principles

- **Package-centric, not user-centric.** No user identity is stored with download events. The unit is a download of a package version.
- **Simple and auditable.** One table (`DownloadEvent`), one helper (`recordDownload`), one stats endpoint. No external analytics service.
- **Transparent.** All downloads — from the CLI, the web UI, or any HTTP client — are tracked through the same server middleware without any client changes.

### 10.2 Download recording

Every `GET /uploads/:filename` request is intercepted by a custom Express handler:

```
GET /uploads/rvv-demo-1.2.0.xsil
  ↓
resolve Version by xsilUrl (one findFirst query)
  ↓ (async, fire-and-forget — does not block file response)
recordDownload(packageId, versionId)
  ├── UPSERT DownloadEvent { day: "YYYY-MM-DD", count: +1 }
  ├── UPDATE Version.downloadCount += 1
  └── UPDATE Extension.totalDownloads += 1
  ↓
res.sendFile(filePath)
```

The response is never delayed by analytics recording. If `recordDownload` throws, the error is logged but the file is still served.

### 10.3 Data model

```
DownloadEvent
├── id         PK autoincrement
├── packageId  FK → Extension, CASCADE delete
├── versionId  FK → Version, CASCADE delete
├── day        "YYYY-MM-DD"  one row per (package × version × day)
└── count      INT  incremented per download in that day
```

Cached counters for fast list-view queries:

| Field | Model | Updated |
|-------|-------|---------|
| `downloadCount` | `Version` | On every download |
| `totalDownloads` | `Extension` | On every download |

### 10.4 Stats API

```
GET /stats/packages/:name
```

Response:

```json
{
  "slug": "rvv-demo",
  "allTime":    1427,
  "last7Days":   84,
  "last30Days": 312,
  "dailyHistory": [
    { "day": "2026-03-01", "count": 12 },
    ...
  ],
  "byVersion": [
    { "version": "1.2.0", "count90Days": 280 },
    { "version": "1.1.0", "count90Days": 32 }
  ]
}
```

`dailyHistory` covers the last 30 calendar days and fills zero-count days so the frontend can render a continuous chart.

### 10.5 Frontend display

The package page downloads section shows:

- Three stat cards: **Last 7 days**, **Last 30 days**, **All time**.
- A **30-day daily bar chart** (`DailyChart` component — pure CSS bars, no JS charting library).
- A **per-version breakdown** (`VersionBreakdown` — horizontal bars showing relative download share over the last 90 days).

### 10.6 What is not tracked

| Not tracked | Reason |
|-------------|--------|
| Who downloaded (user identity) | Privacy; not needed for package analytics |
| IP addresses | Not logged beyond ephemeral server access logs |
| User-agent strings | Not persisted |
| Page views / search queries | No web analytics; no cookies |

---

## 11. Review Flow

### 11.1 Overview

Any authenticated user can rate and review any package. The system is intentionally minimal: one review per user per package, a 1–5 integer star rating, and an optional free-text comment.

### 11.2 Data model

```
Review
├── id         PK autoincrement
├── packageId  FK → Extension, CASCADE delete
├── userId     FK → User, CASCADE delete
├── rating     INT  1–5 (validated at API layer)
├── comment    TEXT nullable, max 1 000 characters, trimmed
├── createdAt  DATETIME
└── updatedAt  DATETIME

UNIQUE (packageId, userId)   — one review per user per package
```

### 11.3 API endpoints

| Method | Auth | Path | Description |
|--------|------|------|-------------|
| `GET` | — | `/packages/:name/reviews` | List all reviews, newest-first |
| `POST` | ✓ | `/packages/:name/reviews` | Create or update caller's review (upsert) |
| `DELETE` | ✓ | `/packages/:name/reviews/me` | Delete caller's review |

`POST` uses an upsert on `(packageId, userId)` — submitting a second review overwrites the first. This allows a user to update their rating without a separate PATCH endpoint.

### 11.4 Validation

| Rule | Value |
|------|-------|
| `rating` | Integer 1–5; required |
| `comment` | Optional; stripped to 1 000 characters; HTML-sanitised |
| One review per user | Enforced by unique constraint |

### 11.5 Aggregate stats in package detail

`GET /packages/:name` includes review aggregates computed in the same query:

```json
{
  "reviewCount": 14,
  "averageRating": 4.3
}
```

`averageRating` is `null` when `reviewCount` is 0.

### 11.6 Frontend (`ReviewsSection`)

The `ReviewsSection` client component on the package page:

1. Shows overall rating distribution bars (5★ → 1★) and average rating.
2. If the user is authenticated: shows their existing review (if any) and a form to write, edit, or delete it (using `StarPicker` for interactive star selection).
3. Lists all reviews with username, star rating, comment, and date.
4. Calls `apiSubmitReview` / `apiDeleteReview` and refreshes the list on success.

---

## 12. Legal and Support Pages

### 12.1 Pages

| Route | Description |
|-------|-------------|
| `/legal/terms` | Terms of Service — 15 sections |
| `/legal/privacy` | Privacy Policy — 11 sections |
| `/faq` | FAQ — 25 questions in 5 groups |

All three pages share the `LegalPage` layout component, which provides consistent navigation tabs, a "Last updated" date, and styled helper components (`Section`, `Ul`, `Strong`, `C`).

### 12.2 Key positions

**Terms of Service**
- Users are responsible for all content they publish, including executable artifacts.
- The platform may remove packages that violate the terms (malware, illegal content) and may yank versions without notice in egregious cases.
- Published versions are immutable on the author's side; only the platform can force-delete.
- ExtenSilica makes no warranty about the safety of third-party packages.

**Privacy Policy**
- Analytics are package-centric. Download events are stored as aggregate daily buckets with no user identity attached.
- No cookies. No third-party tracking. Auth state is stored in `localStorage` using the API token.
- Package metadata (name, description, author username) is public. Email is never exposed.
- Download events stored indefinitely (package-level count); server access logs retained 30 days.

**FAQ**
- 5 groups: Getting Started, Packages and Publishing, Versioning, Security and Trust, Account and Data.
- Notable answers: executable safety (checksums only; users assume risk), yank vs. deletion, version immutability, naming rules, account deletion, maintainer management.

---

## Component Interaction Summary

```
                          extensilica.com
                         ┌─────────────────────────────────┐
                         │  Next.js Frontend                │
                         │  /         search, home          │
                         │  /package/[slug]  detail page    │
                         │  /~[user]         profiles        │
                         │  /publish/*       publish forms   │
                         │  /legal/*  /faq   static content  │
                         └──────────┬──────────────────────-┘
                                    │ REST JSON (fetch)
                                    │
                         api.extensilica.com
                         ┌──────────▼──────────────────────┐
                         │  Registry Backend                │
                         │  Express + Prisma                │
                         │                                  │
                         │  /auth/*        auth endpoints   │
                         │  /packages/*    metadata CRUD    │
                         │  /uploads/*     blob + tracking  │
                         │  /stats/*       analytics        │
                         │  /users/*       profiles         │
                         └──────────┬──────────────────────┘
                                    │ Prisma
                         ┌──────────▼──────────────────────┐
                         │  SQLite (dev) / PostgreSQL (prod)│
                         │  Users, Extensions, Versions,    │
                         │  DownloadEvents, Reviews,        │
                         │  Maintainers                     │
                         └─────────────────────────────────┘

CLI (xsil — Rust)
  xsil login/logout/whoami  ──►  POST /auth/*
  xsil publish              ──►  POST /packages/:name/versions
  xsil install / run / test ──►  GET /packages/:name → GET /uploads/:file
  xsil info / search        ──►  GET /packages, GET /packages/:name
```

---

## Related documents

| Document | Contents |
|----------|----------|
| [`spec/xsil.md`](https://github.com/ExtenSilica/xsil/blob/main/spec/xsil.md) | Full `.xsil` format specification |
| [`docs/api-v3.md`](./api-v3.md) | Complete REST API reference with request/response examples |
| [`docs/auth-v3.md`](./auth-v3.md) | Auth model, flows, and account rules in detail |
| [`docs/publishing-flow-v3.md`](./publishing-flow-v3.md) | End-to-end publish flow with validation details |
| [`docs/versioning-v3.md`](./versioning-v3.md) | Versioning rules, latest tag resolution, yank behaviour |
| [`docs/analytics-v3.md`](./analytics-v3.md) | Analytics data model, tracking, and stats API |
| [`docs/reviews-v3.md`](./reviews-v3.md) | Review data model, API, and frontend integration |
| [`docs/cli-v3.md`](./cli-v3.md) | Full CLI command reference |
| [`docs/data-model-v3.md`](./data-model-v3.md) | Database schema with all fields and constraints |
| [`docs/security-model.md`](./security-model.md) | Checksum model, yank mechanism, access control |
| [`docs/cleanup-v3.md`](./cleanup-v3.md) | What was removed from v1/v2 and why |
