import crypto from 'crypto';
import type { ApiToken } from '@prisma/client';
import { prisma } from '../db';
import { hashApiToken } from '../middleware/auth';

/** Max characters in `ApiToken.name`. The DB column is TEXT so this is purely a UX cap. */
export const MAX_TOKEN_NAME_LEN = 80;

/** Per-user soft cap on live (non-revoked) tokens to deter accidental abuse. */
export const MAX_LIVE_TOKENS_PER_USER = 50;

/** Public shape returned by GET /auth/me/tokens — never includes `tokenHash`. */
export interface PublicApiToken {
  id: number;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** Generate a fresh 64-char hex token. Cryptographically random, suitable as a credential. */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Derive a default token name from a request's User-Agent header. We don't try
 * to be exhaustive — just produce something more useful than "Web session".
 */
export function webSessionNameFromUserAgent(userAgent: string | undefined): string {
  if (!userAgent) return 'Web session';
  const ua = userAgent.toLowerCase();
  // Order matters: Edge UA also contains "chrome", Chrome UA also contains "safari".
  let browser = 'browser';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('chrome/')) browser = 'Chrome';
  else if (ua.includes('safari/')) browser = 'Safari';

  let os = '';
  if (ua.includes('windows nt')) os = 'Windows';
  else if (ua.includes('mac os x') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'iOS';

  return os ? `Web session — ${browser} on ${os}` : `Web session — ${browser}`;
}

/** Validate + trim a user-supplied token name; returns the canonical name or null on error. */
export function normalizeTokenName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'name must be a string.' };
  }
  const trimmed = raw.trim();
  if (trimmed.length < 1) {
    return { ok: false, error: 'name must not be empty.' };
  }
  if (trimmed.length > MAX_TOKEN_NAME_LEN) {
    return { ok: false, error: `name must be ${MAX_TOKEN_NAME_LEN} characters or fewer.` };
  }
  return { ok: true, name: trimmed };
}

/** Format an ApiToken row for the public API (never leaks the hash). */
export function publicApiToken(row: ApiToken): PublicApiToken {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

/**
 * Create a fresh ApiToken row for `userId`. Returns the raw token (shown ONCE
 * to the caller; the DB only keeps the hash) plus the persisted row.
 */
export async function createApiToken(params: {
  userId: number;
  name: string;
}): Promise<{ rawToken: string; row: ApiToken }> {
  const rawToken = generateRawToken();
  const tokenHash = hashApiToken(rawToken);
  const row = await prisma.apiToken.create({
    data: {
      userId: params.userId,
      name: params.name,
      tokenHash,
    },
  });
  return { rawToken, row };
}

/** Mark a single ApiToken as revoked. Idempotent — revoking an already-revoked row is a no-op. */
export async function revokeApiTokenById(id: number): Promise<void> {
  await prisma.apiToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Mark all of a user's live tokens as revoked. Used by the password-reset and
 * admin-reset flows: if the credential was compromised, every existing session
 * must die. Returns the number of rows affected.
 */
export async function revokeAllUserTokens(userId: number): Promise<number> {
  const result = await prisma.apiToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** Count of currently-live tokens for a user. Used to enforce MAX_LIVE_TOKENS_PER_USER. */
export async function countLiveTokensForUser(userId: number): Promise<number> {
  return prisma.apiToken.count({ where: { userId, revokedAt: null } });
}
