# OAuth launch readiness checklist

Use this before enabling GitHub / Google sign-in in a new environment (staging or production). Canonical variable names and examples live in [`oauth-config.md`](./oauth-config.md); security and account rules in [`oauth-security.md`](./oauth-security.md).

---

## IdP applications

- [ ] **GitHub OAuth credentials created** — GitHub → Settings → Developer settings → OAuth Apps (or GitHub App with OAuth credentials). Note **Client ID** and generate a **Client secret**.
- [ ] **Google OAuth credentials created** — Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web application). Note **Client ID** and **Client secret**.

---

## Callback URLs (dev and prod)

Register **exact** redirect URIs with each provider (scheme, host, path, no trailing slash unless required).

| Environment | GitHub “Authorization callback URL” | Google “Authorized redirect URIs” |
|-------------|-------------------------------------|-------------------------------------|
| **Local** | Must match `GITHUB_CALLBACK_URL`, e.g. `http://localhost:3001/auth/github/callback` | Same host/path pattern for Google, e.g. `http://localhost:3001/auth/google/callback` |
| **Production** | HTTPS API host, e.g. `https://<api-host>/auth/github/callback` | Same for `.../auth/google/callback` |

- [ ] **Dev** — Callbacks registered and match `GITHUB_CALLBACK_URL` / `GOOGLE_CALLBACK_URL` in local `.env`.
- [ ] **Prod** — Production HTTPS callbacks registered; env vars match what IdPs and users see (respect reverse proxies: public URL, not internal bind).
- [ ] **`SITE_URL`** — Points at the **store** origin (e.g. `https://store.example.com`); used for success/error redirects to `/auth/callback` and `/auth/error`.

---

## Security and state

- [ ] **`OAUTH_STATE_SECRET`** — Set in every environment where OAuth is on; **≥ 16 characters** (see [`oauth-config.md`](./oauth-config.md)). Unique per environment; rotate if leaked.
- [ ] **State validation verified** — Happy path: start → IdP → callback completes. Negative: wrong or missing `state` / cookie → redirect to **`/auth/error?oauth_error=invalid_state`** (no session created). Optional: expired cookie after ~10 minutes.

---

## Core product flows

- [ ] **Local sign-in still works** — `POST /auth/login` with email + password; web login form and token returned as before.
- [ ] **CLI auth still works** — `xsil login` obtains a token; authenticated registry calls use `Authorization: Bearer`. See [`cli-auth-v2.md`](./cli-auth-v2.md).
- [ ] **`GET /auth/me` after OAuth** — Complete browser OAuth, exchange `oauth_code`, then call `/auth/me` with the returned Bearer token; expect `200` and a valid `user` (and optional `oauthProviders` summary if implemented).

---

## Frontend and errors

- [ ] **Error pages tested** — Open `/auth/error?oauth_error=invalid_state` (and other `oauth_error` values; see `store-frontend/lib/oauth-callback-messages.ts` and [`frontend-oauth-ui.md`](./frontend-oauth-ui.md)) and confirm copy and navigation (e.g. back to login) are acceptable.
- [ ] **Success path** — `/auth/callback` with a valid one-time code stores token and lands in dashboard (or `?next=`).

---

## Duplicate account and edge cases

Manual or scripted checks (automated coverage: [`oauth-test-plan.md`](./oauth-test-plan.md)):

- [ ] **Existing OAuth user** — Second sign-in with same IdP account signs in (token rotates); no duplicate `User`.
- [ ] **Email already registered (password user)** — OAuth with same email as existing local user → **`oauth_error=email_exists`** (no silent merge); user sees mapped error on `/auth/error`.
- [ ] **Race / duplicate `providerAccountId`** — Covered by backend tests (`P2002` path); optional smoke: two parallel first-time sign-ins for same IdP identity should still yield one account.

---

## Production environment variables

Document the following in your **internal** runbook or secrets manager (values **never** in git):

| Variable | Production notes |
|----------|------------------|
| `GITHUB_CLIENT_ID` | From GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | Secret; rotate via GitHub UI if compromised |
| `GITHUB_CALLBACK_URL` | HTTPS, must match GitHub app setting exactly |
| `GOOGLE_CLIENT_ID` | From Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | Secret; rotate in GCP if compromised |
| `GOOGLE_CALLBACK_URL` | HTTPS, must match Google client URIs exactly |
| `OAUTH_STATE_SECRET` | Long random string; unique per env |
| `SITE_URL` | Public store origin (HTTPS) |
| `BASE_URL` | Public API origin (HTTPS), used with callbacks and links |
| `OAUTH_STRICT_CONFIG` | Optional: set `true` in prod/staging CI to fail fast on partial provider config |

- [ ] **Production env vars documented** — Above table copied or linked in team docs; staging and prod secrets provisioned separately.

---

## Optional hardening

- [ ] **`OAUTH_STRICT_CONFIG=true`** in deployment config where you want startup to **exit** if any provider is half-configured.
- [ ] **Automated tests** — `cd store-backend && npm run test` (includes OAuth flow mocks per [`oauth-test-plan.md`](./oauth-test-plan.md)).

---

## Sign-off

| Role | Name | Date |
|------|------|------|
| Owner | | |
