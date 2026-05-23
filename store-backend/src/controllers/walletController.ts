import type { Request, Response } from 'express';
import { prisma } from '../db';
import {
  ensureTokenBalanceForUser,
  getGovernanceMe,
  linkGovernanceAddress,
  unlinkGovernanceAddress,
  GovernanceAddressError,
} from '../lib/governancePoints';
import {
  buildWalletLinkMessage,
  newWalletLinkNonce,
  parseWalletLinkMessage,
  verifyWalletOwnershipSignature,
} from '../lib/walletVerification';

async function getOrCreateBalance(userId: number) {
  await ensureTokenBalanceForUser(userId);
  return prisma.tokenBalance.findUniqueOrThrow({ where: { userId } });
}

/**
 * GET /auth/me/wallet/message — challenge for EIP-191 sign (no gas).
 */
export async function getWalletMessage(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const rawAddress =
    typeof req.query.address === 'string' ? req.query.address : undefined;

  if (!rawAddress?.trim()) {
    res.status(400).json({ error: 'address query parameter is required.' });
    return;
  }

  const normalized = rawAddress.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    res.status(400).json({ error: 'Invalid EVM address.' });
    return;
  }

  const nonce = newWalletLinkNonce();
  await prisma.tokenBalance.upsert({
    where: { userId: user.id },
    create: { userId: user.id, evmLinkNonce: nonce },
    update: { evmLinkNonce: nonce },
  });

  const message = buildWalletLinkMessage(normalized, user.id, nonce);
  res.json({ message, nonce, address: normalized });
}

/**
 * POST /auth/me/wallet — verify signature and link address on TokenBalance.
 */
export async function postWallet(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const body = req.body as { address?: string; signature?: string; message?: string };
  if (!body.address || typeof body.address !== 'string') {
    res.status(400).json({ error: 'address is required.' });
    return;
  }
  if (!body.signature || typeof body.signature !== 'string') {
    res.status(400).json({ error: 'signature is required.' });
    return;
  }
  if (!body.message || typeof body.message !== 'string') {
    res.status(400).json({ error: 'message is required.' });
    return;
  }

  const parsed = parseWalletLinkMessage(body.message);
  if (!parsed) {
    res.status(400).json({ error: 'Invalid message format.' });
    return;
  }
  if (parsed.userId !== user.id) {
    res.status(400).json({ error: 'Message user id does not match authenticated user.' });
    return;
  }

  const normalizedBody = body.address.trim().toLowerCase();
  const normalizedParsed = parsed.address.trim().toLowerCase();
  if (normalizedBody !== normalizedParsed) {
    res.status(400).json({ error: 'Address in body does not match signed message.' });
    return;
  }

  const balance = await getOrCreateBalance(user.id);
  if (!balance.evmLinkNonce || balance.evmLinkNonce !== parsed.nonce) {
    res.status(400).json({ error: 'Nonce expired or invalid. Request a new message to sign.' });
    return;
  }

  const ok = await verifyWalletOwnershipSignature(body.address, body.message, body.signature);
  if (!ok) {
    res.status(400).json({ error: 'Signature verification failed.' });
    return;
  }

  try {
    await linkGovernanceAddress(user.id, body.address);
    await prisma.tokenBalance.update({
      where: { userId: user.id },
      data: { evmLinkNonce: null },
    });
    const me = await getGovernanceMe(user.id);
    res.json({
      walletAddress: me.linkedEvmAddress,
      pendingXsil: me.pendingPoints,
      claimedXsil: me.onChainPoints,
      totalEarned: me.totalEarned,
    });
  } catch (err) {
    if (err instanceof GovernanceAddressError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[wallet/post]', err);
    res.status(500).json({ error: 'Failed to link wallet.' });
  }
}

/**
 * DELETE /auth/me/wallet — disconnect linked EVM address.
 */
export async function deleteWallet(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  await unlinkGovernanceAddress(user.id);
  await prisma.tokenBalance.updateMany({
    where: { userId: user.id },
    data: { evmLinkNonce: null },
  });
  res.json({ ok: true });
}
