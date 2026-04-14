# Product Architecture v3 — ExtenSilica XSIL Registry

**Status:** Draft  
**Version:** 3.0  
**Date:** March 2026  
**Branch:** `pivot/npmjs-like-xsil-registry`

This document describes the target architecture for ExtenSilica as a public package registry and execution ecosystem for `.xsil` packages, analogous to npmjs.com for the RISC-V ecosystem.

---

## Overview

ExtenSilica is composed of four major components that work together to form a complete package lifecycle:

```
┌──────────────────────────────────────────────────────────┐
│                     Public Website                        │
│   (Next.js — discovery, package pages, search, docs)     │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTP (REST JSON)
┌────────────────────▼─────────────────────────────────────┐
│                  Registry Backend                         │
│  (Express + Prisma — users, packages, versions, files,   │
│   downloads, analytics)                                  │
└──────┬──────────────────────────────────┬────────────────┘
       │ blob storage                     │ metadata API
┌──────▼──────────┐              ┌────────▼───────────────┐
│   File Store    │              │      CLI (xsil)         │
│  (.xsil blobs)  │              │  (Rust — login, publish,│
└─────────────────┘              │  install, run, test,    │
                                 │  info, search)          │
                                 └────────────────────────┘
```

All four components share the `.xsil` package format as the canonical unit of distribution.

---

## Component 1 — Public Website

**Technology:** Next.js 14 (App Router), TypeScript, Tailwind CSS  
**Deployed at:** `extensilica.com`

### Responsibilities

| Page / Route | Description |
|-------------|-------------|
| `/` | Homepage: hero, feature summary, package grid (recent/popular) |
| `/search?q=<term>` | Full-text search results with filter by keyword/ISA |
| `/package/<slug>` | Package detail page |
| `/package/<slug>/versions` | Full version history |
| `/~<username>` | Publisher profile: account info and list of owned packages |
| `/docs/<slug>` | Documentation pages (spec, publishing guide, CLI reference) |
| `/legal/privacy` | Privacy policy |
| `/legal/terms` | Terms of service |

### Package page content

A package page at `/package/<slug>` mirrors the structure of a canonical package registry page:

- **Header:** name, latest version badge, short description, author link, published date
- **Install command:** `xsil install <slug>` (one-click copy)
- **Readme:** rendered Markdown from the `readme` field in the manifest
- **Versions tab:** table of all published versions — version string, publish date, download count, changelog, `.xsil` download link
- **Metadata sidebar:** ISA, keywords/tags, license, repository link, homepage link, total downloads, weekly downloads, package size

### Search

- Search bar in the navbar on every page; queries `GET /packages/search?q=`
- Results page shows package cards: name, description, author, latest version, download count
- Filterable by keyword and ISA string

### Documentation pages

Static MDX pages for:
- `.xsil` format spec (rendered from `spec/xsil.md`)
- Publishing guide
- CLI reference
- Reproducibility rationale

### Legal pages

Static pages for privacy policy and terms of service. No dynamic backend dependency.

---

## Component 2 — Registry Backend

**Technology:** Node.js, Express, Prisma ORM, SQLite (dev) / PostgreSQL (prod)  
**Serves:** `api.extensilica.com` or `extensilica.com/api`

### Responsibilities

The backend is the single source of truth for all mutable registry state: user identities, package ownership, version metadata, blob references, and download counters.

### Data model

```
User
  id            Int      PK
  username      String   unique
  email         String   unique
  passwordHash  String
  apiToken      String   unique (generated on login)
  bio           String?
  website       String?
  createdAt     DateTime

Package
  id            Int      PK
  slug          String   unique          -- registry name, from manifest.name
  name          String
  description   String
  shortDesc     String?
  author        String                   -- display name
  ownerId       Int      FK → User
  keywords      String                   -- CSV
  license       String?
  repository    String?
  homepage      String?
  iconUrl       String?
  totalDownloads Int     default 0
  weeklyDownloads Int    default 0       -- updated by analytics job
  latestVersion String?                  -- denormalized for fast reads
  createdAt     DateTime
  updatedAt     DateTime

Version
  id            Int      PK
  packageId     Int      FK → Package
  version       String                   -- semver
  changelog     String
  isa           String
  toolchain     String?
  targets       String                   -- JSON blob
  keywords      String                   -- CSV (version-level override)
  readme        String?                  -- rendered HTML or raw Markdown
  size          Int                      -- archive bytes
  xsilUrl       String                   -- blob storage URL
  checksumPayload String?
  checksumArchive String?
  isYanked      Boolean  default false
  publishedAt   DateTime
  @@unique([packageId, version])

DownloadEvent
  id            Int      PK
  packageId     Int      FK → Package
  versionId     Int      FK → Version
  ip            String?  (hashed, for dedup)
  userAgent     String?
  country       String?
  recordedAt    DateTime

Review
  id            Int      PK
  packageId     Int      FK → Package
  userId        Int      FK → User
  rating        Int      (1–5)
  body          String?
  createdAt     DateTime
  @@unique([packageId, userId])
```

