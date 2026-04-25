import { Request, Response, NextFunction } from 'express';
import { isPlatformAdminUser } from '../lib/platformAdmin';

/**
 * Requires `authenticate` + `requireAuth` before this middleware.
 */
export function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (!isPlatformAdminUser(req.user)) {
    res.status(403).json({ error: 'Platform admin access required.' });
    return;
  }
  next();
}
