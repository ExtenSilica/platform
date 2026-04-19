import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { OAuthProvider, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { oauthConfig } from "../config/oauth";
import { generateToken, sanitizeUser } from "./authController";
import {
  setGoogleOAuthStateCookie,
  clearGoogleOAuthStateCookie,
  verifyGoogleOAuthState,
  isGoogleOAuthStateConfigured,
} from "../lib/googleOAuthState";
import { createPendingExchange } from "../lib/oauthPendingExchange";

const BCRYPT_ROUNDS = 12;
const USERNAME_RE = /^[a-z0-9_-]{2,32}$/;

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === null) return undefined;
  const t = String(v).trim();
  return t.length ? t : undefined;
}

function siteUrl(): string {
  return (trimEnv("SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}

function redirectError(res: Response, code: string): void {
  const u = new URL("/login", siteUrl());
  u.searchParams.set("oauth_error", code);
  res.redirect(302, u.toString());
}

async function googleExchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ access_token: string } | null> {
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
  return { access_token: data.access_token };
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

/** Normalize local-part or display name into a username base (before uniqueness suffixes). */
function normalizeGoogleUsernameBase(email: string, name: string | null | undefined, sub: string): string {
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

async function allocateUniqueUsername(base: string): Promise<string> {
  let candidate = base;
  if (!USERNAME_RE.test(candidate)) {
    candidate = `g${crypto.randomBytes(4).toString("hex")}`.slice(0, 32);
  }
  for (let i = 0; i < 64; i++) {
    const tryName =
      i === 0
        ? candidate
        : `${candidate.replace(/-+$/, "").slice(0, 24)}-${i.toString(36)}`.slice(0, 32);
    const exists = await prisma.user.findUnique({ where: { username: tryName } });
    if (!exists) return tryName;
  }
  return `g${crypto.randomBytes(8).toString("hex")}`.slice(0, 32);
}

async function randomUnusedPasswordHash(): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  return bcrypt.hash(raw, BCRYPT_ROUNDS);
}

/**
 * GET /auth/google/start
 */
export async function googleOAuthStart(_req: Request, res: Response): Promise<void> {
  const g = oauthConfig.google;
  if (!g.enabled) {
    res.status(503).json({ error: "Google OAuth is not configured." });
    return;
  }
  if (!isGoogleOAuthStateConfigured()) {
    res.status(503).json({
      error: "Google OAuth state signing is not configured. Set OAUTH_STATE_SECRET (min 16 characters).",
    });
    return;
  }

  const state = crypto.randomBytes(24).toString("hex");
  try {
    setGoogleOAuthStateCookie(res, state);
  } catch (e) {
    console.error("[oauth/google/start] cookie", e);
    res.status(500).json({ error: "OAuth initialization failed." });
    return;
  }

  const params = new URLSearchParams({
    client_id: g.clientId,
    redirect_uri: g.callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state,
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(302, url);
}

/**
 * GET /auth/google/callback
 */
export async function googleOAuthCallback(req: Request, res: Response): Promise<void> {
  const g = oauthConfig.google;
  if (!g.enabled || !isGoogleOAuthStateConfigured()) {
    clearGoogleOAuthStateCookie(res);
    redirectError(res, "google_disabled");
    return;
  }

  const err = typeof req.query.error === "string" ? req.query.error : undefined;
  if (err) {
    clearGoogleOAuthStateCookie(res);
    redirectError(res, "google_denied");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  if (!code || !verifyGoogleOAuthState(req)) {
    clearGoogleOAuthStateCookie(res);
    redirectError(res, "invalid_state");
    return;
  }

  clearGoogleOAuthStateCookie(res);

  let tokenResp: { access_token: string } | null;
  try {
    tokenResp = await googleExchangeCode(code, g.clientId, g.clientSecret, g.callbackUrl);
  } catch (e) {
    console.error("[oauth/google/callback] token exchange", e);
    redirectError(res, "google_token_exchange");
    return;
  }
  if (!tokenResp) {
    redirectError(res, "google_token_exchange");
    return;
  }

  let profile: {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  } | null;
  try {
    profile = await googleFetchUserinfo(tokenResp.access_token);
  } catch (e) {
    console.error("[oauth/google/callback] userinfo", e);
    redirectError(res, "google_profile");
    return;
  }
  if (!profile || !profile.sub) {
    redirectError(res, "google_profile");
    return;
  }

  if (!profile.email || !profile.email.includes("@")) {
    redirectError(res, "google_no_email");
    return;
  }
  if (profile.email_verified !== true) {
    redirectError(res, "google_no_email");
    return;
  }

  const email = profile.email.toLowerCase().trim();
  const providerAccountId = profile.sub;
  const snapshotName = profile.name?.trim() || null;
  const snapshotAvatar = profile.picture?.trim() || null;

  try {
    const existingLink = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: OAuthProvider.google,
          providerAccountId,
        },
      },
      include: { user: true },
    });

    let user = existingLink?.user ?? null;

    if (!user) {
      const emailOwner = await prisma.user.findUnique({ where: { email } });
      if (emailOwner) {
        redirectError(res, "email_exists");
        return;
      }

      const baseUser = normalizeGoogleUsernameBase(email, snapshotName, providerAccountId);
      const username = await allocateUniqueUsername(baseUser);
      const passwordHash = await randomUnusedPasswordHash();
      const apiToken = generateToken();

      const created = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            username,
            email,
            passwordHash,
            apiToken,
            avatarUrl: snapshotAvatar,
          },
        });
        await tx.oAuthAccount.create({
          data: {
            userId: u.id,
            provider: OAuthProvider.google,
            providerAccountId,
            email,
            username: snapshotName,
            avatarUrl: snapshotAvatar,
          },
        });
        return u;
      });
      user = created;
    } else {
      const apiToken = generateToken();
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          apiToken,
          avatarUrl: user.avatarUrl ?? snapshotAvatar ?? undefined,
        },
      });
      await prisma.oAuthAccount.update({
        where: {
          provider_providerAccountId: {
            provider: OAuthProvider.google,
            providerAccountId,
          },
        },
        data: {
          email,
          username: snapshotName ?? undefined,
          avatarUrl: snapshotAvatar ?? undefined,
        },
      });
    }

    const apiToken = user.apiToken!;
    const handoff = createPendingExchange(apiToken, sanitizeUser(user));
    const u = new URL("/login", siteUrl());
    u.searchParams.set("oauth_code", handoff);
    res.redirect(302, u.toString());
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = (e.meta?.target as string[] | undefined) ?? [];
      redirectError(res, target.includes("email") ? "email_exists" : "server_error");
      return;
    }
    console.error("[oauth/google/callback] persist", e);
    redirectError(res, "server_error");
  }
}
