# GitHub OAuth flow (backend)

This document describes the **GitHub** browser OAuth flow implemented by the XSIL registry API: routes, state handling, user creation rules, redirects, and error codes.

Related: [`oauth-config.md`](./oauth-config.md) (environment variables), [`oauth-data-model.md`](./oauth-data-model.md) (`OAuthAccount` persistence), [`oauth-v1.md`](./oauth-v1.md) (broader OAuth architecture).

---

## Prerequisites

1. **GitHub OAuth App** with callback URL exactly equal to `GITHUB_CALLBACK_URL` (see `oauth-config.md`).
2. **Backend env**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL` (all three required; otherwise GitHub OAuth is disabled).
3. **`OAUTH_STATE_SECRET`**: at least **16** characters, used only to sign the OAuth `state` cookie. Required whenever GitHub credentials are set; without it, `GET /auth/github/start` returns **503** and startup logs `github=misconfigured`.
4. **`SITE_URL`**: public origin of the web app (no trailing slash). Used for redirects after callback (default `http://localhost:3000` if unset).

Mirrored paths: **`/auth/...`** and **`/api/auth/...`** (same handlers).

---

## Endpoints

### `GET /auth/github/start`

1. Returns **503** if GitHub is not fully configured or `OAUTH_STATE_SECRET` is missing/short.
2. Generates a cryptographically random **`state`** nonce (hex).
3. Stores it in an **HttpOnly**, **`SameSite=Lax`** cookie (`xsil_oauth_github_state`) as an **HMAC-signed** payload bound to that nonce and an expiry (~10 minutes). This matches the pattern of keeping sensitive short-lived data **server-side** without a shared session store: verification is cryptographic + cookie binding.
4. Redirects (**302**) to  
   `https://github.com/login/oauth/authorize`  
   with `client_id`, `redirect_uri` (= `GITHUB_CALLBACK_URL`), `scope=read:user user:email`, `state`, and `allow_signup=true`.

The user approves the app on GitHub; GitHub redirects the browser to the callback URL with `code` and `state`.

---

### `GET /auth/github/callback`

Query parameters from GitHub:

- **`code`**: authorization code (required on success).
- **`state`**: must equal the nonce from `/github/start` and match the signed cookie.
- **`error`**: if present (e.g. user denied), the flow stops and the browser is redirected to the frontend with an error code (see below).

**Success path**

1. Validates **`state`** against the cookie (timing-safe). Clears the cookie afterward.
2. **Exchanges `code`** for an access token (`POST https://github.com/login/oauth/access_token`, `Accept: application/json`).
3. Loads the GitHub **`/user`** profile (`id`, `login`, `email`, `avatar_url`).
4. Resolves **email**: uses profile `email` when present; otherwise **`/user/emails`** (primary verified, else any verified).
5. **Account rules** (see next section): find or create `User` + `OAuthAccount`, rotate **`apiToken`** like a normal login (`generateToken` + `user.update`).
6. Creates a **one-time handoff code** (~5 minute TTL, in-memory) mapping to `{ token, user }` (same JSON shape as `POST /auth/login`’s `user` field).
7. Redirects (**302**) to  
   `{SITE_URL}/login?oauth_code=<one-time-code>`  
   so the **API token is never placed in a long-lived URL** as a query param. The SPA reads `oauth_code` once and exchanges it.

**Note:** The token stored in the pending exchange is the same **`apiToken`** field used for Bearer authentication elsewhere.

---

### `POST /auth/oauth/exchange`

Completes the browser handoff after the callback redirect.

- **Body (JSON):** `{ "code": "<oauth_code from query>" }`
- **Success:** `{ "token": "<apiToken>", "user": { ... } }` — same as `POST /auth/login`.
- **Errors:** `400` if code missing, invalid, or expired.

Rate-limited per IP (see `store-backend/src/routes/auth.ts`).

---

## User creation and linking

| Condition | Behavior |
|-----------|----------|
| `OAuthAccount` exists for `(provider=github, providerAccountId=GitHub numeric id)` | **Sign in**: refresh `apiToken`, update stored GitHub snapshot fields on `OAuthAccount`, optional `avatarUrl` fill on `User` if empty. |
| No `OAuthAccount`, but a **`User` already exists with the same email** | **Do not** attach or merge. Redirect with **`oauth_error=email_exists`**. A human must use password login or an explicit account-linking flow (not implemented here). |
| No `OAuthAccount`, email not taken | **Create** a new `User` (random bcrypt `passwordHash` for OAuth-only accounts) and a linked **`OAuthAccount`** row. |

**Username:** derived from GitHub `login` (normalized to `[a-z0-9_-]{2,32}`); on collision, suffixes are applied; if still unsafe, a `gh`-prefixed random suffix is used.

**Stored GitHub fields on `OAuthAccount`:** `email`, `username` (GitHub login), `avatarUrl` when available.

---

## Frontend redirects and `oauth_error` codes

On failure, the API redirects to:

`{SITE_URL}/login?oauth_error=<code>`

| Code | Meaning |
|------|---------|
| `invalid_state` | Missing/bad `code`, tampered `state`, expired cookie, or cookie/state mismatch. |
| `github_disabled` | GitHub OAuth or state signing not configured. |
| `github_denied` | GitHub returned an `error` query param (e.g. access denied). |
| `github_token_exchange` | Token endpoint error or non-JSON / missing `access_token`. |
| `github_profile` | `GET /user` failed or returned unusable data. |
| `github_no_email` | No verified email could be resolved (profile + `/user/emails`). |
| `email_exists` | Email already registered to another local user; no silent linking. |
| `server_error` | Unexpected persistence or internal error. |

The login page should display a short message based on `oauth_error` and clear the query string after reading it.

---

## Security notes

- **State:** bound to the browser via signed cookie + query param; CSRF risk on callback is mitigated because the token exchange requires the secret cookie issued on `/github/start`.
- **No silent email linking** avoids takeover when IdP email is reassigned or wrong.
- **One-time `oauth_code`:** prevents leaking a long-lived session token via `Referer` or server logs on the frontend URL (the code is useless after exchange and expires quickly).

---

## Revision history

| Date | Notes |
|------|--------|
| 2026-04-19 | Document GitHub OAuth routes and behavior |
