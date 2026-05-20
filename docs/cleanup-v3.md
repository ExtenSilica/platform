# Cleanup Report — v3 Registry Pivot

**Date:** 2026-03-06
**Commit:** `refactor: remove legacy concepts after npm-like registry pivot`
**Scope:** Repository-wide removal of browser-extension, wallet/Web3, pay-per-flash, licensing, developer-signing, and commercial-marketplace concepts.

---

## Summary

After three product pivots, the repository accumulated significant residue from v1 (browser extension marketplace) and v2 (FPGA/pay-per-flash registry). This pass removes that residue from live code, test fixtures, seeds, and documentation without touching intentionally historical documents.

---

## Deleted files

### Backend — legacy scripts (24 files)

| File | Legacy concept |
|------|---------------|
| `store-backend/test_purchase.js` | Stripe purchase + license flow |
| `store-backend/test_revocation.js` | License revocation flow |
| `store-backend/reset_revocation.js` | Developer certificate revocation |
| `store-backend/revoke_key.js` | Developer key revocation |
| `store-backend/revoke_cert.js` | Developer certificate revocation |
| `store-backend/unrevoke_user.js` | Undo developer revocation |
| `store-backend/generate_org_keys.js` | Organization Ed25519 key generation |
| `store-backend/migrate_developers.js` | Populate legacy `Developer` table |
| `store-backend/issue_cert.js` | Issue developer certificates |
| `store-backend/update_key.js` | Update developer public key |
| `store-backend/fetch_cert.js` | Fetch developer certificate from DB |
| `store-backend/test_secure_upload.js` | Signed upload + certificate verification |
| `store-backend/test_certificate.js` | Developer certificate flow |
| `store-backend/test_verification.js` | Developer identity verification |
| `store-backend/multi_version_test.js` | Legacy JWT auth + `/extensions` route |
| `store-backend/e2e_setup.js` | Legacy JWT auth + `/extensions` route |
| `store-backend/publish_signed.js` | Legacy signed publish via `/extensions` |
| `store-backend/unauthorized_test.js` | Legacy JWT auth test |
| `store-backend/seed.js` | Compiled duplicate of seed.ts; had `category`, `rating`, `downloads` |

### Backend — live source

| File | Legacy concept |
|------|---------------|
| `store-backend/src/routes/trust.ts` | `/trust/organization`, `/revocations`, `/developers` endpoints |
| `store-backend/src/controllers/trustController.ts` | `getOrganizationKey`, `getRevocationList`, `getDevelopers` handlers |

### CLI

| File | Legacy concept |
|------|---------------|
| `cli/sign_as_org.js` | Organization Ed25519 signing of manifests |

---

## Modified files

### Backend

#### `store-backend/src/server.ts`
- Removed legacy `/extensions`, `/api/extensions` route aliases (old browser-extension store paths).
- Removed unused `listPackages` / `getPackageBySlug` direct imports (now only used via router).
- Updated comment on `/packages` routes to reflect current write-endpoint support.

#### `store-backend/src/swagger.ts`
- Removed `category` (browser-extension enum), `rating` (float on Extension), `isRevoked` (old revocation flag) from the `Package` / `PackageVersion` OpenAPI schemas.
- Added correct current fields: `reviewCount`, `averageRating`, `isYanked`, `yankReason`, `checksum`, `checksumPayload`, `isa`, `toolchain`, `targets`, `size`, `totalDownloads`, `weeklyDownloads`.
- Added `Review` and `PackageStats` schemas.
- Bumped API version to `3.0.0`.

#### `store-backend/prisma/seed.ts`
- Removed `category`, `rating`, `downloads` fields (not in current schema).
- Renamed `CryptoSoft` author → `xsil-community`; replaced `CryptoLight` package with `Vec128` (RISC-V Vector demo).
- Added `rvx-demo` seed package (minimal hello-world for tutorials).
- All packages now use real RISC-V ISA strings (`rv64gc`, `rv64gcv`, `rv32imc`).

#### `store-backend/pkg_temp/manifest.json`
- Stripped `signature`, `certificate`, `developerPublicKey`, `developerSignature`, `trustLevel`, `issuer`, `payloadHash`, `payloadSize`, `installSteps`, `uninstallSteps`, `simulatorRequirements`, `toolchainRequirements`.
- Replaced with current v2 manifest fields: `description`, `isa`, `targets`, `entry`, `checksum`.
- Replaced `CryptoSoft` author with `xsil-community`.

