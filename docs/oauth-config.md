# OAuth configuration (backend)

This document describes environment variables and runtime behavior for **GitHub** and **Google** OAuth in the XSIL registry API. Implementation details of routes and token exchange live in [`oauth-v1.md`](./oauth-v1.md); persistence is in [`oauth-data-model.md`](./oauth-data-model.md).

---

## Required environment variables (per provider)

Each provider is **enabled only when all three** variables for that provider are set to non-empty values (after trim). If any variable is missing, that provider is **disabled** and the server starts normally.

### GitHub

| Variable | Purpose |
|----------|---------|
| `GITHUB_CLIENT_ID` | OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret |
| `GITHUB_CALLBACK_URL` | Absolute redirect URI registered in GitHub (must match exactly) |

### GitHub OAuth state cookie

| Variable | Purpose |
|----------|---------|
| `OAUTH_STATE_SECRET` | Secret used to **HMAC-sign** the short-lived `state` cookie for `GET /auth/github/start`. Must be **at least 16 characters** after trim. If GitHub credentials are set but this is missing or too short, GitHub OAuth is treated as **misconfigured**: startup logs a warning and `GET /auth/github/start` returns **503**. |

### Google

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_CALLBACK_URL` | Absolute authorized redirect URI in Google Cloud Console |

### API / app base URLs (already used elsewhere; important for OAuth)

| Variable | Purpose |
|----------|---------|
| `BASE_URL` | Public origin of **this API** (no trailing slash), e.g. `https://api.example.com`. Used for `xsilUrl`, upload URLs, password-reset links, and documented as the canonical API base for building related absolute URLs. |
| `PORT` | HTTP listen port (default `3001`). Fallback when `BASE_URL` is unset: `http://localhost:${PORT}`. |
| `SITE_URL` | Public origin of the **web frontend** (e.g. Next.js), used in emails and for **post–GitHub OAuth** redirects (`/login?oauth_code=…` or `?oauth_error=…`). |

Resolution helper in code: **`getApiBaseUrl()`** in `store-backend/src/config/oauth.ts` (same semantics as existing `BASE_URL` usage in `server.ts` and controllers).

---

## Optional / validation

| Variable | Default | Purpose |
|----------|---------|---------|
| `OAUTH_STRICT_CONFIG` | unset / `false` | If set to `true`, the process **exits on startup** when GitHub or Google is **partially** configured (some of the three vars set but not all). Use in CI or staging to catch typos. When `false` or unset, partial config only logs a **warning** and disables that provider. |

**Missing OAuth entirely:** never causes startup failure.

---

## Callback URL examples

OAuth providers redirect the browser to your **backend** callback path (not the Next.js app), unless you use a reverse-proxy path that still hits the API.

Typical paths (see `oauth-v1.md`):

- `GET /auth/github/callback`
- `GET /auth/google/callback`

### Local development

API on port **3001**:

```env
BASE_URL=http://localhost:3001
SITE_URL=http://localhost:3000
GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback
GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
```

Register the same URLs in:

- **GitHub** → OAuth App → “Authorization callback URL”
- **Google** → OAuth client → “Authorized redirect URIs”

### Production

Use HTTPS and your real API host:

```env
BASE_URL=https://api.extensilica.example
SITE_URL=https://extensilica.example
GITHUB_CALLBACK_URL=https://api.extensilica.example/auth/github/callback
GOOGLE_CALLBACK_URL=https://api.extensilica.example/auth/google/callback
```

If the API is behind a reverse proxy, `BASE_URL` and callback URLs should match what **clients and IdPs** see (public URL), not necessarily the internal bind address.

---

## Runtime behavior

1. On startup, the server logs a non-sensitive summary, e.g.  
   `[oauth] github=off google=off apiBase=http://localhost:3001`
2. **`oauthConfig`** in `store-backend/src/config/oauth.ts` exposes `github` / `google` as either `enabled: false` or `enabled: true` with credentials (for future route handlers).
3. **`isOAuthProviderEnabled()`** / **`getEnabledOAuthProviders()`** gate “GitHub enabled” only when both GitHub app env vars **and** `OAUTH_STATE_SECRET` are valid (`isGithubOAuthReady()`).
4. End-to-end GitHub flow: [`github-oauth-flow.md`](./github-oauth-flow.md).

---

## Copy template

See **`store-backend/.env.example`** for a ready-to-copy block including commented production examples.

---

## Revision history

| Date | Notes |
|------|--------|
| 2026-04-19 | Initial OAuth env and `oauth.ts` documentation |
| 2026-04-19 | `OAUTH_STATE_SECRET`, `SITE_URL` OAuth redirects, `github-oauth-flow.md` link |
