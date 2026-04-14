# Data Model v3 — XSIL Package Registry

**Status:** Canonical target definition  
**Date:** March 2026  
**Branch:** `pivot/npmjs-like-xsil-registry`  
**Related:** [backend-v3.md](./backend-v3.md), [product-architecture-v3.md](./product-architecture-v3.md)

This document is the single source of truth for the database schema of the ExtenSilica registry backend. It defines every entity, every field, all relationships, all indexes, and the constraints that enforce registry invariants.

---

## Entity Overview

```
User ──< Maintainer >──< Package >──< PackageVersion >──< PackageFile
 │                          │               │
 │                          │               └──< DownloadEvent
 │                          │
 └──< Review >──────────────┘
 │
Organization ──< Package (optional scope)
```

| Entity | Purpose |
|--------|---------|
| `User` | Registry account — authentication, authorship, ownership |
| `Organization` | Named scope for team-owned packages (e.g. `@extensilica/`) |
| `Package` | A named, versioned artifact in the registry |
| `PackageVersion` | One immutable published version of a package |
| `PackageFile` | Individual files within a version archive |
| `DownloadEvent` | Append-only log of every package download |
| `Review` | User-submitted rating and comment for a package |
| `Maintainer` | Join table: which users can publish versions of a package |

---

## Entities

### `User`

Registry account. Holds authentication credentials and public profile data.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Int | PK autoincrement | |
| `username` | String | unique, not null | Lowercase alphanumeric and hyphens. Used in `/~<username>` profile URLs. Immutable after creation. |
| `email` | String | unique, not null | Never exposed in public API responses. |
| `passwordHash` | String | not null | bcrypt hash. Never returned by any endpoint. |
| `apiToken` | String | unique, nullable | Random 32-byte hex token. Set on login, cleared on logout. Used for CLI auth (`Authorization: Bearer <token>`). |
| `bio` | String | nullable | Short plain-text biography shown on profile page. |
| `avatarUrl` | String | nullable | URL to avatar image. |
| `createdAt` | DateTime | default now() | |
| `updatedAt` | DateTime | updatedAt | |

**Indexes:** `username` (unique), `email` (unique), `apiToken` (unique, partial — where not null)

**Invariants:**
- `username` must be globally unique, case-insensitively.
- `passwordHash` and `email` are never included in any public API response.
- `apiToken` is regenerated on every successful login; old token is immediately invalidated.

---

### `Organization`

Named scope for team-owned packages. Packages can be scoped under an organization
(e.g. `@extensilica/rvv-demo`) or owned by a user directly (unscoped, e.g. `rvv-demo`).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Int | PK autoincrement | |
| `name` | String | not null | Display name (e.g. "ExtenSilica Core Team"). |
| `slug` | String | unique, not null | URL-safe identifier used in the scope prefix (e.g. `extensilica`). Immutable after creation. |
| `description` | String | nullable | Short description shown on the org page. |
| `avatarUrl` | String | nullable | |
| `createdAt` | DateTime | default now() | |
| `updatedAt` | DateTime | updatedAt | |

**Indexes:** `slug` (unique)

**Relationships:**
- An organization has many `Package` records via `Package.organizationId`.
- Organization membership (which users belong to an org and at what role) is tracked via `OrgMember` (see §Ancillary Tables).

---

### `Package`

The primary registry entity. Represents a named package at all versions. Ownership is
by either a `User` or an `Organization`, not both simultaneously.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Int | PK autoincrement | |
| `scope` | String | nullable | Organization slug prefix, without `@` (e.g. `extensilica`). Null for user-owned packages. |
| `name` | String | not null | Package name without scope (e.g. `rvv-demo`). |
| `slug` | String | unique, not null | Canonical registry identifier: `<scope>/<name>` when scoped, or `<name>` when unscoped. Derived from `scope` + `name` at creation, immutable thereafter. |
| `summary` | String | not null | Short description (≤ 280 chars). Shown in search results and package cards. |
| `description` | String | nullable | Long-form description (plain text or Markdown source). |
| `readmeHtml` | String | nullable | Rendered HTML of the latest version's README. Updated on every new version publish. |
| `ownerId` | Int | FK → User, nullable | Set when the package is user-owned. Null when org-owned. |
| `organizationId` | Int | FK → Organization, nullable | Set when the package is org-owned. Null when user-owned. |
| `repositoryUrl` | String | nullable | Source repository URL. |
| `homepageUrl` | String | nullable | Project homepage URL. |
| `keywords` | String | not null, default `""` | CSV of search tags. Indexed for full-text search. |
| `license` | String | nullable | SPDX license identifier (e.g. `Apache-2.0`). |
| `latestVersion` | String | nullable | Denormalized semver of the latest non-yanked version. Updated on publish. |
| `totalDownloads` | Int | default 0 | Aggregated from `DownloadEvent`. Updated by background job. |
| `weeklyDownloads` | Int | default 0 | Downloads in the past 7 days. Updated by background job. |
| `isDeprecated` | Boolean | default false | Owner-set flag. Deprecated packages show a banner but remain installable. |
| `createdAt` | DateTime | default now() | |
| `updatedAt` | DateTime | updatedAt | |

