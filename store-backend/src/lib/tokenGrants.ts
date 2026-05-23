import type { Prisma, TokenGrantReason, TokenGrantStatus } from '@prisma/client';
import { prisma } from '../db';
import { ensureTokenBalanceForUser } from './governancePoints';
import { sendTokenGrantNotificationEmail } from '../mailer';

export const TOKEN_AMOUNTS: Record<TokenGrantReason, number> = {
  FIRST_PACKAGE_PUBLISH: 500,
  PACKAGE_PUBLISH: 200,
  OWNERSHIP_CLAIM_APPROVED: 1000,
  IMPLEMENTATION_SUBMISSION_ACCEPTED: 2000,
  VERIFICATION_RUN_COMPLETED: 1500,
  EXTERNAL_CITATION_VERIFIED: 3000,
  CODE_CONTRIBUTION_MERGED: 2000,
  VENDOR_CLAIM_APPROVED: 5000,
  SECURITY_REPORT_FIXED: 2000,
  ADMIN_DISCRETIONARY: 0,
};

export type CreateTokenGrantOptions = {
  autoApprove?: boolean;
  note?: string;
  /** Overrides TOKEN_AMOUNTS (required for ADMIN_DISCRETIONARY). */
  amount?: number;
};

function resolveAmount(reason: TokenGrantReason, options?: CreateTokenGrantOptions): number {
  if (options?.amount != null && options.amount > 0) return options.amount;
  return TOKEN_AMOUNTS[reason] ?? 0;
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

/**
 * Fire-and-forget grant creation — never throws to callers (hook-safe).
 */
export function createTokenGrantSafe(
  userId: number,
  reason: TokenGrantReason,
  referenceId: string,
  options?: CreateTokenGrantOptions,
): void {
  void createTokenGrantInner(userId, reason, referenceId, options).catch((err) => {
    console.error('[TokenGrant] Failed to create grant:', err);
  });
}

function notifyGrantApproved(userId: number, amount: number, reason: TokenGrantReason, referenceId: string): void {
  void (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, username: true },
      });
      if (!user?.email) return;
      await sendTokenGrantNotificationEmail({
        toEmail: user.email,
        toUsername: user.username,
        amount,
        reasonLabel: GRANT_REASON_LABELS[reason] ?? reason,
        referenceId,
        status: 'APPROVED',
      });
    } catch (err) {
      console.error('[TokenGrant] Grant notification email failed:', err);
    }
  })();
}

async function createTokenGrantInner(
  userId: number,
  reason: TokenGrantReason,
  referenceId: string,
  options?: CreateTokenGrantOptions,
): Promise<void> {
  const ref = referenceId.trim().slice(0, 200);
  if (!ref) return;

  const amount = resolveAmount(reason, options);
  if (amount <= 0) return;

  const status: TokenGrantStatus = options?.autoApprove ? 'APPROVED' : 'PENDING';
  const approvedAt = status === 'APPROVED' ? new Date() : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tokenGrant.create({
        data: {
          userId,
          xsilAmount: amount,
          reason,
          referenceId: ref,
          note: options?.note ?? null,
          status,
          approvedAt,
        },
      });
      if (status === 'APPROVED') {
        await bumpBalanceOnApprove(userId, amount, tx);
      }
    });
    if (status === 'APPROVED') {
      notifyGrantApproved(userId, amount, reason, ref);
    }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') return;
    throw err;
  }
}

/** One-time first package grant (idempotent per user + reason). */
export function checkFirstPublishGrant(userId: number, packageId: number): void {
  createTokenGrantSafe(userId, 'FIRST_PACKAGE_PUBLISH', `package:${packageId}`, {
    autoApprove: true,
  });
}

export async function approveTokenGrant(
  grantId: string,
  approvedById: number,
  amountOverride?: number,
): Promise<void> {
  const grant = await prisma.tokenGrant.findUnique({ where: { id: grantId } });
  if (!grant) throw new TokenGrantError('Grant not found.', 404);
  if (grant.status !== 'PENDING') {
    throw new TokenGrantError(`Grant is already ${grant.status}.`, 409);
  }

  const amount = amountOverride != null && amountOverride > 0 ? amountOverride : grant.xsilAmount;
  if (amount <= 0) throw new TokenGrantError('Grant amount must be positive.', 400);

  await prisma.$transaction(async (tx) => {
    await tx.tokenGrant.update({
      where: { id: grantId },
      data: {
        status: 'APPROVED',
        xsilAmount: amount,
        approvedById,
        approvedAt: new Date(),
      },
    });
    await bumpBalanceOnApprove(grant.userId, amount, tx);
  });
  notifyGrantApproved(grant.userId, amount, grant.reason, grant.referenceId);
}

export async function rejectTokenGrant(
  grantId: string,
  approvedById: number,
  rejectionReason: string,
): Promise<void> {
  const grant = await prisma.tokenGrant.findUnique({ where: { id: grantId } });
  if (!grant) throw new TokenGrantError('Grant not found.', 404);
  if (grant.status !== 'PENDING') {
    throw new TokenGrantError(`Grant is already ${grant.status}.`, 409);
  }

  await prisma.tokenGrant.update({
    where: { id: grantId },
    data: {
      status: 'REJECTED',
      approvedById,
      approvedAt: new Date(),
      note: rejectionReason.trim().slice(0, 2000) || null,
    },
  });
}

