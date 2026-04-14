# ExtenSilica Pivot Baseline

**Branch:** `pivot/riscv-bitstream-platform`  
**Purpose:** Snapshot of repository state and terminology before pivoting to a RISC-V bitstream platform.  
**Date:** March 2025

> **Note:** The platform was redefined after this baseline. ExtenSilica is now a **distribution platform for RISC-V softcore processors with custom ISA extensions delivered as FPGA bitstreams and toolchains**. See [docs/README.md](./README.md) for the current definition.

---

## 1. Complete Repository Tree

Tree below excludes: `.git/`, `node_modules/`, `cli/target/`, `*/venv/`, `.next/`, `__pycache__/`, and build artifacts. The `gem5/` directory is a large external simulator reference; only top-level structure is shown.

```
ExtenSilica/
├── README.md
├── brand/
│   ├── extensilica.png
│   └── extensilica.svg
├── cli/
│   ├── Cargo.lock
│   ├── Cargo.toml
│   ├── check_signed/
│   │   ├── bin/
│   │   │   └── plugin.so
│   │   └── manifest.json
│   ├── fastaes-1.0.2.xsil … fastaes-1.0.8.xsil
│   ├── sign_as_org.js
│   ├── src/
│   │   ├── constants.rs
│   │   ├── main.rs
│   │   ├── manager.rs
│   │   ├── registry.rs
│   │   └── types.rs
│   ├── tampered_manifest_pkg/
│   ├── tampered_pkg/
│   ├── temp_pkg/
│   │   ├── bin/
│   │   ├── manifest.json
│   │   └── rtl/
│   └── test.tgz
├── docs/
│   ├── Architectural Fidelity Risk in RISC-V Emulation.md
│   └── pivot-baseline.md
├── fastaes-*.xsil                    # Root-level test/fixture .xsil packages
├── gem5/                              # External gem5 simulator (full tree omitted)
│   ├── build/ build_opts/ configs/ ext/ include/ src/ system/ tests/ util/ workloads/
│   ├── README, SConstruct, pyproject.toml, requirements.txt, etc.
│   └── …
├── pkg_temp/
│   ├── bin/
│   ├── manifest.json
│   └── …
├── registry/
│   ├── config.yaml
│   ├── docker-compose.yml
│   ├── htpasswd
│   ├── plugins/
│   ├── storage/
│   │   ├── .verdaccio-db.json
│   │   ├── @extensilica/
│   │   └── test-pkg/
│   └── test-pkg/
├── spec/
│   └── xsil.md
├── store-backend/
│   ├── .env .gitignore Dockerfile tsconfig.json package.json package-lock.json
│   ├── certs/ (org_private.pem, org_public.pem)
│   ├── cli/ dummy_pkg/ pkg_temp/ temp_pkg/ temp_pkg_multi/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── dev.db
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/ controllers/ middleware/ routes/ services/
│   │   ├── server.ts
│   │   └── swagger.ts
│   ├── *.js (e2e_setup, publish_signed, revoke_cert, test_*, update_*_hash, etc.)
│   └── uploads/
├── store-frontend/
│   ├── app/
│   │   ├── api/ category/ dashboard/ extension/ purchase-success/
│   │   ├── layout.tsx page.tsx globals.css favicon.ico
│   │   └── …
│   ├── components/
│   │   ├── dashboard/ ui/
│   │   ├── category-sidebar.tsx extension-card.tsx footer.tsx navbar.tsx
│   │   ├── install-modal.tsx providers.tsx trust-badge.tsx
│   │   └── …
│   ├── lib/ (api.ts, types.ts, utils.ts, hooks/, web3/)
│   ├── public/
│   ├── package.json next.config.mjs tailwind.config.ts tsconfig.json
│   └── README.md
├── test-pkg/
└── t1.log
```

---

## 2. Description of Each Directory

