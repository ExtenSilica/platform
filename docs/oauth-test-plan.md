# OAuth backend test plan

Automated tests exercise GitHub and Google OAuth **without** calling real identity providers. Provider HTTP is stubbed with `global.fetch`, persistence with a Prisma `vi.mock("../src/db")`, and `generateToken` / `sanitizeUser` from `authController` are stubbed so token issuance stays deterministic.

## How to run

From `store-backend`:

```bash
npm run test
```

Vitest loads `test/setup-oauth-env.ts` first so `oauthConfig` enables both providers using dummy client IDs/secrets and a fixed `OAUTH_STATE_SECRET`. The suite `test/oauthProviderFlows.test.ts` runs in the `forks` pool to isolate the Prisma mock from other tests.

## Coverage map

| # | Requirement | GitHub test | Google test |
|---|-------------|-------------|-------------|
| 1 | Start endpoint returns redirect (authorize URL + state cookie) | `start returns 302 redirect to GitHub authorize URL` | `start returns 302 to Google authorization URL` |
| 2 | Callback with invalid state fails | `callback with invalid state redirects to auth error` | `callback invalid state fails` |
| 3 | Callback with valid mocked provider creates user | `callback with valid mocked provider creates user and issues handoff (api token)` | `callback creates user and passes api token to handoff` |
| 4 | Callback signs in existing OAuth account | `callback signs in existing OAuth account and rotates token` | `callback signs in existing Google OAuth user` |
| 5 | Duplicate `providerAccountId` rejected or reused | `providerAccountId race: P2002 on OAuthAccount create resolves as existing sign-in` (create throws P2002; second `findUnique` returns link → sign-in + handoff) | (same logic path via shared `signInOrRegisterOAuthUser`; GitHub case proves P2002 handling) |
| 6 | Username collisions resolved safely | `username collision: allocateUniqueUsername suffix before create` (`user.findUnique` reports `octocat` taken; assert created username is suffixed) | — |
| 7 | Auth token issued after successful OAuth | Assert `createPendingExchange` receives the post-login `apiToken` (new user: deterministic stub; existing: value returned by mocked `user.update`) | Same for Google create and existing sign-in |

## Out of scope for this suite

- Browser-only behavior (e.g. cookie `Secure` / `SameSite` in production).
- Real TLS, DNS, or provider rate limits.
- Frontend `/auth/callback` and `/auth/error` rendering (covered separately if desired).

## Adding scenarios

1. Extend the `fetch` stub with URL branches matching `githubOAuthHttp` / `googleOAuthHttp`.
2. Queue `prismaMock` return values to match the Prisma calls inside `signInOrRegisterOAuthUser` and the OAuth controllers.
3. Spy on `createPendingExchange` in `oauthPendingExchange` when asserting handoff tokens and sanitized user payloads.
