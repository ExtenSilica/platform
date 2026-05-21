import type { Prisma, TokenGrantReason, TokenGrantStatus } from '@prisma/client';
import { prisma } from '../db';

export const GOVERNANCE_DISCLAIMER =
  'XSIL tokens are contribution and governance participation records on the ExtenSilica platform. They have no monetary value today and may never have. XSIL is not an investment, security, or payment instrument. Holding XSIL does not entitle you to profits, revenue, dividends, or any financial return. Any future liquidity, transferability, or economic use would require a separate community governance decision via the ExtenSilica Aragon DAO. ExtenSilica Ltda. makes no promise that XSIL will ever be tradeable or redeemable for money.';

export const TOKEN_ACCRUAL_AMOUNTS: Partial<Record<TokenGrantReason, number>> = {
  FIRST_PACKAGE_PUBLISH: 500,
  PACKAGE_PUBLISH: 200,
  OWNERSHIP_CLAIM_APPROVED: 1000,
  IMPLEMENTATION_SUBMISSION_ACCEPTED: 2000,
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

export async function ensureTokenBalanceForUser(
  userId: number,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  await db.tokenBalance.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function bumpBalanceOnApprove(
  userId: number,
  amount: number,
  tx: Prisma.TransactionClient,
): Promise<void> {
  await ensureTokenBalanceForUser(userId, tx);
  await tx.tokenBalance.update({
    where: { userId },
    data: {
      pendingXsil: { increment: amount },
      totalEarned: { increment: amount },
    },
  });
}

export type AwardTokenGrantInput = {
  userId: number;
  reason: TokenGrantReason;
  referenceId: string;
  amount: number;
  note?: string;
  /** Auto-accrual from platform hooks — immediately APPROVED. */
  autoApprove?: boolean;
};

export async function awardTokenGrant(
  input: AwardTokenGrantInput,
): Promise<{ awarded: boolean; totalPoints: number }> {
  const referenceId = input.referenceId.trim().slice(0, 200);
  const amount = input.amount;
  if (!referenceId || amount <= 0) {
    const totalPoints = await getTotalPoints(input.userId);
    return { awarded: false, totalPoints };
  }

  const status: TokenGrantStatus = input.autoApprove !== false ? 'APPROVED' : 'PENDING';
  const approvedAt = status === 'APPROVED' ? new Date() : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tokenGrant.create({
        data: {
          userId: input.userId,
          xsilAmount: amount,
          reason: input.reason,
          referenceId,
          note: input.note ?? null,
          status,
          approvedAt,
        },
      });
      if (status === 'APPROVED') {
        await bumpBalanceOnApprove(input.userId, amount, tx);
      }
    });
    const totalPoints = await getTotalPoints(input.userId);
    return { awarded: true, totalPoints };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      const totalPoints = await getTotalPoints(input.userId);
      return { awarded: false, totalPoints };
    }
    throw err;
  }
}

/** @deprecated Use awardTokenGrant — kept for hook call sites during rename. */
export async function awardGovernancePoints(
  userId: number,
  reason: TokenGrantReason,
  referenceKey: string,
  points: number,
): Promise<{ awarded: boolean; total: number }> {
  const result = await awardTokenGrant({
    userId,
    reason,
    referenceId: referenceKey,
    amount: points,
    autoApprove: true,
  });
  return { awarded: result.awarded, total: result.totalPoints };
}

export async function getTotalPoints(userId: number): Promise<number> {
  const balance = await prisma.tokenBalance.findUnique({ where: { userId } });
  if (!balance) return 0;
  return balance.pendingXsil + balance.claimedXsil;
}

export async function getGovernanceMe(userId: number) {
  await ensureTokenBalanceForUser(userId);

  const [balance, recent] = await Promise.all([
    prisma.tokenBalance.findUnique({ where: { userId } }),
    prisma.tokenGrant.findMany({
      where: { userId, status: { in: ['APPROVED', 'CLAIMED', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        reason: true,
        xsilAmount: true,
        referenceId: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const pendingPoints = balance?.pendingXsil ?? 0;
  const onChainPoints = balance?.claimedXsil ?? 0;
  const totalPoints = pendingPoints + onChainPoints;

  return {
    disclaimer: GOVERNANCE_DISCLAIMER,
    totalPoints,
    pendingPoints,
    onChainPoints,
    totalEarned: balance?.totalEarned ?? 0,
    recentLedger: recent.map((row) => ({
      id: row.id,
      reason: row.reason,
      points: row.xsilAmount,
      referenceKey: row.referenceId,
      status: row.status,
      createdAt: row.createdAt,
    })),
    linkedEvmAddress: balance?.linkedEvmAddress ?? null,
    linkedAt: balance?.evmLinkedAt?.toISOString() ?? null,
    claimedAt: null as string | null,
    claimTxHash: null as string | null,
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

  await ensureTokenBalanceForUser(userId);
  await prisma.tokenBalance.update({
    where: { userId },
    data: { linkedEvmAddress: normalized, evmLinkedAt: new Date() },
  });

  return getGovernanceMe(userId);
}

export async function unlinkGovernanceAddress(userId: number) {
  await prisma.tokenBalance.updateMany({
    where: { userId },
    data: { linkedEvmAddress: null, evmLinkedAt: null },
  });
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

  if (me.onChainPoints > 0 && me.pendingPoints === 0) {
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
