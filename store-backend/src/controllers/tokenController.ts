import type { Request, Response } from 'express';
import { claimApprovedTokens } from '../lib/tokenClaim';
import { getTokenBalanceForUser, TokenGrantError } from '../lib/tokenGrants';

function handleTokenError(res: Response, err: unknown): void {
  if (err instanceof TokenGrantError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('[token]', err);
  res.status(500).json({ error: 'Token operation failed.' });
}

/** GET /auth/me/token-balance */
export async function getMyTokenBalance(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const data = await getTokenBalanceForUser(req.user.id);
  res.json(data);
}

/** POST /auth/me/token-claim */
export async function postMyTokenClaim(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  try {
    const result = await claimApprovedTokens(req.user.id);
    res.json(result);
  } catch (err) {
    handleTokenError(res, err);
  }
}
