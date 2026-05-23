import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { XSIL_ABI, xsilAmountToWei } from './xsilAbi';

/**
 * Mint XSIL on Base via MINTER_ROLE. `amount` is whole tokens (off-chain ledger units).
 * `grantIds` are recorded in TokensClaimed for audit.
 */
export async function mintXsilTokens(
  recipientAddress: string,
  amount: number,
  grantIds: string[],
): Promise<string> {
  const contract = process.env.XSIL_CONTRACT_ADDRESS?.trim();
  const pk = process.env.XSIL_MINTER_PRIVATE_KEY?.trim();
  const stub = process.env.XSIL_CLAIM_STUB === 'true';

  if (stub) {
    return `stub:${Date.now()}`;
  }

  if (!contract || !pk) {
    throw new Error('XSIL_CONTRACT_ADDRESS and XSIL_MINTER_PRIVATE_KEY must be set.');
  }

  const account = privateKeyToAccount(pk as `0x${string}`);
  const chainId = Number.parseInt(process.env.CHAIN_ID ?? process.env.NEXT_PUBLIC_CHAIN_ID ?? '8453', 10);
  const chain = chainId === base.id ? base : base;

  const client = createWalletClient({
    account,
    chain,
    transport: http(process.env.XSIL_RPC_URL?.trim() || 'https://mainnet.base.org'),
  });

  const amountWei = xsilAmountToWei(amount);
  const grantIdsStr = grantIds.join(',').slice(0, 4000);

  const txHash = await client.writeContract({
    address: contract as `0x${string}`,
    abi: XSIL_ABI,
    functionName: 'mint',
    args: [recipientAddress as `0x${string}`, amountWei, grantIdsStr],
  });

  return txHash;
}

export function isOnChainClaimConfigured(): boolean {
  return (
    process.env.XSIL_CLAIM_STUB === 'true' ||
    Boolean(process.env.XSIL_CONTRACT_ADDRESS?.trim() && process.env.XSIL_MINTER_PRIVATE_KEY?.trim())
  );
}

/** @deprecated Use mintXsilTokens */
export async function mintXsilOnChain(
  toAddress: string,
  amount: number,
  grantIds: string[] = [],
): Promise<string | null> {
  try {
    return await mintXsilTokens(toAddress, amount, grantIds);
  } catch (err) {
    if (!process.env.XSIL_CONTRACT_ADDRESS?.trim()) return null;
    throw err;
  }
}
