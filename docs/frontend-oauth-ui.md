# Frontend OAuth UI (store)

This document describes how the **Next.js store** exposes GitHub and Google sign-in, how it talks to the **registry API**, and how the **post-login handoff** works.

Related backend docs: [`github-oauth-flow.md`](./github-oauth-flow.md), [`google-oauth-flow.md`](./google-oauth-flow.md), [`oauth-service-layer.md`](./oauth-service-layer.md).

---

## User-visible behavior

### Login (`/login`)

- Users can **sign in with email and password** (unchanged) or use **Continue with GitHub** / **Continue with Google**.
- SSO buttons use a **full browser navigation** to the registry **`GET /auth/{github|google}/start`** so the API can set the short-lived **signed `state` cookie** on the API origin (required for CSRF-safe OAuth).
- After IdP success, the registry redirects to **`{SITE_URL}/auth/callback?oauth_code=…`**; on failure, to **`{SITE_URL}/auth/error?oauth_error=…`** (see [`frontend-auth-callback.md`](./frontend-auth-callback.md)).
  - **`/auth/callback`** exchanges `oauth_code`, calls **`GET /auth/me`**, then **`login()`** (same **`localStorage`** / context as password login) and redirects to the dashboard or saved **`?next=`** path.
  - **`/auth/error`** maps `oauth_error` using `store-frontend/lib/oauth-callback-messages.ts`.

### Register (`/register`)

- Same **Continue with GitHub / Google** entry points appear **below** the registration form.
- OAuth is **optional**; the username/email/password flow remains primary.

---

## Configuration

| Variable | Role |
|----------|------|
| **`NEXT_PUBLIC_API_URL`** | Must match how the rest of the app calls the API (see `store-frontend/lib/api.ts`). The value may end with **`/api`** (e.g. `http://localhost:3001/api`); the client strips a trailing `/api` to obtain the **registry origin** used for **`/auth/github/start`**, **`/auth/oauth/exchange`**, etc. |

If this URL is wrong, SSO links point at the wrong host or OAuth exchange fails.

---

## Implementation map

| Piece | Location |
|-------|----------|
| Registry origin helper | **`getRegistryOrigin()`** in `store-frontend/lib/api.ts` |
| OAuth code exchange | **`apiOAuthExchange()`** in `store-frontend/lib/api.ts` |
| SSO buttons + divider | **`OauthEntryBlock`** in `store-frontend/components/oauth-entry-buttons.tsx` |
| `oauth_error` copy | **`oauthCallbackErrorMessage()`** in `store-frontend/lib/oauth-callback-messages.ts` |
| OAuth callback / error routes | **`store-frontend/app/auth/callback/page.tsx`**, **`store-frontend/app/auth/error/page.tsx`** |
| Post-login path (`?next=`) | **`store-frontend/lib/post-login-redirect.ts`** |

---

## Styling and accessibility

- **GitHub**: dark/neutral button (`zinc-900` / light zinc in dark mode) with Lucide **`Github`** icon; sufficient contrast in light and dark themes.
- **Google**: `outline`-style button (`border-input`, `bg-background`) plus an inline **SVG “G”** (brand colors) for recognition; hover uses **`muted`** so it stays native in both themes.
- Links are real **`<a href>`** elements (not client-side `router.push`) so behavior matches “open IdP in the same top-level navigation” expectations and cookies stay on the API host.

---

## Why full-page navigation to `/auth/*/start`

The registry binds **`state`** to the browser with an **HttpOnly** cookie on the **API origin**. A client-side fetch from the Next.js origin would not carry that cookie setup the same way as a top-level GET to the API. Therefore the UI uses **direct navigation** to the backend start URLs.

---

## Revision history

| Date | Notes |
|------|--------|
| 2026-04-19 | Initial frontend OAuth UI documentation |