### API surface

**Auth**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Create account. Body: `{ username, email, password }`. Returns API token. |
| `POST` | `/auth/login` | Authenticate. Body: `{ email, password }`. Returns API token. |
| `GET`  | `/auth/me` | Return authenticated user profile. Requires `Authorization: Bearer <token>`. |

**Users**

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/users/:username` | Public profile and list of owned packages. |

**Packages**

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/packages` | List all packages (paginated). Query: `?q=`, `?page=`, `?limit=`. |
| `GET`  | `/packages/search` | Full-text search. Query: `?q=`, `?isa=`, `?keyword=`. |
| `GET`  | `/packages/:slug` | Package metadata + latest version. |
| `GET`  | `/packages/:slug/versions` | All published versions. |
| `GET`  | `/packages/:slug/versions/:version` | Specific version metadata. |
| `POST` | `/packages` | Create a new package name (claim slug). Auth required. |
| `POST` | `/packages/:slug/versions` | Publish a new version. Multipart: `.xsil` file + manifest fields. Auth required. Owner only. |
| `POST` | `/packages/:slug/versions/:version/yank` | Mark a version as yanked. Auth required. Owner only. |

**Downloads**

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/packages/:slug/versions/:version/download` | Stream `.xsil` file. Records a `DownloadEvent`. |

**Analytics**

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/packages/:slug/analytics` | Download counts by day/week/month. Auth required. Owner only. |

**Reviews**

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/packages/:slug/reviews` | List reviews for a package. |
| `POST` | `/packages/:slug/reviews` | Submit a review. Auth required. |
| `DELETE` | `/packages/:slug/reviews/:id` | Delete own review. Auth required. |

---

## Component 3 — CLI (`xsil`)

**Technology:** Rust, Cargo  
**Installed via:** `cargo install xsil` (or binary release)

### Responsibilities

The CLI is the primary tool for developers and users to interact with the registry from the terminal. It handles authentication, package publishing, installation, execution, testing, and discovery.

### Commands

#### `xsil login`

Authenticates the user with the registry and stores an API token locally.

```
xsil login [--registry <url>]
```

1. Prompts for `email` and `password` (or reads from env: `XSIL_TOKEN`).
2. Calls `POST /auth/login`.
3. Stores the returned API token in `~/.extensilica/config.toml`.

#### `xsil publish <path>`

Packs a directory or an existing `.xsil` file and publishes it to the registry.

```
xsil publish <path> [--registry <url>] [--dry-run]
```

1. Reads `manifest.json` from `<path>`.
2. Validates all required manifest fields.
3. Computes `checksums.payload` (SHA-256 over all non-manifest files) and `checksums.archive`.
4. Packs the directory into a `.xsil` archive (gzip-tar).
5. Calls `POST /packages` if the slug does not yet exist.
6. Calls `POST /packages/:slug/versions` with the `.xsil` file and manifest metadata.
7. Prints the published package URL on success.

`--dry-run` performs all local steps (validation, packing, hashing) without uploading.

#### `xsil install <package>`

Downloads and installs a package from the registry.

```
xsil install <package> [--version <ver>] [--force]
```

`<package>` accepts: registry slug, `slug@version`, local `.xsil` file, or unpacked directory.

#### `xsil run <package>`

Fetches (if needed), verifies, and executes the package's `entry` script.

```
xsil run <package> [--version <ver>] [--target spike|qemu|fpga]
```

#### `xsil test <package>`

Fetches (if needed), verifies, and runs the package's `testEntry` or `tests/run.sh`.

```
xsil test <package> [--version <ver>]
```

#### `xsil info <package>`

Displays registry metadata and local install status for a package.

```
xsil info <package>
```

Output includes: name, description, latest version, author, ISA, keywords, download count, local install path (if installed).

#### `xsil search <term>`

Searches the registry by name, description, or keyword.

```
xsil search <term> [--isa <isa>] [--limit <n>]
```

Calls `GET /packages/search?q=<term>` and renders results as a formatted table.

### Local config

`~/.extensilica/config.toml`

```toml
registry = "https://api.extensilica.com"
token    = "<api-token>"
```

### Install directory

`~/.extensilica/extensions/<slug>/<version>/`

---

## Component 4 — XSIL Package Format

Full normative definition: **[spec/xsil.md](../spec/xsil.md)**

### Package metadata

Captured in `manifest.json` at the archive root. Key identity fields:

| Field | Role |
|-------|------|
| `name` | Registry slug. Globally unique within the registry. Immutable after first publish. |
| `version` | Semver. Each version is immutable once published. |
| `description` | Short description (≤ 280 chars). Shown in search results. |
| `author` | Publisher username. Must match the authenticated account at publish time. |
| `license` | SPDX identifier. Displayed on the package page. |
| `keywords` | Search tags. Indexed for search. |
| `isa` | RISC-V ISA string. Shown in the metadata sidebar. |
| `checksums` | `payload` and `archive` SHA-256 digests. Enforced by the CLI at every run. |

### Package versioning

- Versions use [Semantic Versioning 2.0.0](https://semver.org/).
- Each version is **immutable** once published.
- Versions can be **yanked** by the owner; yanked versions are hidden from default installs.
- The registry resolves `xsil install <slug>` to the latest non-yanked version.
- `xsil install <slug>@<version>` pins to a specific version.

### Package structure

```
manifest.json        required — identity, execution model, checksums
README.md            required — rendered on the package page
docs/                required — extended documentation
tests/               required — test suite (testEntry or tests/run.sh)
sim/                 required — simulation scripts and assets
toolchain/           required — self-contained compiler/toolchain
bitstream/           optional — FPGA bitstreams (required if targets.fpga is present)
assets/              optional — auxiliary data, waveforms, examples
```

---

## Flows

### Publish Flow

```
Developer
  │
  ├─ writes manifest.json + package files
  │
  ├─ xsil login  (stores API token in ~/.extensilica/config.toml)
  │
  └─ xsil publish ./my-package/
       │
       ├─ 1. Read and validate manifest.json
       ├─ 2. Compute checksums.payload (SHA-256 over non-manifest files)
       ├─ 3. Compute checksums.archive (SHA-256 of .xsil archive)
       ├─ 4. Pack directory into .xsil (gzip-tar)
       ├─ 5. POST /packages  (create slug if new)
       ├─ 6. POST /packages/:slug/versions  (upload .xsil + manifest fields)
       │       └─ Backend: store blob → create Version record → update Package.latestVersion
       └─ 7. Print: https://extensilica.com/package/my-package@1.0.0
