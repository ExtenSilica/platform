/**
 * Loaded before any test modules so `oauthConfig` resolves GitHub/Google as enabled
 * for OAuth flow tests (no live IdP calls — `fetch` is stubbed in those tests).
 */
process.env.GITHUB_CLIENT_ID = "vitest_github_client";
process.env.GITHUB_CLIENT_SECRET = "vitest_github_secret";
process.env.GITHUB_CALLBACK_URL = "http://127.0.0.1:3999/auth/github/callback";
process.env.GOOGLE_CLIENT_ID = "vitest_google_client";
process.env.GOOGLE_CLIENT_SECRET = "vitest_google_secret";
process.env.GOOGLE_CALLBACK_URL = "http://127.0.0.1:3999/auth/google/callback";
process.env.OAUTH_STATE_SECRET = "0123456789abcdef0123456789abcdef";
process.env.SITE_URL = "http://127.0.0.1:3000";

export {};
