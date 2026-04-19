import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import { sanitizeUser } from "../controllers/authController";
import { createPendingExchange, consumePendingExchange } from "../lib/oauthPendingExchange";

function trimEnv(key: string): string | undefined {
  const v = process.env[key];
  if (v === undefined || v === null) return undefined;
  const t = String(v).trim();
  return t.length ? t : undefined;
}

/** Public frontend origin (no trailing slash). */
export function getOAuthSiteUrl(): string {
  return (trimEnv("SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function buildOAuthLoginErrorRedirectUrl(oauthErrorCode: string): string {
  const u = new URL("/login", getOAuthSiteUrl());
  u.searchParams.set("oauth_error", oauthErrorCode);
  return u.toString();
}

export function buildOAuthLoginSuccessRedirectUrl(oauthHandoffCode: string): string {
  const u = new URL("/login", getOAuthSiteUrl());
  u.searchParams.set("oauth_code", oauthHandoffCode);
  return u.toString();
}

export function redirectOAuthLoginError(res: Response, oauthErrorCode: string): void {
  res.redirect(302, buildOAuthLoginErrorRedirectUrl(oauthErrorCode));
}

export function redirectOAuthLoginSuccess(res: Response, oauthHandoffCode: string): void {
  res.redirect(302, buildOAuthLoginSuccessRedirectUrl(oauthHandoffCode));
}

/** One-time browser handoff code (query param); exchange via POST /auth/oauth/exchange. */
export function createOAuthBrowserHandoff(apiToken: string, user: User): string {
  return createPendingExchange(apiToken, sanitizeUser(user));
}

/**
 * POST /auth/oauth/exchange — provider-agnostic completion of browser OAuth.
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
