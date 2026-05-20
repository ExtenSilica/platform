# Pivot v3 — Baseline: npmjs-like XSIL Registry

**Branch:** `pivot/npmjs-like-xsil-registry`  
**Date:** March 2026  
**Purpose:** Capture the current state of the repository before the third major pivot, define what must change, and lock the target product shape.

---

## Current Repository Structure

```
ExtenSilica/
├── brand/                  extensilica.svg logo
├── cli/                    Rust xsil CLI (src/{main,manager,registry,types,constants}.rs)
├── docs/                   All architecture and publishing docs
├── examples/
│   └── rvx-demo/           Minimal runnable Spike demo
├── registry/               Verdaccio-based blob store (docker-compose, config.yaml, htpasswd, storage/)
├── spec/
│   └── xsil.md             Normative .xsil format spec (v1.0 draft)
├── store-backend/          Express + Prisma API (TypeScript)
│   ├── prisma/             schema.prisma (Extension + Version, SQLite)
│   └── src/
│       ├── controllers/    packagesController.ts, trustController.ts
│       ├── routes/         packages.ts, trust.ts
│       ├── server.ts       Express entrypoint
│       └── swagger.ts
└── store-frontend/         Next.js 14 App Router (TypeScript)
    ├── app/
    │   ├── page.tsx        Home: search + package grid
    │   └── package/[slug]/ Package detail page
    ├── components/         Navbar, Footer, PackageCard, HomeIndex, shadcn UI
    └── lib/
        ├── api.ts          fetchPackages, fetchPackage
        └── types.ts        XsilPackage, XsilVersion, DeclaredManifestTarget
```

---

## Current Responsibilities

### `.xsil` format / `spec/xsil.md`

- Defines `.xsil` as a **gzip-compressed tar** with `manifest.json` at root.
- Required manifest fields: `name`, `version`, `isa`, `entry`, `targets`, `toolchain`, `description`, `payloadHash`.
- Layout directories: `sim/`, `toolchain/`, `tests/`, `docs/`, optional `bitstream/`.
- Targets: `spike`, `qemu`, `fpga` — no platform board catalog.
- Integrity via `payloadHash` (SHA-256 over non-manifest files).

### CLI (`cli/`)

Current commands:

| Command | Role |
|---------|------|
| `xsil run` | Resolve → verify → execute `entry` |
| `xsil test` | Resolve → verify → run `testEntry` or `tests/run.sh` |
| `xsil install` | Download + install under `~/.extensilica/extensions/` |
| `xsil info` | Show registry metadata + local install info |

Supports: registry slug, `slug@version`, `.xsil` file, or **unpacked directory** with `manifest.json`.  
Validates `payloadHash` for all inputs. Optional Ed25519 signature verification.  
Missing: `xsil publish`, `xsil build`, `xsil login`, `xsil search`.

### Registry (`registry/`)

- **Verdaccio** (npm-compatible) blob store.
- Stores `.xsil` tarballs scoped as `@extensilica/<name>`.
- Has its own `htpasswd`, `docker-compose.yml`, and `config.yaml`.
- Not yet integrated with the frontend package pages.
- Separate from the metadata API in `store-backend`.

### Backend (`store-backend/`)

- **Express** + **Prisma** (SQLite) metadata-only API.
- Exposes: `GET /packages`, `GET /packages/:name`, `GET /packages/:name/:version`.
- Legacy aliases: `/search`, `/extensions`, `/api/extensions/:name`.
- Trust endpoints: `/trust/organization`, `/trust/revocations` (static/empty).
- No auth, no write endpoints, no publish flow.
- DB models: `Extension` (metadata) + `Version` (xsilUrl, hashes, isa, boards).
- Downloads tracked (`downloads` counter on `Extension`) but not incremented automatically.

### Frontend (`store-frontend/`)

- **Next.js 14** App Router, Tailwind + shadcn-style UI.
- Renders: search index (`/`), package detail (`/package/[slug]`).
- Fetches from backend API (`/packages`).
- Shows: name, description, ISA, declared targets, `xsil run <slug>`.
- No user accounts, no publish UI, no version history tabs, no download stats.
- Minimal: no dark/light toggle, no auth, no complex flows.

---

## What Must Change for the npmjs-like Pivot

### Must add

| Area | Change |
|------|--------|
| **Auth** | User registration and login (email + password or token-based). No wallet/Web3. |
| **User accounts** | Publisher identity: display name, email, list of own packages. |
| **Publish flow** | `POST /packages` to create a package; `POST /packages/:name/versions` to upload a new `.xsil` version via multipart. |
| **CLI `xsil publish`** | Pack directory or upload `.xsil` file to the registry, authenticated by API token. |
| **CLI `xsil login`** | Store API token from a registry login response. |
| **Download counter** | Increment on `GET /packages/:name/:version/download` or tarball fetch. |
| **Download stats** | API endpoint + frontend display: total downloads per package, per version. |
| **Version history** | Package page shows all published versions with changelog, date, download link. |
| **Package page** | Resembles npmjs.com: full description (Markdown render), readme, version list, install command, metadata sidebar (author, ISA, tags, latest version, published date, weekly/total downloads). |
| **Search** | Full-text search by name/description/tags; results page. |
| **Publisher page** | `/~<username>` or `/user/<username>` listing their packages. |
| **`xsil search`** | CLI search against registry API. |
| **Tags / categories** | Tag-based filtering on frontend. |

