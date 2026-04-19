import { Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { OAuthProvider, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { oauthConfig } from "../config/oauth";
import { generateToken, sanitizeUser } from "./authController";
import {
  setGithubOAuthStateCookie,
  clearGithubOAuthStateCookie,
  verifyGithubOAuthState,
  isGithubOAuthStateConfigured,
} from "../lib/githubOAuthState";
import { createPendingExchange, consumePendingExchange } from "../lib/oauthPendingExchange";

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

async function githubExchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ access_token: string } | null> {
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
  return { access_token: data.access_token };
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

function normalizeGithubUsername(login: string, numericId: string): string {
  let base = login
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");
  if (base.length < 2) base = `gh${numericId}`;
  if (base.length > 32) base = base.slice(0, 32);
  if (!USERNAME_RE.test(base)) base = `gh${numericId}`.slice(0, 32);
  return base.slice(0, 32);
}

async function allocateUniqueUsername(base: string): Promise<string> {
  let candidate = base;
  if (!USERNAME_RE.test(candidate)) {
    candidate = `gh${crypto.randomBytes(4).toString("hex")}`.slice(0, 32);
  }
  for (let i = 0; i < 64; i++) {
    const tryName =
      i === 0
        ? candidate
        : `${candidate.replace(/-+$/, "").slice(0, 24)}-${i.toString(36)}`.slice(0, 32);
    const exists = await prisma.user.findUnique({ where: { username: tryName } });
    if (!exists) return tryName;
  }
  return `gh${crypto.randomBytes(8).toString("hex")}`.slice(0, 32);
}

async function randomUnusedPasswordHash(): Promise<string> {
  const raw = crypto.randomBytes(32).toString("hex");
  return bcrypt.hash(raw, BCRYPT_ROUNDS);
}

/**
 * GET /auth/github/start
 */
export async function githubOAuthStart(req: Request, res: Response): Promise<void> {
  const gh = oauthConfig.github;
  if (!gh.enabled) {
    res.status(503).json({ error: "GitHub OAuth is not configured." });
    return;
  }
  if (!isGithubOAuthStateConfigured()) {
    res.status(503).json({
      error: "GitHub OAuth state signing is not configured. Set OAUTH_STATE_SECRET (min 16 characters).",
    });
    return;
  }

  const state = crypto.randomBytes(24).toString("hex");
  try {
    setGithubOAuthStateCookie(res, state);
  } catch (e) {
    console.error("[oauth/github/start] cookie", e);
    res.status(500).json({ error: "OAuth initialization failed." });
    return;
  }

  const params = new URLSearchParams({
    client_id: gh.clientId,
    redirect_uri: gh.callbackUrl,
    scope: "read:user user:email",
    state,
    allow_signup: "true",
  });
  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
  res.redirect(302, url);
}

/**
 * GET /auth/github/callback
 */
export async function githubOAuthCallback(req: Request, res: Response): Promise<void> {
  const gh = oauthConfig.github;
  if (!gh.enabled || !isGithubOAuthStateConfigured()) {
    clearGithubOAuthStateCookie(res);
    redirectError(res, "github_disabled");
    return;
  }

  const err = typeof req.query.error === "string" ? req.query.error : undefined;
  if (err) {
    clearGithubOAuthStateCookie(res);
    redirectError(res, "github_denied");
    return;
  }

  const code = typeof req.query.code === "string" ? req.query.code.trim() : "";
  if (!code || !verifyGithubOAuthState(req)) {
    clearGithubOAuthStateCookie(res);
    redirectError(res, "invalid_state");
    return;
  }

  clearGithubOAuthStateCookie(res);

  let tokenResp: { access_token: string } | null;
  try {
    tokenResp = await githubExchangeCode(code, gh.clientId, gh.clientSecret, gh.callbackUrl);
  } catch (e) {
    console.error("[oauth/github/callback] token exchange", e);
    redirectError(res, "github_token_exchange");
    return;
  }
  if (!tokenResp) {
    redirectError(res, "github_token_exchange");
    return;
  }

  let profile: {
    id: number;
    login: string;
    email: string | null;
    avatar_url: string | null;
  } | null;
  try {
    profile = await githubFetchUser(tokenResp.access_token);
  } catch (e) {
    console.error("[oauth/github/callback] profile", e);
    redirectError(res, "github_profile");
    return;
  }
  if (!profile) {
    redirectError(res, "github_profile");
    return;
  }

  const providerAccountId = String(profile.id);
  let email =
    profile.email && profile.email.includes("@") ? profile.email.toLowerCase().trim() : null;
  if (!email) {
    try {
      email = await githubFetchPrimaryEmail(tokenResp.access_token);
    } catch (e) {
      console.error("[oauth/github/callback] emails", e);
      redirectError(res, "github_no_email");
      return;
    }
  }
  if (!email) {
    redirectError(res, "github_no_email");
    return;
  }

  const snapshotUsername = profile.login;
  const snapshotAvatar = profile.avatar_url ?? null;

  try {
    const existingLink = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: OAuthProvider.github,
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

      const baseUser = normalizeGithubUsername(profile.login, providerAccountId);
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
            provider: OAuthProvider.github,
            providerAccountId,
            email,
            username: snapshotUsername,
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
            provider: OAuthProvider.github,
            providerAccountId,
          },
        },
        data: {
          email,
          username: snapshotUsername,
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
    console.error("[oauth/github/callback] persist", e);
    redirectError(res, "server_error");
  }
}

/**
 * POST /auth/oauth/exchange
 * Body: { code } — one-time code from ?oauth_code= after GitHub redirect.
 */
export async function oauthBrowserExchange(req: Request, res: Response): Promise<void> {
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!code) {
    res.status(400).json({ error: "code is required." });
    return;
  }
  const row = consumePendingExchange(code);
  if (!row) {
    res.status(400).json({ error: "Invalid or expired OAuth code." });
    return;
  }
  res.json({ token: row.token, user: row.user });
}
