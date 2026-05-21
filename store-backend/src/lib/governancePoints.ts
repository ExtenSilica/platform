import type { GovernancePointReason } from '@prisma/client';
import { prisma } from '../db';

export const GOVERNANCE_DISCLAIMER =
  'XSIL tokens are contribution and governance participation records on the ExtenSilica platform. They have no monetary value today and may never have. XSIL is not an investment, security, or payment instrument. Holding XSIL does not entitle you to profits, revenue, dividends, or any financial return. Any future liquidity, transferability, or economic use would require a separate community governance decision via the ExtenSilica Aragon DAO. ExtenSilica Ltda. makes no promise that XSIL will ever be tradeable or redeemable for money.';

/** Automated accrual amounts (spec May 2026). */
export const GOVERNANCE_ACCRUAL: Partial<
  Record<GovernancePointReason, { points: number; referencePrefix: string }>
> = {
  first_package_published: { points: 500, referencePrefix: 'package' },
  package_registered: { points: 200, referencePrefix: 'package' },
  ownership_approved: { points: 1000, referencePrefix: 'ownership' },
  implementation_verified: { points: 2000, referencePrefix: 'implementation' },
};

export const TOKEN_SUPPLY_ROWS = [
  { allocation: 'Founder (vesting)', amount: '3,000,000', pct: '30%', notes: '4-year vest, 1-year cliff' },
  { allocation: 'Contributors', amount: '4,000,000', pct: '40%', notes: 'Earned via platform actions' },
  { allocation: 'Early Community', amount: '2,000,000', pct: '20%', notes: 'First 12 months of activity' },
  { allocation: 'Reserve / Future DAO', amount: '1,000,000', pct: '10%', notes: 'Future governance decision' },
  { allocation: 'Total', amount: '10,000,000', pct: '100%', notes: '', total: true },
] as const;

export const TOKEN_EARN_ROWS = [
  { action: 'Publish first package', xsil: '500', notes: 'One-time per user', automated: true },
  { action: 'Publish each additional package', xsil: '200', notes: 'Per new package', automated: true },
  { action: 'Claim upstream ownership (approved)', xsil: '1,000', notes: 'After admin approval', automated: true },
  { action: 'Submit implementation (accepted)', xsil: '2,000', notes: 'After verifier approval', automated: true },
  { action: 'Complete verification run (pass)', xsil: '1,500', notes: 'As verifier', automated: false },
  { action: 'Paper citing ExtenSilica (documented)', xsil: '3,000', notes: 'Admin-verified citation', automated: false },
  { action: 'Contribute code to xsil CLI (merged PR)', xsil: '1,000–5,000', notes: 'Discretionary, admin-assigned', automated: false },
  { action: 'Vendor official claim (approved)', xsil: '5,000', notes: 'Org-level, not per-user', automated: false },
  { action: 'Report valid security issue', xsil: '2,000', notes: 'After fix is deployed', automated: false },
] as const;

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function normalizeEvmAddress(raw: string): string | null {
  const t = raw.trim();
  if (!EVM_ADDRESS_RE.test(t)) return null;
  return t.toLowerCase();
}

export async function awardGovernancePoints(
  userId: number,
  reason: GovernancePointReason,
  referenceKey: string,
  points: number,
): Promise<{ awarded: boolean; total: number }> {
  const key = referenceKey.trim().slice(0, 200);
  if (!key || points <= 0) {
    const total = await sumGovernancePoints(userId);
    return { awarded: false, total };
  }

  try {
    await prisma.governancePointLedger.create({
      data: { userId, reason, referenceKey: key, points },
    });
    const total = await sumGovernancePoints(userId);
    return { awarded: true, total };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      const total = await sumGovernancePoints(userId);
      return { awarded: false, total };
    }
    throw err;
  }
}

export async function sumGovernancePoints(userId: number): Promise<number> {
  const agg = await prisma.governancePointLedger.aggregate({
    where: { userId },
    _sum: { points: true },
  });
  return agg._sum.points ?? 0;
}