| Directory | Description |
|-----------|-------------|
| **`/` (root)** | Monorepo root. Contains main README, brand assets reference, and fixture `.xsil` packages used for tests. |
| **`brand/`** | ExtenSilica logo and branding assets (PNG, SVG). |
| **`cli/`** | Rust CLI (clap). Pack, sign, install, remove, list, and manage XSil packages; talk to store-backend and registry. Contains test packages (check_signed, tampered_*, temp_pkg) and sample .xsil files. |
| **`docs/`** | Architecture and design docs. Includes RISC-V emulation fidelity whitepaper and this pivot baseline. |
| **`gem5/`** | External gem5 simulator repository (submodule or vendored reference). Used for simulation/validation context; not part of ExtenSilica application code. |
| **`pkg_temp/`** | Temporary or fixture package directory at repo root. |
| **`registry/`** | Verdaccio-based private npm registry. Stores .xsil tarballs, htpasswd auth, Docker setup, and persistent storage (e.g. `@extensilica` scoped packages). |
| **`spec/`** | XSil package format specification (xsil.md). Authoritative definition of .xsil layout, manifest schema, integrity, and signatures. |
| **`store-backend/`** | Node.js (Express) API. Handles extensions metadata, developers, auth, payments, licenses, trust/verification, and Verdaccio integration. Prisma + SQLite. |
| **`store-frontend/`** | Next.js 14 App Router UI. Store pages (browse, extension detail, dashboard, categories), install flow, Web3/wallet integration. |
| **`test-pkg/`** | Test or sample package data (e.g. downloaded-fastaes.xsil). |

---

## 3. Responsibilities of Main Components

### 3.1 CLI (`cli/`)

- **Install**: Download .xsil from backend/registry, verify SHA-512 (transport) and payloadHash (content), verify developer (and optional org) signature, check simulator/toolchain requirements, install to `~/.extensilica/extensions/<name>/<version>/`, run `installSteps`.
- **Update / Remove / List / Info**: Manage installed extensions and show metadata.
- **Sign / Pack**: Build .xsil from a directory (manifest + bin/rtl/tests/screenshots), compute payloadHash, sign with developer key, optionally add org signature; output .xsil file.
- **Keygen**: Generate Ed25519 developer keypair; display public key for registry.
- **Login / LicenseCheck**: Authenticate with store (e.g. API token), check license for paid extensions.
- **UpdateTrustRoots**: Update organization trust root key.
- **Sim**: Placeholder for simulator-environment check (e.g. `sim --check`).
- **Version**: Print CLI version.
- **Dry-run**: Global flag to validate install without writing to disk.

### 3.2 store-backend (`store-backend/`)

- **Extensions API**: CRUD for extension metadata (slug, name, description, author, category, tags, pricing, etc.) and versions (version, xsilUrl, changelog, packageHash, isRevoked).
- **Developer API**: Developer profiles, public keys, verification level, certificates, revocation.
- **Auth**: Wallet/Web3 and API token auth; session/nonce handling.
- **Payments**: Stripe integration (products, prices, purchases).
- **Licenses**: Issue and validate licenses for paid extensions (anti-piracy).
- **Trust / Verification**: Verification requests, trust badges, certificate issuance/revocation.
- **Verdaccio integration**: Publish .xsil to registry, store tarball URL and integrity hashes; proxy or redirect for download.
- **Storage**: Local uploads (e.g. secure, verification); Prisma SQLite DB for users, developers, extensions, versions, reviews, purchases, licenses.

### 3.3 store-frontend (`store-frontend/`)

- **Store UI**: Home, browse, search, category pages; extension detail (description, screenshots, install instructions, trust badge, reviews).
- **Dashboard**: Developer dashboard (my extensions, create extension, upload version).
- **Install flow**: Install modal with CLI command or one-click flow.
- **Auth**: Web3 wallet (Wagmi/Web3Modal) and API token for developers.
- **Purchase / License**: Purchase success page; integration with backend payments/licenses.
- **Metadata**: Layout and footer describe the platform (RISC-V bitstream distribution).

### 3.4 registry (`registry/`)

