# ExtenSilica (platform)

**Private repository** — hosted **registry API**, **Next.js** site, deploy runbooks, and product integrations.

The **`.xsil` format**, reference **`xsil` CLI**, and **normative spec** live in the **public** repository **[github.com/extensilica/xsil](https://github.com/extensilica/xsil)**. Installers on extensilica.com download release binaries from that repo.

Think of the product as [npmjs.com](https://npmjs.com)–style **discovery and hosting** for RISC-V packages, while the open **format + CLI** ship from **`extensilica/xsil`**.

---

## Deploy on a new machine (everything you need is in this repo)

You do **not** need to guess what to copy. After `git clone`:

1. **Secrets only:** copy `store-backend/.env.example` → `store-backend/.env` and fill real values (PostgreSQL, SMTP, optional S3/R2). **Never commit `.env`** — it stays local to each server.
2. **Follow the runbook:** open **[docs/deploy-runbook.md](docs/deploy-runbook.md)** and run the commands in order (Ubuntu VPS path: Node, Postgres, Caddy, PM2, backend + frontend).
3. **Optional first package:** use **[scripts/publish-rvx-demo.sh](scripts/publish-rvx-demo.sh)** once the API is live and you are logged in with the **`xsil`** CLI (install from **[extensilica/xsil releases](https://github.com/extensilica/xsil/releases)** or build the public clone).

**Included in git for deploy / ops**

| Path | Role |
|------|------|
| `store-backend/` | Registry API (Express + Prisma + migrations in `prisma/migrations/`) |
| `store-frontend/` | Next.js site; `public/install.sh` + `install.ps1` (pull `xsil` from **public** GitHub Releases) |
| `docs/deploy-runbook.md` | Step-by-step production commands |
| `docs/REPOS_AND_PUBLIC_XSIL.md` | **Private vs public `xsil` repo** — read this first |
| `store-backend/.env.example` | Template for server `.env` |
| `scripts/` | e.g. first demo publish (`publish-rvx-demo.sh` uses `test/fixtures/rvx-demo`) |
| `brand/` | Logo assets |
| `.github/workflows/` | CI for backend + frontend only |
| **Public** [extensilica/xsil](https://github.com/extensilica/xsil) | `xsil` CLI, `spec/xsil.md`, `examples/rvx-demo`, CLI release tags `cli/v*.*.*` |

**Excluded from git on purpose** (not required to deploy; recreated on the server)

- `node_modules/`, `dist/`, `.next/` — install/build on the machine  
- `store-backend/uploads/` — runtime blob storage (or use S3/R2)  
- `store-backend/.env` — secrets  
- `gem5/` — huge local simulator checkout  
- `registry/` — legacy local Verdaccio data, **not** the Node registry in `store-backend/`  
- Root / CLI scratch `fastaes-*.xsil` and test dirs — local QA artifacts  

---

## Why ExtenSilica exists

RISC-V extensions are hard to share. A working implementation on one machine is typically a collection of loose scripts, binaries, and bitstreams with no standard layout, no versioning, and no way for someone else to reproduce the same result.

ExtenSilica solves this with three things:

1. **A package format** (`.xsil`) that captures everything an extension needs: executable entry point, toolchain, tests, documentation, and a hash that proves the content hasn't changed.
2. **A public registry** where packages are published, versioned, and discoverable by name.
3. **A CLI** (`xsil`) that installs, runs, and tests packages — from the registry or from a local path — with automatic integrity verification.

The result: `xsil run risc-v/my-extension` produces the same verified output on any machine that has the CLI.

---

## What is `.xsil`

`.xsil` is a **gzip-compressed tar archive** with a mandatory `manifest.json` at the root. It is the portable, self-describing unit of a RISC-V extension.

A `manifest.json` describes:

```json
{
  "name": "my-extension",
  "version": "1.2.0",
  "description": "RISC-V vector extension with Spike simulation",
  "author": "alice",
  "isa": "RV64GCV",
  "entry": "sim/run.sh",
  "toolchain": "riscv64-unknown-elf-gcc",
  "payloadHash": "sha256:<hash-of-all-non-manifest-files>",
  "payloadSize": 48320
}
```

The `payloadHash` is a SHA-256 over all non-manifest files in the archive. The CLI recomputes it on every install and run — if the bytes don't match, execution is refused.

The normative definition is **[spec/xsil.md](https://github.com/extensilica/xsil/blob/main/spec/xsil.md)** (in the public `xsil` repository).

---

## The Website

[extensilica.com](https://extensilica.com) is the public registry website. Package pages resemble npmjs.com:

- Package name, description, and latest version
- Readme (rendered Markdown)
- Full version history with changelogs and download counts
- Metadata sidebar: author, ISA, tags, published date, total and weekly downloads
- Install command: `xsil install <name>`

Publishers can register an account, claim a package name, and upload new versions through the website or directly from the CLI.

---

## The CLI

Install **`xsil`** from the **[public repository](https://github.com/extensilica/xsil)** (release binaries, `install.sh`, or build from source).

### Install

```bash
# e.g. from a clone of github.com/extensilica/xsil
cargo install --path cli
```

### Commands

```bash
xsil init <slug>           # create a new local package directory (manifest + sim/tests/docs stubs)
xsil install <package>      # download and install under ~/.extensilica/extensions/
xsil run <package>          # fetch, verify, and execute the package entry point
xsil test <package>         # fetch, verify, and run the test suite
xsil info <package>         # show registry metadata and local install status
xsil search <term>          # search the registry by name, description, or tag
xsil login                  # authenticate with the registry (stores an API token)
xsil publish <path>         # build and publish a .xsil package (requires login)
```

`<package>` accepts:

| Format | Example |
|--------|---------|
| Registry slug | `risc-v/rvv-demo` |
| Slug at version | `risc-v/rvv-demo@1.2.0` |
| Local `.xsil` file | `./my-extension.xsil` |
| Unpacked directory | `./my-extension/` |

---

## Quickstart

### As a user

```bash
# Install a package from the registry
xsil install rvv-demo

# Or run it directly without installing
xsil run rvv-demo
```

### As a publisher

```bash
# 1. Register at extensilica.com or log in from the CLI
xsil login

# 2. Lay out your package (manifest.json + sim/, tests/, etc.)
#    See https://github.com/extensilica/xsil/blob/main/spec/xsil.md for the required layout

# 3. Publish
xsil publish ./my-extension/
```

After publishing, the package is immediately available at `extensilica.com/package/my-extension` and installable by anyone with `xsil install my-extension`.

---

## How publishing works

1. **Write a manifest** — `manifest.json` at the root of your package directory. Required fields: `name`, `version`, `description`, `author`, `isa`, `entry`.
2. **Run `xsil publish`** — the CLI packs the directory into a `.xsil` archive, computes `payloadHash`, authenticates with your stored API token, uploads the archive, and registers the version metadata with the registry.
3. **Versioning** — versions follow [Semantic Versioning](https://semver.org). Each published version is immutable. Publish a new version with an incremented `version` field in the manifest.

---

## How installation works

```bash
xsil install rvv-demo
```

1. CLI fetches version metadata from the registry API (`GET /packages/rvv-demo`).
2. Downloads the `.xsil` tarball from the blob store.
3. Recomputes `payloadHash` over the archive contents and compares it to the manifest value. If they differ, installation is aborted.
4. Unpacks the archive under `~/.extensilica/extensions/rvv-demo/`.

`xsil run` performs steps 1–3 then executes the `entry` script directly, without a permanent install.

---

## How versioning works

Packages use [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.

- `xsil install rvv-demo` → installs the latest published version.
- `xsil install rvv-demo@1.2.0` → pins to an exact version.
- Every published version is permanently stored and addressable.
- Maintainers can yank a version (mark as revoked); the CLI will refuse to install yanked versions.

---

## Repository

| Location | Role |
|----------|------|
| **[extensilica/xsil](https://github.com/extensilica/xsil)** (public) | Normative **`spec/xsil.md`**, **`xsil`** CLI, **`examples/rvx-demo`**, CLI releases |
| `store-backend/` (this repo) | Registry API — Express + Prisma, package metadata and upload |
| `store-frontend/` (this repo) | Registry website — Next.js, package pages and search |
| `docs/` (this repo) | Deploy, architecture, OAuth, **REPOS_AND_PUBLIC_XSIL.md** |

---

## Documentation

- [spec/xsil.md](https://github.com/extensilica/xsil/blob/main/spec/xsil.md) — package format (public repo)
- [docs/REPOS_AND_PUBLIC_XSIL.md](docs/REPOS_AND_PUBLIC_XSIL.md) — private vs public split
- [docs/publishing.md](docs/publishing.md) — full publishing workflow
- [docs/reproducibility.md](docs/reproducibility.md) — why reproducibility matters
- [docs/architecture-v2.md](docs/architecture-v2.md) — system architecture
- [docs/pivot-v3-baseline.md](docs/pivot-v3-baseline.md) — pivot v3 scope and plan
