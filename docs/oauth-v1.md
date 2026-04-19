# OAuth v1 — GitHub & Google (design)

**Status:** design only — implementation follows in a later phase.  
**Scope:** GitHub OAuth + Google OAuth for the web app; email/password and CLI API tokens unchanged.

---

## 1. Goals

- **Reduce friction** for web signup and login by offering one-click **Continue with GitHub** and **Continue with Google**.
- **Support GitHub and Google** as the only OAuth providers in this phase (both use standard authorization-code flow with server-side callbacks).
- **Preserve current email/password authentication** end-to-end: `POST /auth/register`, `POST /auth/login`, validation rules, and existing login/register UI remain first-class; OAuth is additive.
- **Preserve the current CLI / API token model**: a single long-lived **API token** per user (`User.apiToken`) used as `Authorization: Bearer <token>`; OAuth must not replace or break token-based access for the CLI, `xsil`, or other API clients.
- **Preserve logout semantics**: `POST /auth/logout` continues to invalidate the current token; OAuth login must integrate with the same token lifecycle (see §8).

---

## 2. Non-goals

- **No LinkedIn OAuth** (or other providers) in this phase.
- **No enterprise SSO** (SAML, OIDC enterprise IdPs, SCIM, etc.).
- **No browser-based OAuth flow for the CLI** in this phase — the CLI continues to use **API tokens** (create/revoke via web or future documented flows), not OAuth redirects in the terminal.
- **No automatic “link OAuth to existing account by email”** in v1 unless a separate, explicit, and safely reviewed linking flow is specified (see §5).
- **No removal** of password reset / forgot-password flows where they exist today.

---

## 3. User flows

### 3.1 New user signs in with GitHub (first time)

1. User clicks **Continue with GitHub** on login or register page.
2. Browser navigates to **`GET /auth/github/start`** (or `/api/auth/github/start` — same handler; see §6).
3. Server redirects to GitHub authorization URL with `client_id`, `redirect_uri`, `scope`, and **`state`** (cryptographically random, stored server-side or signed cookie).
4. User approves on GitHub; GitHub redirects to **`GET /auth/github/callback?code=…&state=…`**.
5. Server validates `state`, exchanges `code` for access token, fetches GitHub user profile (`id`, email if scope allows, avatar URL, login/username).
6. Server finds **no** `OAuthAccount` for `(provider=github, providerAccountId=<github id>)` → treat as **signup path**:
   - Create `User` (username derived from GitHub login with collision rules; email from verified GitHub primary email when available, else placeholder policy documented in implementation).
   - Create `OAuthAccount` row linked to `userId`.
   - Generate **`apiToken`** the same way as email registration (`generateToken()`), persist on `User`.
7. Server responds in a way the web client can treat **identically to email login**: e.g. redirect to frontend callback URL with **short-lived one-time code** in query **or** JSON for SPA — final choice in implementation — but end state must be: frontend holds **same** `{ token, user }` as `POST /auth/login` and calls existing `login(token, user)` / `localStorage` behavior.

### 3.2 New user signs in with Google (first time)

Same as §3.1 with provider `google`, Google’s userinfo endpoint, and stable **`sub`** as `providerAccountId`.

### 3.3 Existing email/password user links OAuth later (**future — not v1**)

- **Out of scope for this phase.** Documented here only so we **do not** implement unsafe auto-linking by email in v1.
- Future design: explicit “Link GitHub” from account settings, re-authenticate password or session, then bind `OAuthAccount` to current `userId` with audit trail.

### 3.4 Existing OAuth user signs in again

1. User clicks **Continue with GitHub** or **Continue with Google**.
2. After callback, server finds existing **`OAuthAccount`** for `(provider, providerAccountId)`.
3. Load linked **`User`**, issue a **new** `apiToken` (same policy as password login: rotate on login), return `{ token, user }` to frontend — **same** post-auth behavior as `POST /auth/login`.

### 3.5 Web user creates API token / uses existing token for CLI

- Unchanged product story: user is authenticated on the web; dashboard (or future settings) exposes **token** or “regenerate token” consistent with today’s model.
- **OAuth does not change** how the CLI authenticates: still **`Authorization: Bearer <apiToken>`**.
- Optional later: separate “personal access tokens” table; **out of scope** for OAuth v1 unless already planned elsewhere.

---

## 4. Data model changes

Introduce an **`OAuthAccount`** (or equivalent) table, **many rows per user** allowed if we add more providers later, but **unique per (provider, providerAccountId)**.

| Column | Type | Notes |
|--------|------|--------|
| `id` | PK | |
| `userId` | FK → `User` | CASCADE or restrict per product rules |
| `provider` | enum/string | `github` \| `google` |
| `providerAccountId` | string | GitHub numeric `id` as string, or Google `sub` |
| `email` | string? nullable | Snapshot from provider when available (helps support/debug; **not** sole source of truth for uniqueness) |
| `avatarUrl` | string? nullable | Snapshot from provider |
| `createdAt` / `updatedAt` | timestamps | |

**`User` table**

- Keep **`passwordHash`** nullable for OAuth-only users **or** require a random unusable hash — implementation choice; email/password users keep non-null hash.
- **`email`** remains required for app invariants; policy for OAuth-only email (verified provider email vs internal placeholder) must be documented and aligned with uniqueness rules (§5).
- **`apiToken`** unchanged: still the bearer secret for API + web session storage after login.

**Indexes / constraints**

- **Unique:** `(provider, providerAccountId)`.
- **Index:** `userId` for listing linked accounts (future).