- **Verdaccio**: Private npm-compatible registry; stores package tarballs (e.g. .xsil as package artifacts).
- **Auth**: htpasswd; publish/unpublish require authentication.
- **Storage**: Persistent volume for packages; scoped packages under `@extensilica`.
- **Config**: max_body_size 100mb for .xsil; CORS; optional npm uplink; audit middleware.
- **Role**: Source of truth for .xsil blob storage; backend stores metadata and points versions to registry URLs (xsilUrl) and integrity hashes.

### 3.5 spec (`spec/`)

- **xsil.md**: Single source of truth for the XSil package format.
- Defines: .xsil as gzip tar; directory layout (manifest.json, bitstreams/, toolchain/, software/, docs/, tests/); manifest schema (isa, boards, payloadHash, developerSignature); dual-hash and signatures; CLI install/flash flow; local storage layout; backend sync; security.
- Does not define business logic or API; referenced by CLI, backend, and tooling.

---

## 4. Current XSil Package Definition (Summary)

- **Format**: GZIP-compressed tar (`.tar.gz`), extension `.xsil`.
- **Integrity**: Package integrity via SHA-512 of full archive (registry/backend); content integrity via `payloadHash` (SHA-256 of uncompressed payload excluding manifest.json) in manifest.
- **Layout**:
  - **Root**: `manifest.json` (required).
  - **bitstreams/** (optional): FPGA bitstream files per board.
  - **toolchain/** (optional): Custom GCC/toolchain for the extended ISA.
  - **software/**, **docs/**, **tests/** (optional): Example software, documentation, test suites.
- **Manifest (manifest.json)**:
  - Required: name, version (SemVer), author, description, isa, boards, payloadHash, developerSignature.
  - Optional: toolchain metadata.
- **Signatures**: Developer signs payloadHash + name + version + timestamp; optional organization signature for certified packages.
- **Lifecycle**: Fetch → validate package hash → extract → validate payloadHash → verify signatures → install to ~/.extensilica/extensions/<name>/<version>/; user runs `xsil flash` where applicable.
- **Constraints**: Recommended max 100MB; developers declare boards (no platform-defined board list).

---

## 5. Legacy concepts removed

The following concepts have been removed from the codebase and docs: **browser extensions**, **generic plugin marketplace**, and **simulator plugin distribution**. The platform is defined as a RISC-V bitstream and toolchain distribution platform; package layout and manifest follow the current [XSil spec](../spec/xsil.md) (bitstreams/, toolchain/, boards, isa).

---

## 6. References: RTL / Hardware IP Distribution

All locations that refer to RTL, hardware source, or hardware IP distribution (excluding third-party gem5/venv):

| File | Line | Quote |
|------|------|--------|
| `spec/xsil.md` | 9 | "package **hardware extensions**, simulator plugins, toolchain patches" |
| `spec/xsil.md` | 37–45 | **/rtl/** (Optional): "Contains **hardware source code**. Allowed content: **Verilog** (`.v`, `.sv`). **VHDL** (`.vhd`, `.vhdl`). **SystemVerilog**. Associated **hardware testbenches**." |
| `spec/xsil.md` | 75 | Example summary: "Accelerated AES routines for QEMU + **toolchain patch**" |
| `spec/xsil.md` | 86–87 | Example: "**toolchainRequirements**": { "gcc": ">=12.1" } |
| `spec/xsil.md` | 118 | "**toolchainRequirements** | object | No | Keys: tool names, Values: version ranges." |
| `spec/xsil.md` | 161 | Local storage layout includes "**rtl/**" under extensions. |

Code/data:

- `cli/temp_pkg/rtl/aes.v`: Sample Verilog in test package.
- `store-backend/pkg_temp/rtl/`: Present in backend fixture layout.
- `cli/src/types.rs`, manifest samples: no explicit "RTL IP distribution" phrase; RTL is implied by `/rtl/` and “hardware” in the spec.

---

## 7. Document History

- **v1** (pivot baseline): Created on branch `pivot/riscv-bitstream-platform` before any code changes for the RISC-V bitstream architecture pivot. No code modified.