### CLI test fixtures

#### `cli/tampered_pkg/manifest.json`
#### `cli/tampered_manifest_pkg/manifest.json`
#### `cli/check_signed/manifest.json`
- Stripped all Ed25519 signature fields (`signature.type`, `developerPublicKey`, `developerSignature`, `signedAt`).
- Replaced legacy fields (`payloadHash`, `payloadSize`, `installSteps`, `uninstallSteps`, etc.) with current manifest shape (`description`, `isa`, `targets`, `entry`, `checksum`).

### Frontend

#### `store-frontend/lib/types.ts`
- Removed `flashCommand?: string` from `DeclaredManifestTarget` interface (pay-per-flash FPGA command; not part of the v3 format).

### Documentation

#### `docs/security-model.md` — **Rewritten**
- Removed sections: "Developer signatures" (Ed25519 keypair + manifest signature), "Organization signatures" (platform CA), flash-credit reference.
- Added sections: checksum validation table (`checksum` vs `checksumPayload`), immutable versions, author responsibility, registry access control, transport security.
- Retained: dual-hash validation concept (now explained in terms of current field names).
- "What is explicitly absent" table replaces scattered "removed" notes.

#### `docs/developer-publishing.md` — **Rewritten**
- Removed signing steps: `xsil keygen`, Ed25519 keypair registration, `developerSignature` injection, org certificates.
- Removed `boards[].flashCommand` requirement.
- Rewritten as a clean 6-step guide matching the current registry publish flow: build → assemble → manifest → pack → login → publish.
- Cross-references updated to point to `spec/xsil.md` and `docs/cli-v3.md`.

#### `docs/execution-model.md` — **Minor updates**
- Renamed example slug `rvx-crypto` → `rvx-demo`.
- Updated "No platform board catalog" paragraph: replaced `boards[]` + `flashCommand` wording with `targets.fpga` + publisher-defined bitstream paths (matches current spec).

---

## Intentionally preserved (historical documents)

The following files contain intentional references to removed concepts as part of the project's development history. They are left unchanged:

| File | Reason |
|------|--------|
| `docs/history/pivot-baseline.md` | v1 baseline snapshot; documents what was removed |
| `docs/history/pivot-v2.md` | v2 pivot record; explains rationale for removing pay-per-flash |
| `docs/history/pivot-v3-baseline.md` | v3 baseline snapshot; explicitly lists what changed |
| `docs/README.md` | Changelog of the docs folder across pivots |
| `docs/history/license-wrapper.md` | Historical record of the v1 commercial model |
| `store-backend/prisma/migrations/` | SQL migration history; old column names in `ALTER/DROP` statements are correct archaeology |

---

## What remains (acceptable)

| Artifact | Why it stays |
|----------|--------------|
| `import * as crypto from 'crypto'` in controllers | Node.js standard library for SHA-256 hashing — not Web3 |
| `license` field on `Extension` / `Version` / manifest | SPDX license string (e.g. `"MIT"`) — a normal package registry metadata field |
| `spec/xsil.md` mentions `checksums` as "cryptographic digests" | Standard terminology for hash verification |
| `docs/analytics-v3.md` uses "auditable" | Means "inspectable"; no commercial connotation |
| `store-frontend/app/legal/terms/page.tsx` mentions "cryptocurrency" | Legal copy explicitly prohibiting malware of that type — intentional |
| `store-frontend/app/faq/page.tsx` has "Security and Trust" section title | Standard FAQ section label; no connection to legacy trust chain |
| `gem5/` directory | Third-party simulator reference; unrelated to registry product concepts |

---

## Verification

After this cleanup:

- `rg -i 'wallet|web3|pay-per-flash|flash credit|revocation|trustController|developerSignature|organizationSignature' --type ts --type js --glob '!*.d.ts' store-backend/src store-frontend cli/src` → **0 matches**
- `rg 'category.*Crypto\|Crypto.*category\|rating.*4\.' store-backend/prisma/seed.ts` → **0 matches**
- `rg '/extensions' store-backend/src/server.ts` → **0 matches**
- Frontend build: `npm run build` (store-frontend) → **no errors**
- Backend TypeScript: `npx tsc --noEmit` (store-backend) → **no errors**