**Indexes:** `slug` (unique), `ownerId`, `organizationId`, full-text on `name` + `summary` + `keywords`

**Invariants:**
- Exactly one of `ownerId` or `organizationId` must be non-null. The other must be null. Enforced at the application layer.
- `slug` is immutable once set. Renaming a package is not supported (mirrors npm semantics).
- `keywords` is stored as CSV; the API accepts and returns an array of strings.

---

### `PackageVersion`

One immutable published version of a package. Once a row exists for a given
`(packageId, version)` pair it cannot be modified — only yanked.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Int | PK autoincrement | |
| `packageId` | Int | FK → Package (cascade delete) | |
| `version` | String | not null | Semver string (e.g. `1.2.0`). |
| `manifestJson` | String | not null | Full `manifest.json` content from the `.xsil` archive, stored verbatim as a JSON string. Source of truth for all manifest-derived fields. |
| `xsilUrl` | String | not null | URL of the `.xsil` archive in the file store. |
| `checksum` | String | not null | SHA-256 of the full `.xsil` archive: `sha256:<hex>`. Used to verify the blob after download. |
| `checksumPayload` | String | nullable | SHA-256 over all non-manifest files (from `manifest.json` `checksums.payload`). Used by the CLI to verify the unpacked content. |
| `isa` | String | not null | RISC-V ISA string extracted from the manifest. Indexed for search and display. |
| `targets` | String | nullable | JSON blob of the manifest `targets` object (spike/qemu/fpga entries). |
| `toolchain` | String | nullable | Toolchain triple or description from the manifest. |
| `size` | Int | not null | Total archive size in bytes. Shown in the metadata sidebar. |
| `downloadCount` | Int | default 0 | Per-version download counter. Updated by background job. |
| `isYanked` | Boolean | default false | Yanked versions are excluded from default install resolution. |
| `yankReason` | String | nullable | Optional reason string set by the owner when yanking. |
| `publishedAt` | DateTime | default now() | |

**Unique constraint:** `(packageId, version)`

**Indexes:** `packageId`, `version`, `(packageId, isYanked)` for latest-version queries

**Invariants:**
- `version` must be a valid semver string. Rejected at the API boundary if malformed.
- Once `isYanked` is set to `true`, it cannot be unset. Yank is permanent.
- `manifestJson` is stored verbatim and never mutated. It is the immutable record of what was published.

---

### `PackageFile`

Individual files extracted from a `.xsil` archive. Stored for browsability on the
package page (file browser) and for direct download links.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Int | PK autoincrement | |
| `packageVersionId` | Int | FK → PackageVersion (cascade delete) | |
| `kind` | String | not null | Semantic category: `manifest`, `readme`, `sim`, `toolchain`, `test`, `bitstream`, `asset`, `other`. |
| `path` | String | not null | Path relative to the archive root (e.g. `sim/run.sh`). |
| `size` | Int | not null | File size in bytes. |
| `checksum` | String | not null | SHA-256 of the file contents: `sha256:<hex>`. |
| `url` | String | nullable | Direct download URL for this file in the file store (if separately stored). |

**Unique constraint:** `(packageVersionId, path)`

**Indexes:** `packageVersionId`, `kind`

**Note:** Populating this table is optional at publish time. When populated, it enables a file browser on the version page. When empty, the version page shows only the archive-level download.

---

### `DownloadEvent`

Append-only log of every package archive download. Never updated, never deleted
(except for bulk privacy purges, which do not affect counters).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Int | PK autoincrement | |
| `packageId` | Int | FK → Package (cascade delete) | Denormalized for fast package-level aggregation. |
| `packageVersionId` | Int | FK → PackageVersion (cascade delete) | |
| `ipHash` | String | nullable | SHA-256 of the client IP address. Raw IP is never stored. Null for anonymous/masked requests. |
| `userAgent` | String | nullable | `User-Agent` header value. Truncated to 512 chars. |
| `country` | String | nullable | Two-letter country code derived from IP via GeoIP lookup. Never stored with `ipHash` in the same query context (privacy). |
| `timestamp` | DateTime | default now() | |

