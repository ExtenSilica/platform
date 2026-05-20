# ExtenSilica — platform features (web + CLI)

**Status:** Canonical product reference  
**Last updated:** May 2026  
**Audience:** Developers, operators, and contributors who need one place to see what the system does today.

ExtenSilica is a **public registry and website** for reproducible **RISC-V extension packages** (`.xsil`), plus the open-source **`xsil` CLI** that publishes, installs, and runs them. There are **no payments, wallets, or commercial license tokens** on the platform.

---

## Repository split

| Repository | Role |
|------------|------|
| **This repo** (private) | Registry API (`store-backend`), website (`store-frontend`), deploy docs, OAuth integration |
| **[ExtenSilica/xsil](https://github.com/ExtenSilica/xsil)** (public) | `xsil` CLI (Rust), normative [spec/xsil.md](https://github.com/ExtenSilica/xsil/blob/main/spec/xsil.md), reference example `rvx-demo` |

Install scripts on **extensilica.com** download CLI binaries from **public GitHub Releases** (`cli/v*.*.*`). See [REPOS_AND_PUBLIC_XSIL.md](./REPOS_AND_PUBLIC_XSIL.md).

---

## The `.xsil` package (unit of distribution)

A `.xsil` file is a **gzip-compressed tar** with `manifest.json` at the root and a standard layout:

| Path | Required | Purpose |
|------|----------|---------|
| `manifest.json` | Yes | Name, version, author, `entry`, checksums, targets, readiness metadata |
| `README.md` | Yes | Shown on the package page |
| `docs/` | Yes | Extended documentation |
| `tests/` | Yes | Test vectors / `tests/run.sh` |
| `sim/` | Yes | Simulation entry (Spike, QEMU, etc.) |
| `toolchain/` | Yes | Declared compiler/tooling (or README stub) |
| `bitstream/` | Optional | FPGA assets when `targets.fpga` is set |

**Readiness level (RL 1–5)** on each package describes how far authors have taken pre-silicon evaluation (spec-only → runnable sim). Details: [pre-silicon-bridge-readiness.md](./pre-silicon-bridge-readiness.md).

**Integrity:** Published versions are **immutable**. The CLI verifies payload SHA-256 before install/run. **Yanked** versions remain downloadable but are hidden from default resolution.

Normative format rules: public [spec/xsil.md](https://github.com/ExtenSilica/xsil/blob/main/spec/xsil.md).

---

## `xsil` CLI (public repo)

Install:

```bash
cargo install xsil
# or: curl -fsSL https://extensilica.com/install.sh | sh
```

Config: `~/.extensilica/config.json` (`registry`, `token` from `xsil login`).

### Commands

| Command | Auth | Summary |
|---------|------|---------|
| `xsil login` | — | Email/password → API token stored locally |
| `xsil logout` | Yes | Revoke token server-side |
| `xsil whoami` | Yes | Print current user profile |
| `xsil init <slug>` | — | Scaffold package directory (`manifest.json`, `sim/`, `tests/`, etc.) |
| `xsil publish <path>` | Yes | Pack directory or upload `.xsil`; `POST /packages/.../versions` |
| `xsil yank <pkg>@<ver>` | Yes | Mark version yanked (CLI + `PATCH` API) |
| `xsil install <pkg>` | — | Download, verify hash, unpack under `~/.extensilica/extensions/` |
| `xsil run <pkg>` | — | Install if needed, verify, run `manifest.entry` via shell |
| `xsil test <pkg>` | — | Run `testEntry` or `tests/run.sh` |
| `xsil info <pkg>` | — | Registry metadata + local install status |
| `xsil search <query>` | — | Search registry from terminal |

**Package argument forms:** registry slug (`rvx-demo`), pinned version (`rvx-demo@1.0.0`), local `.xsil` file, or unpacked directory.

**Global flag:** `--dry-run` on all commands — validate/pack without upload or disk writes where applicable.

**CLI auth note:** OAuth (GitHub/Google) is for the **website** only. The CLI uses **email/password API tokens** ([cli-auth-v2.md](./cli-auth-v2.md)).

**Reference demo package:** `rvx-demo` (publish via `scripts/publish-rvx-demo.sh` in this repo). Smoke targets: [hero-packages.md](./hero-packages.md).

Deeper CLI behaviour: [github.com/ExtenSilica/xsil — docs/cli-v3.md](https://github.com/ExtenSilica/xsil/blob/main/docs/cli-v3.md). Human publisher guide: [developer-publishing.md](./developer-publishing.md).

---

## Website (`extensilica.com`)

Stack: **Next.js 14** (`store-frontend`), talks to registry API (`store-backend`).

### Public discovery

| Route | Features |
|-------|----------|
| `/` | Hero search, catalog stats by `standardStatus`, animated CLI quickstart, “how it works”, diverse “latest extensions” |
| `/search` | Server-rendered search; filters (keywords, ISA, standard status, readiness) |
| `/package/[slug]` | README render, versions, install command, download stats chart, reviews, readiness badge, external citations, claim ownership, open implementation requests |
| `/users/[username]` | Public profile, published packages, contributions |
| `/orgs/[slug]` | Organization profile, members, scoped packages |
| `/adoption` | Aggregated adoption metrics (honest early-stage framing) |
| `/requests`, `/requests/[id]` | Browse and view **implementation requests** (coordination only; no payments) |
| `/governance`, `/contributing`, `/faq` | Stewardship path, contribution guide, FAQ |
| `/legal/terms`, `/legal/privacy`, `/legal/dmca` | Terms, privacy, DMCA submission |

SEO: `robots.ts`, `sitemap.ts`, SSR on `/search`.

### Account & auth

| Route | Features |
|-------|----------|
| `/register`, `/login` | Email/password; links to GitHub/Google OAuth |
| `/auth/callback` | OAuth code exchange → token in browser storage |
| `/auth/verify-email`, `/auth/error` | Email verification and OAuth errors |
| `/forgot-password`, `/reset-password` | Password reset flow |

### Publisher & maintainer

| Route | Features |
|-------|----------|
| `/publish/new` | Create package record |
| `/publish/[slug]/version` | Upload new `.xsil` version (multipart) |
| `/publish/[slug]/settings` | Metadata, deprecation, yank versions |
| `/publish/[slug]/maintainers` | Add/remove maintainers |
| `/wizard` | Web UI to generate `.xsil` skeleton (`POST /wizard/generate`) |
| `/dashboard` | Your packages, profile fields (implementer bio/GitHub), org memberships |
| `/dashboard/tokens` | Create/revoke API tokens (for CLI) |
| `/dashboard/admin` | Platform admin: users, packages, ownership queue, implementation requests, external citations |

Publishing on the registry does **not** require a CLA on the platform repo. CLA applies only to **PRs** against this private codebase ([CLA.md](./CLA.md)).

---

## Registry API (summary)

Base URL: `https://api.extensilica.com` (also mounted under `/api/...`). OpenAPI: `/api-docs`.

### Health & artifacts

- `GET /health` — liveness
- `GET /uploads/:key` — download `.xsil` (counts toward analytics)
- `POST /artifacts/tools/upload`, `POST /artifacts/resolve`, `GET /artifacts/tools/:sha256` — tool artifact registry for manifests

### Authentication

- `POST /auth/register`, `/login`, `/logout`, `/verify-email`, `/resend-verification`
- `POST /auth/forgot-password`, `/reset-password`
- `GET /auth/github/start|callback`, `/google/start|callback`, `POST /auth/oauth/exchange`
- `GET|PATCH /auth/me`, `PATCH /auth/me/password`, `POST /auth/me/avatar`, `DELETE /auth/me`
- `GET|POST /auth/me/tokens`, `DELETE /auth/me/tokens/:id`

### Packages (scoped `@org/name` and unscoped `name`)

- `GET /packages` — search/list
- `GET|POST /packages/:name` — detail, create
- `GET|POST /packages/:name/versions`, `GET /packages/:name/:version` (`latest` supported)
- `PATCH /packages/:name`, `PATCH /packages/:name/versions/:version` — metadata, **yank**
- Maintainers: list/add/remove
- Reviews: list/create (authenticated)
- `GET|POST /packages/:name/implementation-requests`
- Citations: `GET /packages/:name/citation(s)`
- Ownership: `GET .../eligibility`, `POST .../ownership-requests`

### Organizations & users

- Orgs: CRUD, members, roles
- `GET /users/:username`, `GET /users/:username/contributions`

### Stats

- `GET /stats/catalog` — counts by standard status
- `GET /stats/packages/:name` — downloads / views
- `GET /stats/adoption` — adoption dashboard data
- `POST /stats/refresh` — admin weekly refresh trigger

### Implementation coordination (no payments)

- `GET /implementation-requests`, `GET /implementation-requests/:id`, `PATCH` (author/admin)
- Interests, milestones, submissions on a request
- `PATCH /submissions/:id`, `POST /submissions/:id/verification-runs`
- `GET /me/implementation-requests`, `/me/implementation-submissions`, ownership request lists

### Admin & legal

- `/admin/*` — users, packages, approve/reject ownership, cancel requests, external citations
- `POST /legal/dmca`
- `POST /wizard/generate`

Full route reference: [api-v3.md](./api-v3.md). Data model: [data-model-v3.md](./data-model-v3.md).

---

## Cross-cutting product behaviour

| Topic | Behaviour |
|-------|-----------|
| **Versioning** | Semver required; published blobs immutable; `latest` = greatest non-yanked ([versioning-v3.md](./versioning-v3.md)) |
| **Analytics** | Download events via `/uploads/:key` proxy ([analytics-v3.md](./analytics-v3.md)) |
| **Reviews** | Per-package star + text ([reviews-v3.md](./reviews-v3.md)) |
| **Naming** | Squatting/reservation policy ([name-policy-v3.md](./name-policy-v3.md)) |
| **Security** | Payload hashing; optional signatures not required for open registry ([security-model.md](./security-model.md)) |
| **FPGA / bitstreams** | Authors may ship bitstreams; platform does not synthesize ([bitstream-distribution.md](./bitstream-distribution.md)) |
| **Zenodo DOI** | Manual workflow today ([zenodo-doi.md](./zenodo-doi.md)); automation planned ([zenodo-automation.md](./zenodo-automation.md)) |
| **Catalog seed** | 102 extension rows tracked in [catalog-seed/catalog.md](./catalog-seed/catalog.md); agent playbooks for RL≥1/2 publishing |

---

## What is explicitly out of scope

- Payments, escrow, USDC, wallets, or marketplace checkout
- Commercial runtime license enforcement on the registry
- Blockchain or Web3 integration
- In-browser execution of packages (CLI/local only)
- Platform-run FPGA synthesis or bitstream generation
- LinkedIn/social posting (operational, not product)

Roadmap context (implementation requests, governance, adoption): [implementation-plan-rvi-2026.md](./implementation-plan-rvi-2026.md).

---

## Operations & deep dives

| Doc | Use when |
|-----|----------|
| [extensilica-architecture-v3.md](./extensilica-architecture-v3.md) | End-to-end architecture (flows, diagrams) |
| [deploy-runbook.md](./deploy-runbook.md) | Production deploy |
| [launch-checklist-v3.md](./launch-checklist-v3.md) | Launch readiness tracker |
| [hero-packages.md](./hero-packages.md) | Demo slugs + `smoke-heroes.sh` before marketing posts |
| [auth-v3.md](./auth-v3.md), [oauth-v1.md](./oauth-v1.md) | Auth design |
| [publishing-flow-v3.md](./publishing-flow-v3.md) | HTTP publish sequence |
| [agent-publish-extension.md](./agent-publish-extension.md) | Agent playbook for RL≥2 packages |
| [cleanup-v3.md](./cleanup-v3.md) | v3 pivot removal audit |

---

## Quick start (verified demo path)

```bash
cargo install xsil
export XSIL_REGISTRY=https://api.extensilica.com

xsil install rvx-demo
xsil run rvx-demo
```

Browse: [https://extensilica.com](https://extensilica.com) · API: [https://api.extensilica.com](https://api.extensilica.com)
