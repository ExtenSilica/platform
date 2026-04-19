# OAuth service layer (backend)

This document describes the **refactored** OAuth architecture in `store-backend`: how responsibilities are split between **`oauthStateService`**, **`oauthUserService`**, **`oauthService`**, thin HTTP **controllers**, and **provider-specific HTTP** modules. It complements [`oauth-config.md`](./oauth-config.md), [`github-oauth-flow.md`](./github-oauth-flow.md), and [`google-oauth-flow.md`](./google-oauth-flow.md).

---

## Goals

- **One place** for rules that must stay consistent across IdPs (state handling shape, user provisioning, token rotation, redirect URLs).
- **Isolated** GitHub vs Google HTTP (URLs, headers, JSON shapes, extra calls like GitHub `/user/emails`).
- **Thin controllers** that only: validate config, orchestrate calls, map provider failures to `oauth_error` codes, and send HTTP responses.

---

## Module map

| Module | Path | Role |
|--------|------|------|
| **`oauthStateService`** | `store-backend/src/services/oauthStateService.ts` | Cryptographic **`state`** nonce generation, HMAC-signed **HttpOnly** cookies (`github` \| `google` cookie names), verification against the query string, clearing cookies. Uses **`OAUTH_STATE_SECRET`**. |
| **`oauthUserService`** | `store-backend/src/services/oauthUserService.ts` | **Provider-neutral** persistence: `OAuthCanonicalIdentity` → find or create `User` + `OAuthAccount`, **email collision** policy (no silent link), **`allocateUniqueUsername`**, random OAuth-only **`passwordHash`**, **`generateToken`** rotation, Prisma **`P2002`** handling. |
| **`oauthService`** | `store-backend/src/services/oauthService.ts` | **Browser UX glue**: `SITE_URL` resolution, **login redirect URLs** (`oauth_error` / `oauth_code`), **`createOAuthBrowserHandoff`** (wraps in-memory one-time exchange), **`POST /auth/oauth/exchange`** handler. |
| **Controllers** | `store-backend/src/controllers/oauthGithubController.ts`, `oauthGoogleController.ts` | Wire Express **`req`/`res`**, call state + provider HTTP + `oauthUserService` + `oauthService`; map errors to the correct **`oauth_error`** query values. |
| **Provider HTTP** | `store-backend/src/services/providers/githubOAuthHttp.ts`, `googleOAuthHttp.ts` | **Only** outbound `fetch` to GitHub/Google, token exchange, profile retrieval/normalization into **`OAuthCanonicalIdentity`**. |

Supporting pieces unchanged in role: **`oauthPendingExchange`** (one-time codes), **`config/oauth.ts`** (env resolution; **`isGithubOAuthReady` / `isGoogleOAuthReady`** use **`isOAuthStateSecretConfigured()`**).

---

## Service boundaries (who owns what)

### `oauthStateService` (transport-adjacent, IdP-agnostic signing)

- Owns **cookie name** per provider (`github` \| `google`) so two parallel OAuth flows do not overwrite each other’s `state`.
- Owns **signing and expiry** of the payload bound to the browser; does **not** know about GitHub scopes or Google `userinfo`.
- **Does not** touch the database or issue API tokens.

**Why separate:** state handling is security-sensitive and identical in structure for every browser-based OAuth provider you add; keeping it out of controllers avoids copy-paste HMAC/cookie bugs.

### `oauthUserService` (domain / persistence)

- Input: **`OAuthCanonicalIdentity`** — already normalized email, stable **`providerAccountId`**, display snapshot, avatar, and a **`usernameBase`** for local username allocation.
- Output: **`{ ok, user }`** or **`{ ok: false, error }`** — no redirects, no `fetch`.
- Encodes **product rules** shared by GitHub and Google: same linking policy, same token semantics as password login (`generateToken` + `user.update`).

**Why separate:** when you change “what happens when email already exists?” or how usernames collide, you change **one** module instead of hunting through two controllers and risking one-sided fixes.

### `oauthService` (frontend contract)

- Centralizes **`SITE_URL`**, `/login` paths, and query param names so marketing or SPA route changes do not scatter string literals.
- Owns the **browser handoff** (`oauth_code`) and the **JSON exchange** endpoint behavior.

**Why separate:** redirect and exchange are not GitHub- or Google-specific; a third provider would reuse them unchanged.

### Provider HTTP modules (IdP-specific)

- **`githubOAuthHttp`**: GitHub authorize URL builder, access token exchange, `/user` + `/user/emails`, mapping to **`OAuthCanonicalIdentity`** + GitHub-specific **`buildGithubUsernameBase`**.
- **`googleOAuthHttp`**: Google authorize URL, token endpoint, OIDC **`userinfo`**, **`email_verified`** rules, **`buildGoogleUsernameBase`**.

**Why separate:** IdPs differ in JSON field names, secondary HTTP calls, and trust rules (e.g. Google verified email). Keeping that out of **`oauthUserService`** prevents Prisma logic from being entangled with “what does GitHub return this quarter?”.

### Controllers (orchestration only)

- Order of operations: config gate → set/clear state cookie → exchange `code` → resolve identity → **`signInOrRegisterOAuthUser`** → handoff redirect.
- **Provider-specific** only in the **error code strings** (`github_token_exchange` vs `google_token_exchange`, etc.).

---

## Provider-specific vs provider-neutral logic

| Concern | Provider-specific | Provider-neutral |
|---------|-------------------|------------------|
| Authorization & token HTTP | `githubOAuthHttp`, `googleOAuthHttp` | — |
| Profile / email normalization → `OAuthCanonicalIdentity` | Same modules | Type **`OAuthCanonicalIdentity`** is shared |
| `state` cookie signing | Cookie **name** keyed by provider enum; crypto **algorithm** shared | `oauthStateService` |
| User exists? Email taken? | — | `oauthUserService` |
| `User.username` uniqueness algorithm | **`usernameBase`** built per provider | **`allocateUniqueUsername`** |
| `apiToken` issuance | — | `generateToken` via **`oauthUserService`** |
| Redirect to `/auth/callback` / `/auth/error` | — | **`oauthService`** (`SITE_URL`) |

---

## Why this reduces maintenance risk

1. **Single source of truth** for security-sensitive and policy-sensitive code (`oauthStateService`, `oauthUserService`). Adding a provider does not duplicate those blocks.
2. **Clear failure ownership**: HTTP failures are localized to provider modules; persistence failures to **`oauthUserService`**; redirect/contract issues to **`oauthService`**.
3. **Safer evolution**: GitHub API changes touch **`githubOAuthHttp`** only; a new rule like “require MFA claim” stays out of Prisma code until normalized into **`OAuthCanonicalIdentity`**.
4. **Testability** (future): provider modules can be unit-tested with mocked `fetch`; **`oauthUserService`** can be tested against an in-memory DB without HTTP.

---

## Revision history

| Date | Notes |
|------|--------|
| 2026-04-19 | Introduce `oauthStateService`, `oauthUserService`, `oauthService`, provider HTTP split |