---

## 5. Security concerns

### 5.1 OAuth `state` parameter

- Generate **high-entropy** `state` per authorization request.
- **Validate** on callback: reject missing/invalid `state` (CSRF protection).
- Prefer **server-side session** (encrypted cookie or Redis) or **signed, time-limited** state payload; do not accept raw client-supplied state as proof.

### 5.2 Callback validation

- **HTTPS only** for redirect URIs in production.
- Validate **`code`** once; handle provider error query params (`error`, `error_description`).
- **Time limits** on state / code verifier if using PKCE (recommended for public clients; for confidential server-only flow, still validate redirect URI and client secret).

### 5.3 Email uniqueness rules

- Today: unique `User.email` (case-normalized).
- OAuth may return an email already used by a **password** account. **Do not auto-merge** in v1 unless product explicitly approves a safe linking UX.
- Safe v1 behavior: if new OAuth user’s email conflicts with an existing user **without** a confirmed link flow → **reject signup** with clear message (“An account with this email already exists — sign in with email and password, or use account linking when available”) **or** create user with a non-conflicting internal email — **pick one strategy** in implementation review; default recommendation: **block** and force email/password path to avoid duplicate identity.

### 5.4 Account takeover prevention

- Trust **providerAccountId** (GitHub `id`, Google `sub`) as the stable identifier, not display name.
- Never set session from OAuth response **without** verifying `state` and token exchange server-side.
- Rate-limit **`/auth/*/start`** and **`/auth/*/callback`** (reuse patterns from `loginLimiter` where appropriate).

### 5.5 No auto-linking by email (v1)

- **Do not** attach OAuth identity to an existing user **only** because emails match — vulnerable to IdP email change / collision unless verified with password or magic link.
- Document future “explicit link” flow (§3.3).

---

## 6. API routes

Mount consistently with existing auth routes: **`/auth`** and **`/api/auth`** (mirror), unless we intentionally deprecate one later.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/auth/github/start` | Begin GitHub OAuth; redirect to provider |
| `GET` | `/auth/github/callback` | GitHub redirect; exchange code; create/update user; establish session |
| `GET` | `/auth/google/start` | Begin Google OAuth; redirect to provider |
| `GET` | `/auth/google/callback` | Google redirect; exchange code; create/update user; establish session |

**Implementation notes**

- `start` handlers: set cookie / session state, redirect to provider.
- `callback` handlers: validate, exchange, upsert user + `OAuthAccount`, rotate `apiToken`, then **redirect** to frontend with one-time code or set **httpOnly** session — **if** the product moves to httpOnly cookies later; **minimal v1** alignment with current app: return/redirect so client obtains **`apiToken`** same as login (see §8).
- Register routes in `store-backend/src/routes/auth.ts` (or dedicated `oauth.ts` included from `server.ts`).

---

## 7. Frontend changes

- **Login page** and **Register page**: add primary-style secondary actions:
  - **Continue with GitHub**
  - **Continue with Google**
- Keep **email / password** fields and submit buttons **visible** (no OAuth-only gate).
- Styling: match existing design system (buttons, spacing); optional divider “or continue with email”.
- Flow: user clicks OAuth → full navigation to backend `start` URL → provider → callback → backend redirects to **`/login?oauth=success&code=…`** (example) or dedicated **`/auth/callback`** page that reads one-time code, exchanges for `{ token, user }`, calls **`AuthContext.login(token, user)`** — exact URL scheme in implementation plan.
- **Do not** remove or hide forgot-password / register links.

---

## 8. Session / token behavior

**Current behavior (must remain)**

- Successful **email login**: server generates new **`apiToken`**, stores on `User`, returns `{ token, user }`; frontend stores token (e.g. `localStorage` key `xsil_token`) and uses `Authorization: Bearer` for API calls.
- **`GET /auth/me`**: resolves user from bearer token.
- **Logout**: invalidates token server-side; client clears storage.

**OAuth success (v1 requirement)**

- After successful OAuth callback, server behavior must mirror **login**:
  - Set **`User.apiToken`** to a newly generated token (rotate on OAuth sign-in, same as password login).
  - Return **`sanitizeUser(user)`** + token to the client through the chosen redirect/handshake.
- Frontend must land in the **same authenticated state** as today: **`login(token, user)`** equivalent, so **no parallel session system** for OAuth-only users in v1.

**CLI**

- Users continue to copy **`apiToken`** (or future PAT) for `xsil` / API; OAuth is **web entry only** for this phase.

---

## 9. Environment & configuration (checklist for implementation)

- GitHub: OAuth App **Client ID**, **Client Secret**, callback URL registered.
- Google: Cloud Console OAuth **Client ID**, **Client Secret**, authorized redirect URIs.
- Server env vars (names illustrative): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `OAUTH_STATE_SECRET` (or reuse app signing secret), `FRONTEND_OAUTH_REDIRECT_BASE`.

---

## 10. Open questions (resolve before coding)

1. **Username** for OAuth-only users: GitHub `login` only, or allow user to pick on first OAuth signup?
2. **Email missing** from GitHub (private email): fallback policy vs require Google for email-bearing signups.
3. **Callback → frontend** transport: one-time code vs fragment vs dedicated API `POST` from small callback page.
4. **Prisma migration** naming and whether `passwordHash` is nullable for OAuth-only users.

---

## Revision history

| Date | Author | Notes |
|------|--------|--------|
| (this doc) | — | Initial OAuth v1 architecture for GitHub + Google |