export async function getGovernanceMe(userId: number) {
  const [total, recent, link] = await Promise.all([
    sumGovernancePoints(userId),
    prisma.governancePointLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        reason: true,
        points: true,
        referenceKey: true,
        createdAt: true,
      },
    }),
    prisma.governanceAddressLink.findUnique({ where: { userId } }),
  ]);

  const claimed = Boolean(link?.claimedAt);
  const pendingPoints = claimed ? 0 : total;
  const onChainPoints = claimed ? total : 0;

  return {
    disclaimer: GOVERNANCE_DISCLAIMER,
    totalPoints: total,
    pendingPoints,
    onChainPoints,
    recentLedger: recent,
    linkedEvmAddress: link?.linkedEvmAddress ?? null,
    linkedAt: link?.linkedAt?.toISOString() ?? null,
    claimedAt: link?.claimedAt?.toISOString() ?? null,
    claimTxHash: link?.claimTxHash ?? null,
  };
}

export function aragonConfig() {
  const dao = process.env.ARAGON_DAO_ADDRESS?.trim() || null;
  const token = process.env.ARAGON_GOVERNANCE_TOKEN_ADDRESS?.trim() || null;
  const claim = process.env.ARAGON_CLAIM_CONTRACT_ADDRESS?.trim() || null;
  return {
    configured: Boolean(dao && token),
    daoAddress: dao,
    governanceTokenAddress: token,
    claimContractAddress: claim,
  };
}

export function aragonPublicUrl(): string | null {
  const url = process.env.ARAGON_DAO_PUBLIC_URL?.trim();
  return url || null;
}

export async function linkGovernanceAddress(userId: number, linkedEvmAddress: string) {
  const normalized = normalizeEvmAddress(linkedEvmAddress);
  if (!normalized) {
    throw new GovernanceAddressError('Invalid EVM address. Use a 0x-prefixed 40-character hex string.');
  }

  await prisma.governanceAddressLink.upsert({
    where: { userId },
    create: { userId, linkedEvmAddress: normalized },
    update: { linkedEvmAddress: normalized, linkedAt: new Date(), claimTxHash: null, claimedAt: null },
  });

  return getGovernanceMe(userId);
}

export async function unlinkGovernanceAddress(userId: number) {
  await prisma.governanceAddressLink.deleteMany({ where: { userId } });
  return getGovernanceMe(userId);
}

export async function getGovernanceClaimStatus(userId: number) {
  const me = await getGovernanceMe(userId);
  const aragon = aragonConfig();

  if (!me.linkedEvmAddress) {
    return {
      phase: 'link_address' as const,
      disclaimer: GOVERNANCE_DISCLAIMER,
      totalPoints: me.totalPoints,
      pendingPoints: me.pendingPoints,
      onChainPoints: me.onChainPoints,
      message: 'Connect your wallet on the token page before on-chain claim is available.',
      aragon,
    };
  }

  if (!aragon.configured) {
    return {
      phase: 'pending' as const,
      disclaimer: GOVERNANCE_DISCLAIMER,
      totalPoints: me.totalPoints,
      pendingPoints: me.pendingPoints,
      onChainPoints: me.onChainPoints,
      linkedEvmAddress: me.linkedEvmAddress,
      message: 'Aragon claim contract is not configured yet. Your off-chain balance is recorded.',
      aragon,
    };
  }

  if (me.claimedAt) {
    return {
      phase: 'claimed' as const,
      disclaimer: GOVERNANCE_DISCLAIMER,
      totalPoints: me.totalPoints,
      pendingPoints: me.pendingPoints,
      onChainPoints: me.onChainPoints,
      linkedEvmAddress: me.linkedEvmAddress,
      claimTxHash: me.claimTxHash,
      claimedAt: me.claimedAt,
      aragon,
    };
  }

  return {
    phase: 'ready' as const,
    disclaimer: GOVERNANCE_DISCLAIMER,
    totalPoints: me.totalPoints,
    pendingPoints: me.pendingPoints,
    onChainPoints: me.onChainPoints,
    linkedEvmAddress: me.linkedEvmAddress,
    message: 'On-chain claim will open when the Aragon integration is enabled in production.',
    aragon,
  };
}

export class GovernanceAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GovernanceAddressError';
  }
}
