# ExtenSilica Security Model

Package integrity at rest and in transit. **No licensing, pay-per-flash, or commercial trust roots.**

## Checksum validation

Every `.xsil` archive carries two optional but recommended checksums in its manifest:

| Field | Covers | Purpose |
|-------|--------|---------|
| `checksum` | Entire `.xsil` tarball (SHA-256) | Detect corruption or tampering during download |
| `checksumPayload` | All files except `manifest.json` (SHA-256) | Detect modification of packaged binaries after extraction |

The CLI verifies both checksums after downloading a package. If either mismatch, installation is aborted.

## Immutable versions

Published versions are immutable. A publisher cannot overwrite a released version; they must publish a new version number. A version may be **yanked** (hidden from install resolution) by the publisher or a registry maintainer, but the artifact and its record remain in the registry for auditability.

## Author responsibility

Package authors are responsible for the content they upload. The ExtenSilica platform does not sandbox or audit package binaries before publication. Users are advised to inspect packages and only install from authors they trust.

## Registry access control

- All read endpoints (package list, metadata, version info, stats) are public.
- Publishing, editing package metadata, and managing maintainers require a valid API token tied to a registered user account.
- API tokens are opaque random 64-hex-char strings stored as bcrypt hashes. They are not JWTs and carry no embedded claims.

## Transport security

All production API and file-download traffic must be served over HTTPS. The development server uses plain HTTP on `localhost:3001` for convenience only.

## What is explicitly absent

| Removed concept | Reason |
|-----------------|--------|
| Developer Ed25519 keypair + signature in manifest | Legacy v1/v2 artifact; CLI no longer generates or verifies these |
| Organization trust chain / platform CA | Tied to v1 commercial model; removed entirely |
| `/trust/revocations` endpoint | Not needed; yank mechanism replaces revocation |
| License token verification | Pay-per-flash model removed in v2 |
| Stripe / USDC payments | Removed in v2 |
