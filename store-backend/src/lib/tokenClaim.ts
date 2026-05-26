import { prisma } from '../db';
import {
  XsilTreasuryAllowanceError,
  distributeXsilFromTreasury,
  isOnChainClaimConfigured,
} from './blockchain';
import { TokenGrantError } from './tokenGrants';

export async function claimApprovedTokens(
  userId: number,
): Promise<{ txHash: string; amount: number }> {
  const balance = await prisma.tokenBalance.findUnique({ where: { userId } });
  if (!balance?.linkedEvmAddress) {
    throw new TokenGrantError('Connect and verify a wallet before claiming.', 400);
  }

  const grants = await prisma.tokenGrant.findMany({
    where: { userId, status: 'APPROVED' },
  });
  const amount = grants.reduce((sum, g) => sum + g.xsilAmount, 0);
  if (amount <= 0) {
    throw new TokenGrantError('No approved XSIL available to claim.', 400);
  }

  if (!isOnChainClaimConfigured()) {
    throw new TokenGrantError(
      'On-chain treasury transfer is not configured yet. Your approved balance remains off-chain.',
      503,
    );
  }

  let txHash: string;
  try {
    txHash = await distributeXsilFromTreasury(
      balance.linkedEvmAddress,
      amount,
      grants.map((g) => g.id),
    );
  } catch (err) {
    console.error('[tokenClaim/transferFrom]', err);
    if (err instanceof XsilTreasuryAllowanceError) {
      throw new TokenGrantError(err.message, 503);
    }
    throw new TokenGrantError('On-chain treasury transfer failed to execute.', 503);
  }

  await prisma.$transaction(async (tx) => {
    await tx.tokenGrant.updateMany({
      where: { userId, status: 'APPROVED' },
      data: { status: 'CLAIMED', claimTxHash: txHash },
    });
    await tx.tokenBalance.update({
      where: { userId },
      data: {
        pendingXsil: { decrement: amount },
        claimedXsil: { increment: amount },
      },
    });
  });

  return { txHash, amount };
}
