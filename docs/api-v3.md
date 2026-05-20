# Public API v3 — ExtenSilica XSIL Registry

**Status:** Canonical definition  
**Version:** 3.0  
**Date:** March 2026  
**Base URL:** `https://api.extensilica.com`  
**Branch:** `pivot/npmjs-like-xsil-registry`  
**Related:** [platform-features.md](./platform-features.md), [backend-v3.md](./backend-v3.md), [data-model-v3.md](./data-model-v3.md), [auth-v3.md](./auth-v3.md)

> API examples use the fictional slug `rvv-demo` for brevity. The production reference demo is **`rvx-demo`** ([hero-packages.md](./hero-packages.md)).

---

## Conventions

### Format

- All responses are `application/json` unless stated otherwise.
- All request bodies must be `application/json` (or `multipart/form-data` for file uploads).
- Dates are ISO 8601 strings: `"2026-03-10T12:00:00.000Z"`.
- Errors always return `{ "error": "<message>" }`.

### Authentication

Authenticated endpoints require a bearer token obtained from `POST /auth/login` or `POST /auth/register`:

```
Authorization: Bearer <token>
```

Endpoints that do not require authentication work anonymously. Sending a valid token on a public endpoint is harmless (it is ignored).

### Pagination

Endpoints that return lists accept:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | 1-indexed page number |
| `limit` | integer | `20` | Results per page (max `100`) |

Paginated responses include:

