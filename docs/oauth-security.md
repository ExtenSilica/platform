# OAuth security and account provisioning

This document records **account-linking policy**, **threats avoided**, **runtime checks** in the registry API, and a **planned safe linking** model. It complements [`oauth-data-model.md`](./oauth-data-model.md), [`github-oauth-flow.md`](./github-oauth-flow.md), [`google-oauth-flow.md`](./google-oauth-flow.md), and [`oauth-service-layer.md`](./oauth-service-layer.md).

---

## Account linking policy (enforced today)

1. **Lookup key** is always **`(provider, providerAccountId)`** — e.g. GitHub numeric id or Google `sub`. That pair is **unique** in `OAuthAccount` (see Prisma schema).

2. **If that `OAuthAccount` row already exists** → **sign in** the linked `User`: rotate `apiToken`, refresh OAuth snapshot fields (`email`, label, `avatarUrl` on `OAuthAccount`). No email-based merge is involved because the row already binds the IdP identity.

3. **If no `OAuthAccount` exists for this IdP identity**:
   - If a **`User` row already exists with the same email** → **reject** with **`oauth_error=email_exists`**.  
     **We do not** attach the new OAuth identity to that user based on email alone.
   - Otherwise → **create a new `User`** and a new **`OAuthAccount`** in one transaction, with **re-checks inside the transaction** for:
     - another request having created the same **`OAuthAccount`** (race → treat as returning user and rotate token),
     - another request having registered the same **email** (race → `email_exists`).

4. **Malformed IdP claims** (invalid email shape, empty `providerAccountId`, control characters, etc.) are rejected **before** DB access with **`oauth_error=oauth_invalid_profile`** (mapped from `invalid_identity` in `signInOrRegisterOAuthUser`).

**Safe auto-linking is not used** when the only signal is “OAuth email equals existing `User.email`”. That rule is intentional (see below).

---

## Why email-only silent linking is risky

| Risk | Explanation |
|------|-------------|
| **Pre-registered email** | Victim registers with `alice@company.com` (password). Attacker creates a GitHub account also named `alice@company.com` (or takes over a disposable IdP mailbox). Silent linking would let the attacker **log in as the victim** without the password. |
| **Mailbox churn** | A recycled email address at a provider could point to a **new human**; IdP “verified email” does not prove it is the **same** person as an existing local account. |
| **Operator confusion** | Merging two identities without explicit user intent makes **audit, support, and GDPR erasure** harder. |

Therefore the product rule is: **same email + no existing `(provider, providerAccountId)` → block (`email_exists`)**, unless a **future** explicit linking flow runs (below).

---

## Other mitigations (callbacks, replay, collisions)

| Topic | Mitigation |
|-------|------------|
| **OAuth `state`** | Signed, short-lived cookie bound to the browser (`oauthStateService`). |
| **Authorization `code` replay** | Handled by the IdP (codes are short-lived, often single-use). |
| **Browser handoff `oauth_code`** | **Single-use** in-memory store (`oauthPendingExchange`); second `POST /auth/oauth/exchange` fails. Covered by tests in `store-backend/test/oauthPendingExchange.replay.test.ts`. |
| **`providerAccountId` collision** | Enforced by **DB unique** on `(provider, providerAccountId)`; transaction + `P2002` handling falls back to “existing OAuth” path when another tab wins the race. |
| **Username collision** | `allocateUniqueUsername` probes `User.username` and adds deterministic suffixes; see `store-backend/test/oauthAllocateUsername.test.ts`. |

---

## Future: explicit, safe provider linking

**Goal:** Let a user who already has a **password `User`** attach GitHub/Google **without** email-only inference.

**Sketch (not implemented):**

1. User is **authenticated** with the existing session (Bearer token).
2. User starts OAuth with a **cryptographically random `link_nonce`** stored server-side or in a signed cookie, scoped to their **current `userId`**.
3. Callback validates `state` / nonce, exchanges code, resolves IdP identity.
4. Server **requires** `link_nonce` → `userId` binding and **does not** create a new user; it creates **`OAuthAccount`** for that `userId` only after user confirms (or in one atomic step if the nonce proves intent).
5. **Optional:** require password re-entry or MFA before attaching a second IdP.

Document any UI as **`/settings/connected-accounts`** (or similar) when implemented.

---

## Tests and validation code

| Area | Location |
|------|----------|
| Identity shape / injection hardening | `store-backend/src/services/oauthIdentityValidation.ts` — `validateAndNormalizeOAuthIdentity` |
| Provisioning + races | `store-backend/src/services/oauthUserService.ts` — `signInOrRegisterOAuthUser` |
| Vitest | `npm run test` in `store-backend`; files under `store-backend/test/` |

---

## Revision history

| Date | Notes |
|------|--------|
| 2026-04-19 | Initial `oauth-security.md`: policy, risks, tests |