```

### Install Flow

```
User
  │
  └─ xsil install rvv-demo
       │
       ├─ 1. GET /packages/rvv-demo  (resolve latest non-yanked version)
       ├─ 2. GET /packages/rvv-demo/versions/<latest>  (fetch version metadata)
       ├─ 3. GET /packages/rvv-demo/versions/<latest>/download
       │       └─ Backend: stream .xsil blob, record DownloadEvent
       ├─ 4. Recompute checksums.payload from archive contents
       ├─ 5. Compare against manifest value — abort if mismatch
       └─ 6. Unpack to ~/.extensilica/extensions/rvv-demo/<version>/
```

### Version Resolution Flow

```
Input: "rvv-demo"           →  GET /packages/rvv-demo
                                → latestVersion field → "1.2.0"

Input: "rvv-demo@1.1.0"    →  GET /packages/rvv-demo/versions/1.1.0
                                → version record → xsilUrl

Input: "./rvv-demo.xsil"   →  read local file directly
                                → extract manifest.json → validate checksums

Input: "./rvv-demo/"        →  read directory manifest.json directly
                                → validate checksums in-place (no download)
```

Yanked versions:
- CLI refuses to install unless `--override-security` is passed.
- Backend still serves the metadata (for audit), but marks `isYanked: true`.

### Analytics Flow

```
Download event
  │
  ├─ User: xsil install rvv-demo
  │
  └─ GET /packages/rvv-demo/versions/1.2.0/download
       │
       ├─ Backend: stream .xsil blob from file store
       └─ Backend: INSERT DownloadEvent { packageId, versionId, ip(hashed), userAgent, country, recordedAt }

Aggregation (scheduled job, e.g. every hour):
  │
  ├─ COUNT DownloadEvent WHERE recordedAt > now-7d GROUP BY packageId → Package.weeklyDownloads
  └─ COUNT DownloadEvent GROUP BY packageId → Package.totalDownloads

Publisher view:
  └─ GET /packages/:slug/analytics  (auth required, owner only)
       └─ Returns: downloads by day, week, month; top versions; country breakdown
```

---

## Non-Goals (v3)

These are explicitly out of scope for this architecture:

- Crypto / Web3 / wallet authentication
- Payments, subscriptions, or monetization of any kind
- Organization-level trust chains or cryptographic publisher certificates
- Global board catalog or platform-defined FPGA target lists
- Binary hosting for non-`.xsil` artifact types
- CI/CD pipeline integrations (out of scope for initial registry)
