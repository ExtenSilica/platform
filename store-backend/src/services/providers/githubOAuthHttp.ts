import { OAuthProvider } from "@prisma/client";
import type { OAuthCanonicalIdentity } from "../oauthUserService";

/**
 * GitHub-only: authorization URL for browser redirect.
 */
export function buildGithubAuthorizeUrl(params: {
  clientId: string;
  callbackUrl: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.callbackUrl,
    scope: "read:user user:email",
    state: params.state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${q.toString()}`;
}

export async function githubExchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string | null> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const r = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { access_token?: string; error?: string };
  if (data.error || !data.access_token) return null;
  return data.access_token;
}

async function githubFetchUser(accessToken: string): Promise<{
  id: number;
  login: string;
  email: string | null;
  avatar_url: string | null;
} | null> {
  const r = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ExtenSilica-OAuth",
    },
  });
  if (!r.ok) return null;
  return r.json() as Promise<{
    id: number;
    login: string;
    email: string | null;
    avatar_url: string | null;
  }>;
}

async function githubFetchPrimaryEmail(accessToken: string): Promise<string | null> {
  const r = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ExtenSilica-OAuth",
    },
  });
  if (!r.ok) return null;
  const list = (await r.json()) as { email?: string; primary?: boolean; verified?: boolean }[];
  if (!Array.isArray(list)) return null;
  const primary = list.find((e) => e.primary && e.verified && e.email);
  if (primary?.email) return primary.email.toLowerCase();
  const anyVerified = list.find((e) => e.verified && e.email);
  return anyVerified?.email ? anyVerified.email.toLowerCase() : null;
}

const USERNAME_RE = /^[a-z0-9_-]{2,32}$/;

export function buildGithubUsernameBase(login: string, providerAccountId: string): string {
  let base = login
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
  if (base.length < 2) base = `gh${providerAccountId}`;
  if (base.length > 32) base = base.slice(0, 32);
  if (!USERNAME_RE.test(base)) base = `gh${providerAccountId}`.slice(0, 32);
  return base.slice(0, 32);
}

export type GithubIdentityResolution = { ok: true; identity: OAuthCanonicalIdentity } | { ok: false; reason: "profile" | "no_email" };

/**
 * GitHub HTTP + profile normalization → canonical identity for `oauthUserService`.
 */
export async function resolveGithubCanonicalIdentity(accessToken: string): Promise<GithubIdentityResolution> {
  const profile = await githubFetchUser(accessToken);
  if (!profile) {
    return { ok: false, reason: "profile" };
  }

  const providerAccountId = String(profile.id);
  let email =
    profile.email && profile.email.includes("@") ? profile.email.toLowerCase().trim() : null;
  if (!email) {
    email = await githubFetchPrimaryEmail(accessToken);
  }
  if (!email) {
    return { ok: false, reason: "no_email" };
  }

  const usernameBase = buildGithubUsernameBase(profile.login, providerAccountId);

  const identity: OAuthCanonicalIdentity = {
    provider: OAuthProvider.github,
    providerAccountId,
    email,
    accountLabel: profile.login,
    avatarUrl: profile.avatar_url ?? null,
    usernameBase,
  };
  return { ok: true, identity };
}
