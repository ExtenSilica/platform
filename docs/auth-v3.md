# Authentication v3 — Standard Web Auth for the XSIL Registry

**Status:** Implemented  
**Date:** March 2026  
**Branch:** `pivot/npmjs-like-xsil-registry`  
**Related:** [backend-v3.md](./backend-v3.md), [data-model-v3.md](./data-model-v3.md)

---

## Overview

Authentication in ExtenSilica v3 is standard email/password web authentication backed by an opaque API token. There is no wallet, no Web3, no OAuth, no JWTs, and no external identity provider. The model is intentionally simple and mirrors what developers expect from registries like npm, crates.io, or PyPI.

---

## Auth Model: Opaque Bearer Token

On every successful login, the server generates a **random 64-character hex token** (`crypto.randomBytes(32).toString('hex')`) and stores it alongside the user row. The client sends it as a standard HTTP `Authorization` header:

```
Authorization: Bearer <token>
```

**Properties:**

| Property | Value |
|----------|-------|
| Token format | 32 random bytes, hex-encoded (64 chars) |
| Token lifetime | Until the next login or explicit logout |
| Storage (server) | `User.apiToken` column; unique index |
| Storage (client) | `~/.extensilica/config.toml` (CLI) or `localStorage` (web) |
| Rotation | A new token is generated on every login; the old token is immediately invalidated |
| Revocation | `POST /auth/logout` sets `apiToken = null`; the token is unusable from that point |

This is **not JWT**. The server always performs a database lookup to validate the token, which means revocation is instant. There is no token expiry window to manage.

---

## Password Hashing

Passwords are hashed with **bcrypt** (12 rounds) before storage. The raw password never touches the database.

```
password → bcrypt.hash(password, 12) → User.passwordHash
```

Login:
```
bcrypt.compare(inputPassword, User.passwordHash) → boolean
```

**User enumeration protection:** When a login attempt fails because the email does not exist, the handler still runs `bcrypt.compare` against a dummy hash before returning `401`. This ensures the response time is the same whether the email exists or not, making it harder to enumerate registered addresses through timing.

---

## Account Creation Rules

| Field | Rule |
|-------|------|
| `username` | Required. 2–32 characters. Lowercase letters, digits, hyphens, underscores only (`[a-z0-9_-]`). Globally unique, case-insensitive. Immutable after creation. |
| `email` | Required. Must contain `@`. Stored lowercase. Globally unique. Never returned in public API responses. |
| `password` | Required. Minimum 8 characters. Not validated for complexity (complexity rules are UX friction that does not improve security). |

Usernames and emails are checked for uniqueness in a single query before the bcrypt hash is computed. If a collision is found, `409 Conflict` is returned with the specific field name (`"username"` or `"email"`).

---

## Auth Flow

### Registration

```
Client                          Server
  │                               │
  │  POST /auth/register           │
  │  { username, email, password } │
  │ ─────────────────────────────► │
  │                               ├─ validate fields
  │                               ├─ check username + email uniqueness
  │                               ├─ bcrypt.hash(password, 12)
  │                               ├─ crypto.randomBytes(32) → token
  │                               ├─ INSERT User { username, email, passwordHash, apiToken }
  │  ◄───────────────────────────  │
  │  201 { token, user }           │
  │                               │
  │  Store token in config/storage │
```

### Login

```
Client                          Server
  │                               │
  │  POST /auth/login              │
  │  { email, password }          │
  │ ─────────────────────────────► │
  │                               ├─ SELECT User WHERE email = ?
  │                               ├─ bcrypt.compare(password, passwordHash)
  │                               │    (runs even if user not found — timing safety)
  │                               ├─ if invalid → 401
  │                               ├─ crypto.randomBytes(32) → newToken
  │                               ├─ UPDATE User SET apiToken = newToken
  │  ◄───────────────────────────  │
  │  200 { token, user }           │
  │                               │
  │  Store new token (old invalid) │
```

### Authenticated request

```
Client                          Server
  │                               │
  │  GET /auth/me                  │
  │  Authorization: Bearer <token> │
  │ ─────────────────────────────► │
  │                               ├─ authenticate middleware
  │                               │    SELECT User WHERE apiToken = ?
  │                               │    attach req.user (no passwordHash, no apiToken)
  │                               ├─ requireAuth middleware
  │                               │    req.user present → continue
  │  ◄───────────────────────────  │
  │  200 { user: { id, username, … } } │
```