```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### HTTP status codes used

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad request — validation error |
| 401 | Unauthenticated |
| 403 | Forbidden — authenticated but not authorised |
| 404 | Not found |
| 409 | Conflict — duplicate resource |
| 410 | Gone — yanked version |
| 500 | Internal server error |

---

## Public Endpoints (no auth required)

---

### `GET /packages`

List all packages. Supports optional search via query string.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Full-text search across `name`, `description`, `keywords` |
| `isa` | string | Filter by ISA string (e.g. `RV64GCV`) |
| `keyword` | string | Filter by a single keyword tag |
| `page` | integer | Page number (default `1`) |
| `limit` | integer | Results per page (default `20`, max `100`) |

**Response — 200:**

```json
{
  "data": [
    {
      "id": 1,
      "slug": "rvv-demo",
      "name": "rvv-demo",
      "description": "RISC-V Vector extension demo with Spike simulation.",
      "author": "alice",
      "keywords": ["rvv", "vector", "spike"],
      "license": "Apache-2.0",
      "latestVersion": "1.2.0",
      "totalDownloads": 1427,
      "weeklyDownloads": 84,
      "isDeprecated": false,
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-03-10T14:30:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

When `q` is present, results are ordered by relevance score (full-text rank), then by `totalDownloads` descending. Without `q`, results are ordered by `createdAt` descending (most recently published first).

---

### `GET /packages/:name`

Fetch full metadata for a single package, including the latest non-yanked version.

**Path parameters:**

| Parameter | Description |
|-----------|-------------|
| `name` | Package slug |

**Response — 200:**

```json
{
  "id": 1,
  "slug": "rvv-demo",
  "name": "rvv-demo",
  "description": "RISC-V Vector extension demo with Spike simulation.",
  "shortDescription": "RVV demo with Spike",
  "author": "alice",
  "ownerId": 7,
  "iconUrl": null,
  "keywords": ["rvv", "vector", "spike"],
  "license": "Apache-2.0",
  "repositoryUrl": "https://github.com/alice/rvv-demo",
  "homepageUrl": "https://extensilica.com/package/rvv-demo",
  "latestVersion": "1.2.0",
  "totalDownloads": 1427,
  "weeklyDownloads": 84,
  "isDeprecated": false,
  "createdAt": "2026-03-01T10:00:00.000Z",
  "updatedAt": "2026-03-10T14:30:00.000Z",
  "versions": [
    {
      "id": 3,
      "version": "1.2.0",
      "changelog": "Added vector load/store ops.",
      "xsilUrl": "https://files.extensilica.com/rvv-demo/1.2.0.xsil",
      "checksum": "sha256:9f86d081884c7d...",
      "checksumPayload": "sha256:e3b0c44298fc1c...",
      "isa": "RV64GCV",
      "toolchain": "riscv64-unknown-elf-gcc 14.2.0",
      "targets": "{\"spike\":{}}",
      "size": 48320,
      "downloadCount": 842,
      "isYanked": false,
      "yankReason": null,
      "publishedAt": "2026-03-10T14:30:00.000Z"
    }
  ]
}
```

The `versions` array is ordered `publishedAt DESC`. Yanked versions are included (with `isYanked: true`) so the full history is visible, but `latestVersion` only reflects the highest non-yanked semver.

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Package not found |

---

### `GET /packages/:name/versions`

List all published versions of a package, including yanked ones.

**Path parameters:**

| Parameter | Description |
|-----------|-------------|
| `name` | Package slug |

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Results per page |

**Response — 200:**

```json
{
  "data": [
    {
      "id": 3,
      "version": "1.2.0",
      "changelog": "Added vector load/store ops.",
      "xsilUrl": "https://files.extensilica.com/rvv-demo/1.2.0.xsil",
      "checksum": "sha256:9f86d081884c7d...",
      "checksumPayload": "sha256:e3b0c44298fc1c...",
      "isa": "RV64GCV",
      "toolchain": "riscv64-unknown-elf-gcc 14.2.0",
      "targets": "{\"spike\":{}}",
      "size": 48320,
      "downloadCount": 842,
      "isYanked": false,
      "yankReason": null,
      "publishedAt": "2026-03-10T14:30:00.000Z"
    },
    {
      "id": 2,
      "version": "1.1.0",
      "changelog": "Fixed spike config path.",
      "xsilUrl": "https://files.extensilica.com/rvv-demo/1.1.0.xsil",
      "checksum": "sha256:a4c4e20c...",
      "checksumPayload": "sha256:d1c0de...",
      "isa": "RV64GCV",
      "toolchain": "riscv64-unknown-elf-gcc 14.2.0",
      "targets": "{\"spike\":{}}",
      "size": 47100,
      "downloadCount": 431,
      "isYanked": false,
      "yankReason": null,
      "publishedAt": "2026-03-05T10:00:00.000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 20
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Package not found |

---

### `GET /packages/:name/:version`

Fetch metadata for one specific version.

**Path parameters:**

| Parameter | Description |
|-----------|-------------|
| `name` | Package slug |
| `version` | Semver string (e.g. `1.2.0`) |

**Response — 200:** Single version object (same shape as version entries in the list above), wrapped in the parent package metadata:

```json
{
  "id": 1,
  "slug": "rvv-demo",
  "name": "rvv-demo",
  "description": "...",
  "author": "alice",
  "latestVersion": "1.2.0",
  "versions": [
    {
      "id": 2,
      "version": "1.1.0",
      "isYanked": false,
      ...
    }
  ]
}
```

The response includes the package root object so clients don't need a second request for package-level fields.

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Package or version not found |

---

### `GET /search`

Full-text search alias. Equivalent to `GET /packages?q=<term>`.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search term |
| `isa` | string | No | ISA filter |
| `keyword` | string | No | Keyword tag filter |
| `page` | integer | No | Page (default `1`) |
| `limit` | integer | No | Per page (default `20`) |

**Response — 200:** Same shape as `GET /packages`.

Returns `[]` (empty data array) when `q` is empty or missing.

---

### `GET /users/:username`

Fetch a public user profile and their list of packages.

**Path parameters:**

| Parameter | Description |
|-----------|-------------|
| `username` | The user's registry handle |

**Response — 200:**

```json
{
  "id": 7,
  "username": "alice",
  "bio": "RISC-V enthusiast.",
  "avatarUrl": null,
  "createdAt": "2026-01-15T09:00:00.000Z",
  "packages": [
    {
      "slug": "rvv-demo",
      "description": "RISC-V Vector extension demo with Spike simulation.",
      "latestVersion": "1.2.0",
      "totalDownloads": 1427
    },
    {
      "slug": "rvv-int",
      "description": "Integer vector operations demo.",
      "latestVersion": "0.9.1",
      "totalDownloads": 203
    }
  ]
}
```

Note: `email` is never returned in public responses.

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | User not found |

---

### `GET /stats/packages/:name`

Return download statistics for a package. Public; no authentication required.

**Path parameters:**

| Parameter | Description |
|-----------|-------------|
| `name` | Package slug |

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | `day` \| `week` \| `month` | `week` | Aggregation granularity |
| `days` | integer | `30` | How many days of history to return (max `365`) |

**Response — 200:**

```json
{
  "slug": "rvv-demo",
  "totalDownloads": 1427,
  "weeklyDownloads": 84,
  "byDay": [
    { "date": "2026-03-10", "count": 14 },
    { "date": "2026-03-09", "count": 9 },
    { "date": "2026-03-08", "count": 12 }
  ],
  "byVersion": [
    { "version": "1.2.0", "downloads": 842 },
    { "version": "1.1.0", "downloads": 431 },
    { "version": "1.0.0", "downloads": 154 }
  ]
}
```

The `byDay` array is ordered most-recent-first, truncated to `days`.

**Errors:**

| Status | Condition |
|--------|-----------|
| 404 | Package not found |

---

## Authenticated Endpoints

All of the following require `Authorization: Bearer <token>`.

---

### `POST /auth/register`

Create a new user account.

**Auth required:** No

**Request body:**

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "hunter2hunter2"
}
```

**Validation rules:**

| Field | Rule |
|-------|------|
| `username` | Required. `[a-z0-9_-]{2,32}`. Globally unique (case-insensitive). Immutable. |
| `email` | Required. Must contain `@`. Stored lowercase. Globally unique. |
| `password` | Required. Minimum 8 characters. |

**Response — 201:**

```json
{
  "token": "a3f8c2d1e5b7...",
  "user": {
    "id": 7,
    "username": "alice",
    "email": "alice@example.com",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-10T12:00:00.000Z"
  }
}
```

The returned `token` is valid immediately. Store it for subsequent authenticated requests.

**Errors:**

| Status | Message |
|--------|---------|
| 400 | `"username, email, and password are required."` |
| 400 | `"username must be 2–32 characters and contain only lowercase letters, digits, hyphens, or underscores."` |
| 400 | `"A valid email address is required."` |
| 400 | `"Password must be at least 8 characters."` |
| 409 | `"That email is already registered."` |
| 409 | `"That username is already registered."` |

---

### `POST /auth/login`

Authenticate and receive an API token.

**Auth required:** No

**Request body:**

```json
{
  "email": "alice@example.com",
  "password": "hunter2hunter2"
}
```

**Response — 200:**

```json
{
  "token": "a3f8c2d1e5b7...",
  "user": {
    "id": 7,
    "username": "alice",
    "email": "alice@example.com",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-10T12:00:00.000Z"
  }
}
```

Each login **regenerates** the token. Any previously issued token for this account is immediately invalidated.

**Errors:**

| Status | Message |
|--------|---------|
| 400 | `"email and password are required."` |
| 401 | `"Invalid email or password."` |

---

### `POST /packages`

Claim a new package name. The authenticated user becomes the owner.

**Auth required:** Yes

**Request body:**

```json
{
  "slug": "rvv-demo",
  "description": "RISC-V Vector extension demo with Spike simulation.",
  "license": "Apache-2.0",
  "repositoryUrl": "https://github.com/alice/rvv-demo",
  "homepageUrl": "https://extensilica.com/package/rvv-demo",
  "keywords": ["rvv", "vector", "spike"]
}
```

**Field rules:**

| Field | Required | Rule |
|-------|----------|------|
| `slug` | Yes | `[a-z0-9][a-z0-9._-]{0,213}`. Globally unique. Immutable. |
| `description` | Yes | Non-empty string (≤ 280 chars). |
| `license` | No | SPDX identifier string. |
| `repositoryUrl` | No | URL string. |
| `homepageUrl` | No | URL string. |
| `keywords` | No | Array of lowercase strings. |

**Response — 201:**

```json
{
  "id": 1,
  "slug": "rvv-demo",
  "name": "rvv-demo",
  "description": "RISC-V Vector extension demo with Spike simulation.",
  "author": "alice",
  "ownerId": 7,
  "latestVersion": null,
  "totalDownloads": 0,
  "createdAt": "2026-03-10T12:00:00.000Z",
  "updatedAt": "2026-03-10T12:00:00.000Z",
  "versions": []
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | `"slug is required."` |
| 400 | `"slug contains invalid characters."` |
| 400 | `"description is required."` |
| 409 | `"Package 'rvv-demo' already exists."` |
| 401 | `"Authentication required."` |

---

### `POST /packages/:name/versions`

Publish a new version of a package. Accepts a `.xsil` archive via multipart upload.

**Auth required:** Yes. Must be the package owner or a maintainer.

**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | The `.xsil` archive |
| `version` | string | Yes | Semver string (e.g. `1.2.0`) |
| `changelog` | string | No | Description of changes in this version |
| `isa` | string | Yes | RISC-V ISA string from the manifest |
| `targets` | string | Yes | JSON-serialised `targets` object from the manifest |
| `toolchain` | string | No | Toolchain triple or description |
| `keywords` | string | No | CSV of keywords (overrides package-level keywords for this version) |
| `checksumPayload` | string | Yes | `sha256:<hex>` — SHA-256 of non-manifest files |
| `checksumArchive` | string | Yes | `sha256:<hex>` — SHA-256 of the full `.xsil` archive |
| `size` | string | Yes | Integer byte count of the archive |

**Server-side validation, in order:**

1. Authenticate request (401 if invalid).
2. Verify caller is owner or maintainer (403 if not).
3. Validate `version` is valid semver (400).
4. Check `(slug, version)` uniqueness — reject if already exists, even if yanked (409).
5. Unpack archive in memory; verify `manifest.json` is at root (400).
6. Verify `manifest.name` matches the `:name` URL parameter (400).
7. Verify `manifest.author` matches the authenticated user's username (400).
8. Recompute SHA-256 of received archive bytes; compare with `checksumArchive` (400).
9. Write `.xsil` to file store at `/<slug>/<version>.xsil`.
10. `INSERT` `Version` record.
11. `UPDATE` `Package.latestVersion` if this semver is higher than the current value.
12. Return 201.

**Response — 201:**

```json
{
  "version": "1.2.0",
  "slug": "rvv-demo",
  "xsilUrl": "https://files.extensilica.com/rvv-demo/1.2.0.xsil",
  "publishedAt": "2026-03-10T14:30:00.000Z"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | `"version must be a valid semantic version (e.g. 1.0.0)."` |
| 400 | `"manifest.json not found in archive root."` |
| 400 | `"manifest name '<n>' does not match package slug '<slug>'."` |
| 400 | `"manifest author '<a>' does not match authenticated user '<u>'."` |
| 400 | `"archive checksum mismatch."` |
| 401 | `"Authentication required."` |
| 403 | `"You do not have permission to publish to this package."` |
| 409 | `"version 1.2.0 already exists. Versions are immutable."` |

---

### `POST /packages/:name/reviews`

Submit a rating and optional comment for a package.

**Auth required:** Yes. One review per user per package. Cannot review own package.

**Request body:**

```json
{
  "rating": 5,
  "comment": "Clean layout, worked first try with Spike."
}
```

**Field rules:**

| Field | Required | Rule |
|-------|----------|------|
| `rating` | Yes | Integer `1–5` |
| `comment` | No | Plain text string. No Markdown. Max 1000 characters. |

**Response — 201:**

```json
{
  "id": 12,
  "packageId": 1,
  "userId": 9,
  "rating": 5,
  "comment": "Clean layout, worked first try with Spike.",
  "createdAt": "2026-03-11T09:00:00.000Z"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 400 | `"rating must be an integer between 1 and 5."` |
| 401 | `"Authentication required."` |
| 403 | `"You cannot review your own package."` |
| 404 | `"Package not found."` |
| 409 | `"You have already reviewed this package."` |

---

### `PATCH /packages/:name`

Update mutable metadata for a package you own.

**Auth required:** Yes. Must be the package owner.

**Request body** (all fields optional; only provided fields are updated):

```json
{
  "description": "Updated description.",
  "keywords": ["rvv", "vector", "spike", "simulation"],
  "license": "MIT",
  "repositoryUrl": "https://github.com/alice/rvv-demo",
  "homepageUrl": "https://alice.dev/rvv-demo",
  "iconUrl": "https://cdn.example.com/rvv-demo-icon.png",
  "isDeprecated": false
}
```

**Immutable fields** (cannot be changed via `PATCH`):

- `slug` / `name` — renaming is not supported.
- `ownerId` — use the ownership transfer flow (future endpoint).
- `createdAt`.

**Response — 200:** Updated package object (same shape as `GET /packages/:name`).

**Errors:**

| Status | Message |
|--------|---------|
| 400 | `"description cannot be empty."` |
| 401 | `"Authentication required."` |
| 403 | `"Only the package owner can update package metadata."` |
| 404 | `"Package not found."` |

---

### `PATCH /users/me`

Update the authenticated user's own profile.

**Auth required:** Yes

**Request body** (all fields optional):

```json
{
  "bio": "RISC-V enthusiast and toolchain hacker.",
  "avatarUrl": "https://cdn.example.com/alice-avatar.png",
  "website": "https://alice.dev"
}
```

**Immutable fields:**

- `username` — immutable after registration.
- `email` — cannot be changed via this endpoint (future: email change flow with verification).
- `id`, `createdAt`.

**Response — 200:**

```json
{
  "id": 7,
  "username": "alice",
  "email": "alice@example.com",
  "bio": "RISC-V enthusiast and toolchain hacker.",
  "avatarUrl": "https://cdn.example.com/alice-avatar.png",
  "createdAt": "2026-01-15T09:00:00.000Z",
  "updatedAt": "2026-03-11T10:00:00.000Z"
}
```

**Errors:**

| Status | Message |
|--------|---------|
| 401 | `"Authentication required."` |

---

## Additional Endpoints (implemented, not in scope above)

These endpoints exist and are documented here for completeness.

### `POST /auth/logout`

Invalidate the current API token.

**Auth required:** Yes

**Response — 200:** `{ "ok": true }`

---

### `GET /auth/me`

Return the authenticated user's own profile (includes email).

**Auth required:** Yes

**Response — 200:**

```json
{
  "user": {
    "id": 7,
    "username": "alice",
    "email": "alice@example.com",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-10T12:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z"
  }
}
```

---

### `POST /packages/:name/versions/:version/yank`

Mark a version as yanked.

**Auth required:** Yes. Owner only.

**Request body:**

```json
{ "reason": "Contains a critical simulation bug." }
```

**Response — 200:** `{ "ok": true, "version": "1.0.0", "isYanked": true }`

Yanked versions remain in the history table. The CLI refuses to install them unless `--override-security` is passed.

---

### `GET /packages/:name/versions/:version/download`

Stream the `.xsil` archive. Records a `DownloadEvent`.

**Auth required:** No

**Response — 302:** Redirect to the blob store URL.  
**Response — 410:** If `isYanked` is true: `{ "error": "This version has been yanked." }`

---

### `GET /packages/:name/reviews`

List reviews for a package.

**Auth required:** No

**Response — 200:**

```json
{
  "averageRating": 4.5,
  "count": 8,
  "reviews": [
    {
      "id": 12,
      "username": "bob",
      "rating": 5,
      "comment": "Works great.",
      "createdAt": "2026-03-11T09:00:00.000Z"
    }
  ]
}
```

---

### `GET /health`

Liveness check used by load balancers.

**Auth required:** No

**Response — 200:** `{ "ok": true, "service": "xsil-registry" }`

---

## Error Response Shape

All errors return JSON with a single `error` field:

```json
{ "error": "Package not found." }
```

Validation errors that span multiple fields may return an `errors` array instead:

```json
{
  "error": "Validation failed.",
  "errors": [
    { "field": "version", "message": "version must be a valid semantic version." },
    { "field": "isa", "message": "isa is required." }
  ]
}
```

---

## Rate Limiting (planned)

The API will enforce rate limits per IP and per token:

| Tier | Limit |
|------|-------|
| Anonymous reads | 60 requests / minute |
| Authenticated reads | 300 requests / minute |
| Publish (`POST /packages/:name/versions`) | 10 requests / hour per user |

Rate limit responses return `429 Too Many Requests` with a `Retry-After` header.

---

## CORS

The API responds to all origins (`Access-Control-Allow-Origin: *`) for `GET` endpoints to allow browser-based clients and package-page embeds. `POST` and `PATCH` endpoints require proper authentication and do not restrict by origin.

---

## Versioning

This document describes API v3. There is no version prefix in the URL path. Breaking changes will be communicated via the changelog and the `PATCH` notes in the respective architecture documents. Legacy v2 `/extensions` routes were removed in the v3 pivot.