### Must change

| Area | Change |
|------|--------|
| **DB schema** | Add `User` model (email, hashed password, API token). Add `ownerId` FK on `Extension`. Add `size` (bytes) on `Version`. Consider PostgreSQL for production. |
| **Backend** | Add auth middleware; protect write endpoints. Wire `xsilUrl` to actual blob storage (Verdaccio or object store), not a placeholder URL. |
| **Registry integration** | Unify or bridge Verdaccio blob store with the metadata API, or replace Verdaccio with a simpler upload-to-S3/FS + serve approach. |
| **Frontend** | Package detail page expanded (readme, version list, stats sidebar). Add search results page. Add user profile page. |
| **Spec** | Clarify that `name` is the npm-style registry slug. Document that `xsil publish` authenticates and that the registry is the canonical source. |

### Must remove / clean up

| Item | Reason |
|------|--------|
| Trust endpoints (`/trust/*`) | Not needed for a simple public registry; only relevant for the old signature-chain model. Defer or stub. |
| Static `payloadHash` enforcement on upload | Cannot validate at API boundary without unpacking; enforce in CLI pre-publish, not server. |
| `boards` / FPGA-specific metadata fields | Not core to the npmjs-like index; keep as optional JSON blob in `Version`, do not surface in UI. |
| Old pivot docs (pivot-v1, license-wrapper, etc.) | Move to `docs/history/` to avoid confusion. |
| `screenshots`, `rating`, `downloads` (free-float fields) | Replace with accurate download stats tracked per download event; remove unused `rating`. |
| Verdaccio auth/`htpasswd` as primary identity | Replace with the metadata API's own user/token system; Verdaccio becomes dumb blob storage (or is replaced). |

---

## What Should Be Preserved

- `.xsil` format and `spec/xsil.md` — unchanged; the package format is the core.
- CLI commands `run`, `test`, `install`, `info` — working, keep as-is.
- `payloadHash` integrity check in the CLI at install/run time.
- `examples/rvx-demo` — minimal demo, useful for testing the full loop.
- Prisma + Express for backend (extend, not rewrite).
- Next.js + Tailwind for frontend (extend, not rewrite).

---

## Target Product Shape

**ExtenSilica** is a **public registry and website for `.xsil` packages**, analogous to [npmjs.com](https://npmjs.com) for the XSIL ecosystem.

### Website (`/`)

The homepage lists recently published and popular packages. A search bar finds packages by name, description, or tag.

**Package page** (`/package/<slug>`) shows:

- **Name**, latest version badge, short description
- **Install command** prominently: `xsil install <slug>` (copyable)
- **Published date**, last updated, total downloads, weekly downloads
- **Readme / description** (Markdown rendered)
- **Versions** — table of all published versions: version string, date, downloads, changelog snippet, direct `.xsil` download link
- **Metadata sidebar**: author/publisher (linked to profile), ISA, tags, size
- **Side note**: `xsil run <slug>` for direct execution without install

**Publisher profile page** (`/~<username>`) shows all packages owned by that user.

**Search results page** (`/search?q=<term>`) shows filtered package cards.

### CLI

```
xsil install <pkg>          install from registry
xsil run <pkg>              fetch, verify, execute entry
xsil test <pkg>             fetch, verify, run tests
xsil info <pkg>             show metadata
xsil search <term>          search the registry
xsil login                  authenticate with registry (stores API token)
xsil publish <path>         build + publish .xsil to registry (requires login)
```

### Registry / Backend

- Authenticated `POST /packages` — create a new package name (claim ownership).
- Authenticated `POST /packages/:name/versions` — upload `.xsil` tarball + metadata; backend stores blob and creates `Version` record.
- `GET /packages/:name/versions/:version/download` — stream tarball; increments download counter.
- `GET /packages/search?q=` — full-text search.
- `GET /users/:username` — public profile with owned packages.
- `POST /auth/register` + `POST /auth/login` — user auth; return API token.

### Data model additions

```
User
  id, email, username, passwordHash, apiToken, createdAt

Extension
  + ownerId FK User
  - rating (remove)
  - screenshots (remove or keep as optional JSON)

Version
  + size (bytes)
  + downloadCount
  + readmeUrl or readmeContent (Markdown)
```

### Non-goals for v3

- No crypto / Web3 / wallet authentication.
- No monetization, no payments, no licensing.
- No "organization" trust chains or certificate verification.
- No FPGA-specific UI (boards/bitstream flows remain optional fields, invisible in normal UI).
- No paid tiers.

---

## Summary of Pivot History

| Pivot | Model | Removed |
|-------|-------|---------|
| **v1 (original)** | Browser extension marketplace, Stripe payments, Web3/USDC, GitHub-style developer profiles | — |
| **v2 (RISC-V bitstream)** | FPGA bitstream + toolchain distribution, XSIL format, CLI execution, no payments | Marketplace, browser extensions, payments |
| **v3 (this pivot)** | Public package registry + website (npmjs-like), users, publish, stats | FPGA-specific UI, trust chains, Web3, licensing |

The **XSIL format** and **CLI execution model** (`xsil run`, `xsil test`) survive all three pivots unchanged.