**Indexes:** `packageId`, `packageVersionId`, `timestamp`, `(ipHash, packageVersionId, date(timestamp))` for deduplication

**Invariants:**
- Deduplication: at most one event per `(ipHash, packageVersionId)` per UTC calendar day. Anonymous events (null `ipHash`) are always counted.
- `totalDownloads` and `weeklyDownloads` on `Package`, and `downloadCount` on `PackageVersion`, are computed from this table by a background aggregation job. They are never decremented.

---

### `Review`

User-submitted rating and comment for a package.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Int | PK autoincrement | |
| `packageId` | Int | FK → Package (cascade delete) | |
| `userId` | Int | FK → User (cascade delete) | |
| `rating` | Int | not null, check 1–5 | Integer from 1 to 5 inclusive. |
| `comment` | String | nullable | Plain text. No Markdown. |
| `createdAt` | DateTime | default now() | |
| `updatedAt` | DateTime | updatedAt | |

**Unique constraint:** `(packageId, userId)` — one review per user per package.

**Indexes:** `packageId`, `userId`

**Invariants:**
- A user cannot review their own package (enforced at the application layer).
- `rating` must be an integer in `[1, 5]`.

---

### `Maintainer`

Join table granting publish rights to users who are not the package owner.
Mirrors npm's maintainer model: owners can add maintainers; maintainers can publish
new versions but cannot transfer ownership or add other maintainers.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | Int | PK autoincrement | |
| `packageId` | Int | FK → Package (cascade delete) | |
| `userId` | Int | FK → User (cascade delete) | |
| `role` | String | not null, default `"maintainer"` | `"owner"` or `"maintainer"`. Owners can transfer ownership and manage maintainers. Maintainers can only publish versions. |
| `addedAt` | DateTime | default now() | |

**Unique constraint:** `(packageId, userId)`

**Indexes:** `packageId`, `userId`

**Invariants:**
- Every package must have exactly one `"owner"` role entry at all times. Enforced in the ownership transfer transaction.
- The `ownerId` on `Package` and the `"owner"` entry in `Maintainer` must always agree. Both are updated atomically during transfer.

---

## Ancillary Tables

### `OrgMember`

Tracks which users belong to an organization and at what role.

| Field | Type | Notes |
|-------|------|-------|
| `id` | Int | PK |
| `organizationId` | Int | FK → Organization (cascade delete) |
| `userId` | Int | FK → User (cascade delete) |
| `role` | String | `"owner"` or `"member"`. Owners can add/remove members and transfer org packages. |
| `joinedAt` | DateTime | default now() |

**Unique constraint:** `(organizationId, userId)`

---

## Relationships Summary

```
User
  ├── owns many Package (via Package.ownerId)
  ├── belongs to many Organization (via OrgMember)
  ├── is maintainer on many Package (via Maintainer)
  └── has many Review

Organization
  └── owns many Package (via Package.organizationId)

Package
  ├── has one owner: User or Organization (mutually exclusive)
  ├── has many Maintainer (users with publish rights)
  ├── has many PackageVersion
  ├── has many DownloadEvent
  └── has many Review

PackageVersion
  ├── belongs to Package
  ├── has many PackageFile
  └── has many DownloadEvent

Review
  ├── belongs to Package
  └── belongs to User

Maintainer
  ├── belongs to Package
  └── belongs to User
```

---

## Prisma Schema (Target)

