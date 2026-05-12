import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { User } from '@prisma/client';
import { prisma } from '../db';

// Augment Express Request so downstream handlers have typed access to req.user
// and the ApiToken row that authenticated the call (needed for per-token logout).
declare global {
  namespace Express {
    interface Request {
      /** Public session user — no secrets or email-verification internals. */
      user?: Omit<
        User,
        | 'passwordHash'
        | 'emailVerificationTokenHash'
        | 'emailVerificationExpires'
      >;
      /** id of the ApiToken row that authenticated this request, if any. */
      apiTokenId?: number;
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/** Lowercase hex SHA-256 — matches the column stored on `ApiToken.tokenHash`. */
export function hashApiToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Optionally resolves the authenticated user from the Bearer token.
 * Never rejects — downstream handlers decide whether auth is required.
 *
 * Lookup is by `sha256(rawToken)` against the `ApiToken` table. Revoked rows
 * (`revokedAt IS NOT NULL`) are rejected. On a hit we attach the user and the
 * token row id to the request and fire-and-forget bump `lastUsedAt` so the
 * dashboard "Last used" column stays meaningful without blocking the call.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  if (token) {
    try {
      const tokenHash = hashApiToken(token);
      const tokenRow = await prisma.apiToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (tokenRow && tokenRow.revokedAt === null) {
        const {
          passwordHash: _ph,
          emailVerificationTokenHash: _vh,
          emailVerificationExpires: _ve,
          ...safeUser
        } = tokenRow.user;
        req.user = safeUser;
        req.apiTokenId = tokenRow.id;

        // Fire-and-forget — never block the request on bookkeeping.
        prisma.apiToken
          .update({ where: { id: tokenRow.id }, data: { lastUsedAt: new Date() } })
          .catch((err) => {
            console.error('[auth] failed to bump ApiToken.lastUsedAt:', err);
          });
      }
    } catch {
      // Token lookup failure is non-fatal; req.user stays undefined.
    }
  }
  next();
}

/**
 * Rejects the request with 401 if no valid Bearer token was supplied.
 * Must be used after the `authenticate` middleware.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  next();
}
