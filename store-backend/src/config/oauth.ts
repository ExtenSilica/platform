/**
 * OAuth (GitHub / Google) configuration.
 * Missing variables disable a provider; the process never exits for absent OAuth unless
 * OAUTH_STRICT_CONFIG=true and a provider is only partially configured.
 */

import { isGithubOAuthStateConfigured } from "../lib/githubOAuthState";

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === null) return undefined;
  const t = String(v).trim();
  return t.length ? t : undefined;
}

/** Public API origin (no trailing slash). Used for xsil URLs and OAuth-adjacent absolute links. */
export function getApiBaseUrl(): string {
  const raw = trimEnv("BASE_URL") ?? `http://localhost:${trimEnv("PORT") ?? "3001"}`;
  return raw.replace(/\/+$/, "");
}

export type OAuthProviderId = "github" | "google";

export type OAuthProviderRuntime =
  | {
      provider: OAuthProviderId;
      enabled: true;
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    }
  | { provider: OAuthProviderId; enabled: false };

export interface OAuthAppConfig {
  /** Same resolution as upload URLs and password-reset links — see docs/oauth-config.md */
  apiBaseUrl: string;
  github: OAuthProviderRuntime;
  google: OAuthProviderRuntime;
}

function resolveProvider(
  provider: OAuthProviderId,
  idKey: string,
  secretKey: string,
  callbackKey: string,
): OAuthProviderRuntime {
  const clientId = trimEnv(idKey);
  const clientSecret = trimEnv(secretKey);
  const callbackUrl = trimEnv(callbackKey);
  const present = [clientId, clientSecret, callbackUrl].filter(Boolean).length;
  if (present === 3) {
    return {
      provider,
      enabled: true,
      clientId: clientId!,
      clientSecret: clientSecret!,
      callbackUrl: callbackUrl!,
    };
  }
  if (present > 0) {
    console.warn(
      `[oauth] ${provider} is partially configured (set all of ${idKey}, ${secretKey}, ${callbackKey} or leave all unset). Provider disabled.`,
    );
  }
  return { provider, enabled: false };
}

function buildOAuthConfig(): OAuthAppConfig {
  const strict = (trimEnv("OAUTH_STRICT_CONFIG") ?? "").toLowerCase() === "true";

  const github = resolveProvider("github", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_CALLBACK_URL");
  const google = resolveProvider("google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL");

  if (strict) {
    const partialGithub =
      [trimEnv("GITHUB_CLIENT_ID"), trimEnv("GITHUB_CLIENT_SECRET"), trimEnv("GITHUB_CALLBACK_URL")].some(
        Boolean,
      ) && !github.enabled;
    const partialGoogle =
      [trimEnv("GOOGLE_CLIENT_ID"), trimEnv("GOOGLE_CLIENT_SECRET"), trimEnv("GOOGLE_CALLBACK_URL")].some(
        Boolean,
      ) && !google.enabled;
    if (partialGithub || partialGoogle) {
      console.error(
        "[oauth] OAUTH_STRICT_CONFIG=true but one or more providers are only partially set. Fix .env or unset incomplete provider variables.",
      );
      process.exit(1);
    }
  }

  return {
    apiBaseUrl: getApiBaseUrl(),
    github,
    google,
  };
}

/** Resolved once at module load (import `dotenv/config` before this module in `server.ts`). */
export const oauthConfig: OAuthAppConfig = buildOAuthConfig();

/** GitHub OAuth App vars set and state-signing secret configured (required for /auth/github/start). */
export function isGithubOAuthReady(): boolean {
  return oauthConfig.github.enabled && isGithubOAuthStateConfigured();
}

export function isOAuthProviderEnabled(provider: OAuthProviderId): boolean {
  if (provider === "github") return isGithubOAuthReady();
  return oauthConfig.google.enabled;
}

export function getEnabledOAuthProviders(): OAuthProviderId[] {
  const out: OAuthProviderId[] = [];
  if (isGithubOAuthReady()) out.push("github");
  if (oauthConfig.google.enabled) out.push("google");
  return out;
}

/** Startup log line (non-sensitive). */
export function logOAuthStartupSummary(): void {
  const gh =
    !oauthConfig.github.enabled ? "off" : isGithubOAuthStateConfigured() ? "on" : "misconfigured";
  const o = oauthConfig.google.enabled ? "on" : "off";
  console.log(`[oauth] github=${gh} google=${o} apiBase=${oauthConfig.apiBaseUrl}`);
  if (oauthConfig.github.enabled && !isGithubOAuthStateConfigured()) {
    console.warn(
      "[oauth] GitHub credentials are set but OAUTH_STATE_SECRET is missing or too short; /auth/github/start will return 503 until fixed.",
    );
  }
}
