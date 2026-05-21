import type { Request, Response } from 'express';
import {
  GOVERNANCE_DISCLAIMER,
  TOKEN_EARN_ROWS,
  TOKEN_SUPPLY_ROWS,
  GovernanceAddressError,
  aragonConfig,
  aragonPublicUrl,
  getGovernanceClaimStatus,
  getGovernanceMe,
  linkGovernanceAddress,
  unlinkGovernanceAddress,
} from '../lib/governancePoints';

export async function getGovernancePublic(_req: Request, res: Response): Promise<void> {
  res.json({
    disclaimer: GOVERNANCE_DISCLAIMER,
    tokenSupply: TOKEN_SUPPLY_ROWS,
    earnRules: TOKEN_EARN_ROWS,
    aragon: aragonConfig(),
    aragonUrl: aragonPublicUrl(),
  });
}

export async function getGovernanceMeHandler(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const data = await getGovernanceMe(user.id);
  res.json(data);
}

export async function patchGovernanceAddress(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const body = req.body as { linkedEvmAddress?: string | null };

  try {
    if (body.linkedEvmAddress === null || body.linkedEvmAddress === '') {
      const data = await unlinkGovernanceAddress(user.id);
      res.json(data);
      return;
    }
    if (!body.linkedEvmAddress || typeof body.linkedEvmAddress !== 'string') {
      res.status(400).json({ error: 'linkedEvmAddress is required (or null to disconnect).' });
      return;
    }
    const data = await linkGovernanceAddress(user.id, body.linkedEvmAddress);
    res.json(data);
  } catch (err) {
    if (err instanceof GovernanceAddressError) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('[governance/link-address]', err);
    res.status(500).json({ error: 'Failed to link address.' });
  }
}

export async function getGovernanceClaimHandler(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const data = await getGovernanceClaimStatus(user.id);
  res.json(data);
}