```prisma
// ============================================================
// ExtenSilica Registry — target Prisma schema v3
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"   // swap to "postgresql" for production
  url      = env("DATABASE_URL")
}

// ── Identity ─────────────────────────────────────────────────

model User {
  id           Int       @id @default(autoincrement())
  username     String    @unique
  email        String    @unique
  passwordHash String
  apiToken     String?   @unique
  bio          String?
  avatarUrl    String?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  ownedPackages    Package[]    @relation("PackageOwner")
  maintainerships  Maintainer[]
  orgMemberships   OrgMember[]
  reviews          Review[]
}

model Organization {
  id          Int       @id @default(autoincrement())
  name        String
  slug        String    @unique
  description String?
  avatarUrl   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  packages Package[]  @relation("PackageOrg")
  members  OrgMember[]
}

model OrgMember {
  id             Int          @id @default(autoincrement())
  organizationId Int
  userId         Int
  role           String       @default("member") // "owner" | "member"
  joinedAt       DateTime     @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
}

// ── Packages ──────────────────────────────────────────────────

model Package {
  id             Int       @id @default(autoincrement())
  scope          String?
  name           String
  slug           String    @unique
  summary        String
  description    String?
  readmeHtml     String?
  ownerId        Int?
  organizationId Int?
  repositoryUrl  String?
  homepageUrl    String?
  keywords       String    @default("")  // CSV
  license        String?
  latestVersion  String?
  totalDownloads Int       @default(0)
  weeklyDownloads Int      @default(0)
  isDeprecated   Boolean   @default(false)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  owner        User?         @relation("PackageOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  organization Organization? @relation("PackageOrg", fields: [organizationId], references: [id], onDelete: Restrict)
  versions     PackageVersion[]
  maintainers  Maintainer[]
  reviews      Review[]
  downloads    DownloadEvent[]
}

model PackageVersion {
  id              Int       @id @default(autoincrement())
  packageId       Int
  version         String
  manifestJson    String
  xsilUrl         String
  checksum        String
  checksumPayload String?
  isa             String
  targets         String?   // JSON blob
  toolchain       String?
  size            Int
  downloadCount   Int       @default(0)
  isYanked        Boolean   @default(false)
  yankReason      String?
  publishedAt     DateTime  @default(now())

  package  Package       @relation(fields: [packageId], references: [id], onDelete: Cascade)
  files    PackageFile[]
  downloads DownloadEvent[]

  @@unique([packageId, version])
}

model PackageFile {
  id               Int    @id @default(autoincrement())
  packageVersionId Int
  kind             String // manifest|readme|sim|toolchain|test|bitstream|asset|other
  path             String
  size             Int
  checksum         String
  url              String?

  version PackageVersion @relation(fields: [packageVersionId], references: [id], onDelete: Cascade)

  @@unique([packageVersionId, path])
}

// ── Downloads ─────────────────────────────────────────────────

model DownloadEvent {
  id               Int      @id @default(autoincrement())
  packageId        Int
  packageVersionId Int
  ipHash           String?
  userAgent        String?
  country          String?
  timestamp        DateTime @default(now())

  package Package        @relation(fields: [packageId], references: [id], onDelete: Cascade)
  version PackageVersion @relation(fields: [packageVersionId], references: [id], onDelete: Cascade)
}

// ── Reviews ───────────────────────────────────────────────────

model Review {
  id        Int      @id @default(autoincrement())
  packageId Int
  userId    Int
  rating    Int      // 1–5
  comment   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  package Package @relation(fields: [packageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([packageId, userId])
}

// ── Maintainers ───────────────────────────────────────────────

model Maintainer {
  id        Int      @id @default(autoincrement())
  packageId Int
  userId    Int
  role      String   @default("maintainer") // "owner" | "maintainer"
  addedAt   DateTime @default(now())

  package Package @relation(fields: [packageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([packageId, userId])
}
```

---

## Field Naming Conventions

| Convention | Rationale |
|-----------|-----------|
| `id` — autoincrement Int | Simple surrogate key for all tables |
| `slug` — URL-safe string | Used in all public URLs; immutable after creation |
| `*At` suffix — DateTime | All timestamps use this suffix (`createdAt`, `publishedAt`, etc.) |
| `is*` prefix — Boolean | All boolean flags use this prefix (`isYanked`, `isDeprecated`) |
| CSV for arrays | Keywords and tags stored as comma-separated strings in SQLite; parsed to arrays at the controller layer |
| JSON blobs as String | Complex manifest fields (`targets`, `manifestJson`) stored as serialized JSON strings; parsed at the controller layer |

---

## Removed Fields from v2

The following fields from the v2 `Extension` and `Version` models are absent from this
schema and must not be re-introduced:

| Removed field | Was on | Reason |
|--------------|--------|--------|
| `category` | `Extension` | Fixed platform enum; replaced by free-form `keywords` |
| `screenshots` | `Extension` | Browser-extension concept; irrelevant for RISC-V packages |
| `rating` (float) | `Extension` | Replaced by computed aggregate of `Review.rating` |
| `boards` | `Version` | FPGA opaque blob; absorbed into `PackageVersion.targets` |
| `isRevoked` | `Version` | Renamed to `isYanked` (aligns with npm semantics) |
| `packageHash` | `Version` | Renamed to `checksum` / `checksumPayload` with clearer scope |
| `developerPublicKey` | API response stub | Trust-chain artifact from v1; no role in an open registry |
| `developerCertificate` | API response stub | Same as above |
| `developerVerification` | API response stub | Same as above |
