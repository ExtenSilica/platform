# Google OAuth flow (backend)

This document describes the **Google** browser OAuth 2.0 / OpenID Connect flow for the XSIL registry API: routes, `state` handling, account rules (aligned with GitHub), redirects, and error codes.

**Account linking UI** (merging Google with an existing password account) is **not** implemented; behavior matches [`github-oauth-flow.md`](./github-oauth-flow.md) (no silent merge by email).

Related: [`oauth-config.md`](./oauth-config.md), [`oauth-data-model.md`](./oauth-data-model.md), [`oauth-v1.md`](./oauth-v1.md), [`oauth-service-layer.md`](./oauth-service-layer.md), [`github-oauth-flow.md`](./github-oauth-flow.md) (shared `POST /auth/oauth/exchange`).

---

## Prerequisites

1. **Google Cloud** OAuth 2.0 Client (Web application) with **Authorized redirect URI** exactly equal to `GOOGLE_CALLBACK_URL`.
2. **Backend env**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (all three required; otherwise Google OAuth is disabled).
3. **`OAUTH_STATE_SECRET`**: at least **16** characters; signs the Google `state` cookie (same variable as GitHub). If Google credentials are set but the secret is missing/short, `GET /auth/google/start` returns **503** and startup logs `google=misconfigured`.
4. **`SITE_URL`**: frontend origin for post-callback redirects (default `http://localhost:3000`).

Paths are mirrored under **`/auth/...`** and **`/api/auth/...`**.

---

## Endpoints

### `GET /auth/google/start`

1. **503** if Google client env is incomplete or `OAUTH_STATE_SECRET` is invalid.
2. Generates random **`state`** (hex).
3. Sets **HttpOnly** `SameSite=Lax` cookie **`xsil_oauth_google_state`**: HMAC-signed payload binding the browser to `state` (same pattern as GitHub, separate cookie name), via **`oauthStateService`**.
4. **302** to  
   `https://accounts.google.com/o/oauth2/v2/auth`  
   with `client_id`, `redirect_uri`, `response_type=code`, `scope=openid email profile`, and `state`.

The user completes Google sign-in; Google redirects to **`GOOGLE_CALLBACK_URL`** with `code` and `state`.

---

### `GET /auth/google/callback`

- **`code`**, **`state`**: validated like GitHub (cookie + query, timing-safe).
- **`error`**: user denied or other error → redirect to frontend with **`oauth_error=google_denied`** (and related codes below).

**Success path**

1. Exchanges `code` at **`POST https://oauth2.googleapis.com/token`** (`grant_type=authorization_code`).
2. Calls **`GET https://openidconnect.googleapis.com/v1/userinfo`** with the access token.
3. Requires **`email`**, **`email_verified === true`**, and **`sub`** (stable Google subject). Otherwise **`oauth_error=google_no_email`** or profile error.
4. **`OAuthAccount`**: `provider=google`, `providerAccountId=sub`.
5. Same **user rules** as GitHub: existing Google link → sign in and rotate `apiToken`; new Google id with email already on another local user → **`email_exists`**; else **new `User`** + `OAuthAccount`.
6. Issues the same **`apiToken`** as password login, stores a **one-time `oauth_code`**, **302** to  
   `{SITE_URL}/login?oauth_code=…`  
   (see **`POST /auth/oauth/exchange`** in [`github-oauth-flow.md`](./github-oauth-flow.md)).

---

## Stored Google fields (`OAuthAccount`)

| Google (userinfo) | Stored column | Notes |
|-------------------|---------------|--------|
| `email` | `email` | Lowercased; only if `email_verified`. |
| `name` | `username` | Display name snapshot (schema reuses `username` for provider-specific label; GitHub stores `login` here). |
| `picture` | `avatarUrl` | Profile image URL. |

**Local `User.username`:** derived from the **email local-part** when it yields a valid `[a-z0-9_-]{2,32}` base; otherwise from **normalized `name`**; otherwise a deterministic `g` + hash prefix from `sub`. **Uniqueness:** numeric/base36 suffixes on collision (same approach as GitHub).

---

## `oauth_error` codes (Google-specific)

Redirects go to `{SITE_URL}/login?oauth_error=<code>`.

| Code | Meaning |
|------|---------|
| `invalid_state` | Bad or missing `code`/`state`, cookie mismatch, or expired cookie. |
| `google_disabled` | Google OAuth or state signing not available. |
| `google_denied` | Google returned `error` on the callback query string. |
| `google_token_exchange` | Token endpoint failure or invalid response. |
| `google_profile` | Userinfo request failed or missing `sub`. |
| `google_no_email` | Missing email, or **`email_verified` is not true**. |
| `email_exists` | Email already belongs to another user; no silent linking. |
| `server_error` | Unexpected error while persisting or rare unique constraint. |

---

## Revision history

| Date | Notes |
|------|--------|
| 2026-04-19 | Initial Google OAuth backend documentation |