### Logout

```
Client                          Server
  │                               │
  │  POST /auth/logout             │
  │  Authorization: Bearer <token> │
  │ ─────────────────────────────► │
  │                               ├─ authenticate → req.user
  │                               ├─ requireAuth → pass
  │                               ├─ UPDATE User SET apiToken = null
  │  ◄───────────────────────────  │
  │  200 { ok: true }              │
  │                               │
  │  Delete token from storage     │
```

---

## API Endpoints

### `POST /auth/register`

**Auth required:** No

**Request body:**

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "hunter2hunter2"
}
```

**Success — 201:**

```json
{
  "token": "a3f8c2d1...",
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-10T12:00:00.000Z"
  }
}
```

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Missing field or invalid format |
| 409 | Username or email already registered |

---

### `POST /auth/login`

**Auth required:** No

**Request body:**

```json
{
  "email": "alice@example.com",
  "password": "hunter2hunter2"
}
```

**Success — 200:** Same shape as register. Token is freshly generated; any previously issued token is now invalid.

**Errors:**

| Status | Condition |
|--------|-----------|
| 400 | Missing field |
| 401 | Invalid email or password |

---

### `POST /auth/logout`

**Auth required:** Yes (`Authorization: Bearer <token>`)

**Success — 200:**

```json
{ "ok": true }
```

After this call, the token is invalid. Any further requests with the same token receive `401`.

---

### `GET /auth/me`

**Auth required:** Yes

**Success — 200:**

```json
{
  "user": {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-10T12:00:00.000Z",
    "updatedAt": "2026-03-10T12:00:00.000Z"
  }
}
```

`passwordHash` and `apiToken` are **never** included in any response from this endpoint or any other.

---

## Middleware

### `authenticate` (global, non-blocking)

Mounted on all routes in `server.ts`. Reads the `Authorization: Bearer <token>` header, looks up the token in the database, and attaches a sanitized `req.user` object if found. Never rejects — routes that require auth call `requireAuth` in addition.

```typescript
// Attaches req.user (without passwordHash or apiToken) or leaves it undefined.
app.use(authenticate);
```

### `requireAuth` (per-route guard)

Rejects with `401 Authentication required.` if `req.user` is not set. Used on any endpoint that requires an authenticated user.

```typescript
router.post('/logout', requireAuth, logout);
router.get('/me',     requireAuth, me);
```

For owner-level authorization (e.g. publishing a package), a further `requireOwner` check will compare `req.user.id` against `Package.ownerId`.

---

## Protected Routes

| Route | Protection |
|-------|-----------|
| `POST /auth/logout` | `requireAuth` |
| `GET /auth/me` | `requireAuth` |
| `POST /packages` *(planned)* | `requireAuth` |
| `POST /packages/:slug/versions` *(planned)* | `requireAuth` + owner check |
| `POST /packages/:slug/versions/:version/yank` *(planned)* | `requireAuth` + owner check |
| `PATCH /packages/:slug` *(planned)* | `requireAuth` + owner check |
| `GET /packages/:slug/analytics` *(planned)* | `requireAuth` + owner check |
| `POST /packages/:slug/reviews` *(planned)* | `requireAuth` |
| `DELETE /packages/:slug/reviews/:id` *(planned)* | `requireAuth` + review author check |

All `GET` endpoints on `/packages` are public and do not require authentication.

---

## CLI Token Storage

The CLI stores the API token in `~/.extensilica/config.toml`:

```toml
registry = "https://api.extensilica.com"
token    = "a3f8c2d1..."
```

The token is read from this file and sent as `Authorization: Bearer <token>` on every authenticated CLI command (`xsil publish`, `xsil logout`, etc.).

The file is created with `0600` permissions (owner read/write only).

---

## What Was Removed

This implementation replaces all previous authentication concepts:

| Removed | Reason |
|---------|--------|
| Wallet-based auth (MetaMask, `viem`, `wagmi`) | Web3 dependency; incompatible with the npmjs-like registry model |
| USDC / flash credit system | Monetization; removed entirely |
| Ed25519 developer certificates | Organization trust chain from v1; not needed for an open registry |
| `developerPublicKey` / `developerCertificate` API fields | Artifacts of the above |
| JWT | Adds complexity (expiry, refresh, key rotation) with no benefit for a registry that needs instant revocation |
| OAuth / external identity providers | Out of scope for v3; can be added later as an optional login method |
