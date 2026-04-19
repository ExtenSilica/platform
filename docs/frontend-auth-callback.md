# Frontend OAuth callback and post-login redirect

This document describes how the **Next.js store** completes OAuth after the **registry API** redirects the browser back from GitHub or Google: dedicated routes, **`localStorage`** token handling (same as email/password login), **`GET /auth/me`**, and optional **return navigation**.

Related: [`frontend-oauth-ui.md`](./frontend-oauth-ui.md), [`github-oauth-flow.md`](./github-oauth-flow.md), [`google-oauth-flow.md`](./google-oauth-flow.md), [`oauth-service-layer.md`](./oauth-service-layer.md), [`oauth-security.md`](./oauth-security.md).

---

## Registry redirect targets (`SITE_URL`)

After the IdP callback, the API issues a one-time handoff code and redirects:

| Outcome | Browser URL |
|---------|-------------|
| Success | **`{SITE_URL}/auth/callback?oauth_code=<one-time-code>`** |
| Failure | **`{SITE_URL}/auth/error?oauth_error=<code>`** |

These paths are built in **`store-backend/src/services/oauthService.ts`** (`buildOAuthLoginSuccessRedirectUrl` / `buildOAuthLoginErrorRedirectUrl`).

---

## `/auth/callback` (success path)

**File:** `store-frontend/app/auth/callback/page.tsx`

1. Reads **`oauth_code`** from the query string (wrapped in **`Suspense`** for `useSearchParams`).
2. **`POST {registry}/auth/oauth/exchange`** with `{ "code": "<oauth_code>" }` → `{ token, user }` (same as password login response shape).
3. Calls **`GET {registry}/auth/me`** with **`Authorization: Bearer <token>`** and uses that profile as the source of truth. If **`/auth/me`** fails, the handoff is treated as invalid (token not stored).
4. On success: **`login(token, user)`** from **`AuthProvider`** — this writes **`xsil_token`** to **`localStorage`** and updates React state (identical to **`apiLogin`** success path).
5. **Redirect:** **`consumePostLoginRedirect()`** (see below), defaulting to **`/dashboard`**.

**Strict mode / abort:** the exchange and **`/auth/me`** requests share an **`AbortSignal`** so React 18 Strict Mode teardown does not leave stale state updates.

If **`oauth_code`** is missing or any step fails, the page shows an error and a link back to **`/login`**.

---

## `/auth/error` (failure path)

**File:** `store-frontend/app/auth/error/page.tsx`

1. Reads **`oauth_error`** from the query string.
2. Maps codes to user-facing copy via **`oauthCallbackErrorMessage()`** in `store-frontend/lib/oauth-callback-messages.ts` (covers provider denied, invalid state, email exists, backend errors, missing email, etc.).
3. Presents actions: **Back to sign in** (`/login`) and **Create an account** (`/register`).

No token is written; no **`/auth/me`** call.

---

## Post-login redirect (`?next=` and sessionStorage)

**Module:** `store-frontend/lib/post-login-redirect.ts`

- **`setPostLoginRedirect(path)`** — stores an **internal path** in **`sessionStorage`** (`xsil_post_login_redirect`) if the path is safe (must start with `/`, not `//`, no `://`).
- **`consumePostLoginRedirect()`** — returns the stored path and **removes** the key, or **`/dashboard`** if unset/invalid.

**When it is set**

- **`/login?next=/some/path`** — on mount, the login page copies **`next`** into **`sessionStorage`** and strips the query from the address bar.
- The same pattern applies to **`/register?next=...`** for password registration.

**When it is consumed**

- After successful **password** login on **`/login`**.
- After successful **password** registration on **`/register`**.
- After successful **OAuth** completion on **`/auth/callback`**.

**OAuth + `next`:** If the user opens **`/login?next=/publish/new`** and then uses **Continue with GitHub**, the **`next`** value is already in **`sessionStorage`** before the browser leaves for the API — when they return to **`/auth/callback`**, completion still runs **`consumePostLoginRedirect()`** and lands on **`/publish/new`**.

---

## Consistency with email/password auth

| Concern | Mechanism |
|---------|-----------|
| Token storage | **`localStorage.setItem("xsil_token", token)`** inside **`login()`** in `store-frontend/lib/auth.tsx` |
| User profile | OAuth path prefers **`GET /auth/me`** after exchange so the client matches server state; then **`login(token, me)`**. |
| API helper | **`apiFetchMe()`** in `store-frontend/lib/api.ts` (optional **`AbortSignal`**) |

The **`/login`** page no longer processes **`oauth_code`** / **`oauth_error`**; those flows are isolated under **`/auth/*`**.

---

## Revision history

| Date | Notes |
|------|--------|
| 2026-04-19 | `/auth/callback`, `/auth/error`, `apiFetchMe`, post-login redirect |
