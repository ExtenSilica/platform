import crypto from "crypto";
import { OAuthProvider } from "@prisma/client";
import type { OAuthCanonicalIdentity } from "../oauthUserService";

const USERNAME_RE = /^[a-z0-9_-]{2,32}$/;

/**
 * Google-only: OAuth 2.0 authorization URL for browser redirect.
 */
export function buildGoogleAuthorizeUrl(params: {
  clientId: string;
  callbackUrl: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state: params.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

export async function googleExchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<string | null> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { access_token?: string; error?: string };
  if (data.error || !data.access_token) return null;
  return data.access_token;
}

async function googleFetchUserinfo(accessToken: string): Promise<{
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
} | null> {
  const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!r.ok) return null;
  return r.json() as Promise<{
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  }>;
}

export function buildGoogleUsernameBase(email: string, name: string | null | undefined, sub: string): string {
  const localRaw = email.includes("@") ? email.split("@")[0]! : "";
  let base = localRaw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");

  if (base.length < 2 && name && name.trim()) {
    base = name
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/^[._-]+|[._-]+$/g, "");
  }

  if (base.length < 2 || !USERNAME_RE.test(base)) {
    const h = crypto.createHash("sha256").update(sub).digest("hex").slice(0, 10);
    base = `g${h}`;
  }

  if (base.length > 32) base = base.slice(0, 32);
  if (!USERNAME_RE.test(base)) {
    const h = crypto.createHash("sha256").update(sub).digest("hex").slice(0, 10);
    base = `g${h}`.slice(0, 32);
  }
  return base.slice(0, 32);
}

export type GoogleIdentityResolution = { ok: true; identity: OAuthCanonicalIdentity } | { ok: false; reason: "profile" | "no_email" };

/**
 * Google HTTP + profile normalization → canonical identity for `oauthUserService`.
 */
export async function resolveGoogleCanonicalIdentity(accessToken: string): Promise<GoogleIdentityResolution> {
  const profile = await googleFetchUserinfo(accessToken);
  if (!profile || !profile.sub) {
    return { ok: false, reason: "profile" };
  }

  if (!profile.email || !profile.email.includes("@") || profile.email_verified !== true) {
    return { ok: false, reason: "no_email" };
  }

  const email = profile.email.toLowerCase().trim();
  const providerAccountId = profile.sub;
  const accountLabel = profile.name?.trim() || null;
  const avatarUrl = profile.picture?.trim() || null;
  const usernameBase = buildGoogleUsernameBase(email, accountLabel, providerAccountId);

  const identity: OAuthCanonicalIdentity = {
    provider: OAuthProvider.google,
    providerAccountId,
    email,
    accountLabel,
    avatarUrl,
    usernameBase,
  };
  return { ok: true, identity };
}
