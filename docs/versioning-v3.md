# Versioning v3 — Semantic Versioning and Version History

## Rules summary

| Rule | Where enforced |
|------|---------------|
| Version strings must be valid semver | Backend publish controller (`SEMVER_RE`) + CLI `validate_publish_manifest` |
| Published versions are immutable | Backend uniqueness check on `(extensionId, version)` |
| `latestVersion` is the semver-greatest non-yanked version | Backend recomputed on every publish |
| Versions are returned in semver-descending order | `sortBySemverDesc` applied in `mapPackage` + `listVersions` |
| `latest` tag resolves at install time, not publish time | CLI `resolve_version` + backend `getPackageVersion` |

---

## Semantic versioning

Every `.xsil` package version must be a valid [Semantic Versioning 2.0.0](https://semver.org/) string.

Accepted formats:

```
1.0.0
2.3.1
0.1.0-alpha
1.0.0-rc.1+build.42
```

Validation is enforced at two points:

1. **CLI** — `validate_publish_manifest` calls `semver::Version::parse` before uploading.
2. **Backend** — `publishVersion` checks against `SEMVER_RE` before writing to the database.

Both checks reject non-semver strings with a clear error message.

---

## Immutability

A published version can never be overwritten. Attempting to publish the same version twice returns:

```
HTTP 409 Conflict
{ "error": "Version 1.0.0 has already been published and cannot be overwritten." }
```

CLI output:

```
error: Publish failed (409): Version 1.0.0 has already been published and cannot be overwritten.
```

This is enforced by the unique constraint `(extensionId, version)` in the database schema and the existence check in `publishVersion` before creating the new `Version` row.

**Yanking** is the supported mechanism for flagging a broken version. Yanked versions remain in the registry for audit and history purposes but are excluded from normal resolution and shown with a "yanked" badge.

---

## Latest tag resolution

The `latestVersion` field on a package is the semver-greatest non-yanked version. It is recomputed on every `xsil publish` using the `semver` package:

```typescript
const allVersions = await prisma.version.findMany({ where: { extensionId: pkg.id }, select: { version: true, isYanked: true } });
const newLatest = computeLatestVersion(allVersions); // semver max of non-yanked
await prisma.extension.update({ where: { id: pkg.id }, data: { latestVersion: newLatest } });
```

This means publishing an older patch (`1.0.1` after `1.1.0` is already live) does **not** change the latest tag:

```
Before: latestVersion = "1.1.0"
xsil publish  (version = "1.0.1")
After:  latestVersion = "1.1.0"   ← unchanged
```

---

## Version ordering

All endpoints that return package data (`GET /packages/:name`, `GET /packages/:name/versions`) sort versions by **semver descending** (newest first). The frontend version history table and CLI output follow this same order.

Pre-release versions (`1.0.0-alpha`, `1.0.0-rc.1`) sort below their release counterpart per semver spec.

---

## API endpoints

### List all versions

```
GET /packages/:name/versions
```

Returns a semver-sorted version list with immutability and latest-tag metadata:

```json
{
  "package": "rvx-demo",
  "latestVersion": "1.2.0",
  "versions": [
    {
      "version": "1.2.0",
      "isLatest": true,
      "isYanked": false,
      "publishedAt": "2026-03-01T10:00:00.000Z",
      "changelog": "Add RV64 support",
      "isa": "rv64imac",
      "targets": "[\"spike\",\"qemu\"]",
      "toolchain": "riscv64-unknown-elf",
      "size": 204800,
      "downloadCount": 132,
      "checksum": "sha256:abc..."
    },
    {
      "version": "1.1.0",
      "isLatest": false,
      "isYanked": false,
      ...
    }
  ]
}
```

### Fetch a specific version

```
GET /packages/:name/:version
GET /packages/:name/latest
```

Both return the full package object (all versions in semver order) with an additional `requestedVersion` field indicating which version was resolved.

`latest` resolves to the semver-greatest non-yanked version at request time.

---

## CLI usage

### Install latest

```bash
xsil install rvx-demo
# equivalent to:
xsil install rvx-demo@latest
```

### Install a specific version

```bash
xsil install rvx-demo@1.2.0
xsil install rvx-demo@1.0.0-rc.1
```

### Inspect a version

```bash
xsil info rvx-demo           # package summary + all available versions
xsil info rvx-demo@1.1.0    # same + detail block for version 1.1.0
xsil info rvx-demo@latest   # resolves to current latest and shows its detail
```

### Run / test a specific version

```bash
xsil run  rvx-demo@1.1.0
xsil test rvx-demo@1.1.0
```

### Downgrade protection

Installing an older version over a newer installed version is blocked by default:

```
error: Would install older version (1.0.0 < 1.2.0). Use --force.
```

Pass `--force` to override.

---

## Frontend version history

The package page (`/package/:slug`) shows a version history table in the **Versions** section:

| Column | Description |
|--------|-------------|
| Version | Semver string; "latest" badge on the `latestVersion` entry; "yanked" badge if applicable |
| Changelog | First line of the changelog entry for that version (if provided) |
| Install command | `xsil install pkg@version` — appears on row hover, with a copy button |
| Published | ISO date |
| Size | Archive size in bytes |
| Downloads | `Version.downloadCount` (all-time) |
| Status | `active` or `yanked` |

The "latest" badge is tied to `pkg.latestVersion` (the semver-correct latest), not simply the first row in the table.

---

## Yanked versions

A yanked version is one that has been flagged as broken or unsafe. Yank behaviour:

- Yanked versions are **excluded** from normal version resolution (`latest`, unqualified install).
- Yanked versions **remain visible** in the version history table (with a "yanked" badge and reduced opacity).
- Installing a yanked version explicitly requires `--override-security`:

```bash
xsil install rvx-demo@1.0.1 --override-security
```

- Yanking does not remove the file or invalidate existing installations.

---

## Publish flow (version perspective)

```
xsil publish path/to/package/
  ↓
CLI validates manifest.version is valid semver
  ↓
POST /packages/:slug/versions  (multipart, includes .xsil file)
  ↓
Backend checks: slug exists, user is owner/maintainer
Backend checks: version is unique for this package  → 409 if duplicate
Backend stores file, creates Version row
Backend recomputes latestVersion = semver max of non-yanked versions
  ↓
New version visible immediately on website and via xsil info / xsil install
```