export async function createManualTokenGrant(input: {
  userId: number;
  amount: number;
  reason: TokenGrantReason;
  note?: string;
  referenceId?: string;
  autoApprove?: boolean;
  approvedById?: number;
}): Promise<{ id: string }> {
  if (input.amount <= 0) throw new TokenGrantError('amount must be positive.', 400);
  const referenceId =
    input.referenceId?.trim().slice(0, 200) ||
    `manual:${input.reason}:${Date.now()}`;
  const autoApprove = input.autoApprove !== false;
  const status: TokenGrantStatus = autoApprove ? 'APPROVED' : 'PENDING';

  const grant = await prisma.$transaction(async (tx) => {
    const row = await tx.tokenGrant.create({
      data: {
        userId: input.userId,
        xsilAmount: input.amount,
        reason: input.reason,
        referenceId,
        note: input.note ?? null,
        status,
        approvedById: autoApprove ? (input.approvedById ?? null) : null,
        approvedAt: autoApprove ? new Date() : null,
      },
    });
    if (autoApprove) {
      await bumpBalanceOnApprove(input.userId, input.amount, tx);
    }
    return row;
  });

  if (autoApprove) {
    notifyGrantApproved(input.userId, input.amount, input.reason, referenceId);
  }

  return { id: grant.id };
}

export function serializeTokenGrant(row: {
  id: string;
  userId: number;
  xsilAmount: number;
  reason: TokenGrantReason;
  referenceId: string;
  note: string | null;
  status: TokenGrantStatus;
  approvedById: number | null;
  approvedAt: Date | null;
  claimTxHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: number; username: string; email: string };
}) {
  return {
    id: row.id,
    userId: row.userId,
    amount: row.xsilAmount,
    reason: row.reason,
    referenceId: row.referenceId,
    note: row.note,
    status: row.status,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    claimTxHash: row.claimTxHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: row.user
      ? { id: row.user.id, username: row.user.username, email: row.user.email }
      : undefined,
  };
}

export async function getTokenBalanceForUser(userId: number) {
  await ensureTokenBalanceForUser(userId);
  const [balance, recentGrants] = await Promise.all([
    prisma.tokenBalance.findUnique({ where: { userId } }),
    prisma.tokenGrant.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        userId: true,
        xsilAmount: true,
        reason: true,
        referenceId: true,
        note: true,
        status: true,
        approvedById: true,
        approvedAt: true,
        claimTxHash: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    pendingXsil: balance?.pendingXsil ?? 0,
    claimedXsil: balance?.claimedXsil ?? 0,
    totalEarned: balance?.totalEarned ?? 0,
    walletAddress: balance?.linkedEvmAddress ?? null,
    recentGrants: recentGrants.map(serializeTokenGrant),
  };
}

export const GRANT_REASON_LABELS: Record<TokenGrantReason, string> = {
  FIRST_PACKAGE_PUBLISH: 'First package published',
  PACKAGE_PUBLISH: 'Package published',
  OWNERSHIP_CLAIM_APPROVED: 'Ownership claim approved',
  IMPLEMENTATION_SUBMISSION_ACCEPTED: 'Implementation accepted',
  VERIFICATION_RUN_COMPLETED: 'Verification run completed',
  EXTERNAL_CITATION_VERIFIED: 'External citation verified',
  CODE_CONTRIBUTION_MERGED: 'Code contribution merged',
  VENDOR_CLAIM_APPROVED: 'Vendor official claim',
  SECURITY_REPORT_FIXED: 'Security report fixed',
  ADMIN_DISCRETIONARY: 'Admin discretionary grant',
};

/** Public profile summary — no wallet address. */
export async function getPublicXsilForUser(userId: number) {
  const [balance, grants] = await Promise.all([
    prisma.tokenBalance.findUnique({
      where: { userId },
      select: { totalEarned: true, claimedXsil: true, pendingXsil: true },
    }),
    prisma.tokenGrant.findMany({
      where: { userId, status: { in: ['APPROVED', 'CLAIMED'] } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        xsilAmount: true,
        reason: true,
        referenceId: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const totalEarned = balance?.totalEarned ?? 0;
  const claimedOnChain = balance?.claimedXsil ?? 0;
  const pendingClaim = balance?.pendingXsil ?? 0;

  return {
    totalEarned,
    claimedOnChain,
    pendingClaim,
    grants: grants.map((g) => ({
      id: g.id,
      amount: g.xsilAmount,
      reason: g.reason,
      reasonLabel: GRANT_REASON_LABELS[g.reason],
      referenceId: g.referenceId,
      status: g.status,
      createdAt: g.createdAt.toISOString(),
    })),
  };
}

export class TokenGrantError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'TokenGrantError';
    this.status = status;
  }
}
