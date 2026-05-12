import { Request, Response } from 'express';
import { prisma } from '../db';
import {
  countLiveTokensForUser,
  createApiToken,
  MAX_LIVE_TOKENS_PER_USER,
  normalizeTokenName,
  publicApiToken,
  revokeApiTokenById,
} from '../lib/apiTokens';

/**
 * GET /auth/me/tokens
 * Requires: Authorization: Bearer <token>
 * Returns every ApiToken belonging to the authenticated user — live AND
 * revoked, ordered newest first. The raw token is never returned (the DB only
 * keeps the hash); callers must save the value at creation time.
 */
export async function listMyTokens(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  try {
    const rows = await prisma.apiToken.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
    });
    res.json({
      tokens: rows.map(publicApiToken),
    });
  } catch (err) {
    console.error('[auth/me/tokens] list', err);
    res.status(500).json({ error: 'Failed to list tokens.' });
  }
}

/**
 * POST /auth/me/tokens
 * Requires: Authorization: Bearer <token>
 * Body: { name: string }  — 1–80 chars, human-readable label.
 * Returns: { token, apiToken } — `token` is the raw 64-char hex, shown ONCE.
 *
 * Enforces a soft cap (MAX_LIVE_TOKENS_PER_USER) on live tokens per user.
 */
export async function createMyToken(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { name: nameRaw } = (req.body ?? {}) as { name?: unknown };

  const normalized = normalizeTokenName(nameRaw);
  if (!normalized.ok) {
    res.status(400).json({ error: normalized.error });
    return;
  }

  try {
    const live = await countLiveTokensForUser(userId);
    if (live >= MAX_LIVE_TOKENS_PER_USER) {
      res.status(409).json({
        error: `You already have ${live} live tokens (limit: ${MAX_LIVE_TOKENS_PER_USER}). Revoke unused ones before creating new tokens.`,
      });
      return;
    }

    const { rawToken, row } = await createApiToken({ userId, name: normalized.name });
    res.status(201).json({
      token: rawToken,
      apiToken: publicApiToken(row),
    });
  } catch (err) {
    console.error('[auth/me/tokens] create', err);
    res.status(500).json({ error: 'Failed to create token.' });
  }
}

/**
 * DELETE /auth/me/tokens/:id
 * Requires: Authorization: Bearer <token>
 * Revokes a single token owned by the authenticated user. Idempotent — revoking
 * an already-revoked or non-existent token returns 404 / 200 cleanly.
 *
 * Per-token ownership is enforced server-side so a leaked token id from one
 * user cannot be used to revoke another user's session.
 */
export async function revokeMyToken(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const id = Number.parseInt(req.params.id ?? '', 10);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid token id.' });
    return;
  }

  try {
    const token = await prisma.apiToken.findUnique({ where: { id } });
    if (!token || token.userId !== userId) {
      res.status(404).json({ error: 'Token not found.' });
      return;
    }
    if (token.revokedAt !== null) {
      res.json({ ok: true, alreadyRevoked: true });
      return;
    }
    await revokeApiTokenById(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth/me/tokens] revoke', err);
    res.status(500).json({ error: 'Failed to revoke token.' });
  }
}
