import { Request, Response, NextFunction } from 'express';
import { User } from '@prisma/client';
import { prisma } from '../db';

// Augment Express Request so downstream handlers have typed access to req.user.
declare global {
  namespace Express {
    interface Request {
      /** Public session user — no secrets or email-verification internals. */
      user?: Omit<
        User,
        | 'passwordHash'
        | 'apiToken'
        | 'emailVerificationTokenHash'
        | 'emailVerificationExpires'
      >;
    }
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Optionally resolves the authenticated user from the Bearer token.
 * Never rejects — downstream handlers decide whether auth is required.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearer(req);
  if (token) {
    try {
      const user = await prisma.user.findUnique({ where: { apiToken: token } });
      if (user) {
        const {
          passwordHash: _ph,
          apiToken: _at,
          emailVerificationTokenHash: _vh,
          emailVerificationExpires: _ve,
          ...safeUser
        } = user;
        req.user = safeUser;
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
