import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { XSIL_ABI, xsilAmountToWei } from './xsilAbi';
import {
  getXsilBackendAddress,
  getXsilContractAddress,
  getXsilTreasuryAddress,
} from './xsilContract';

export class XsilTreasuryAllowanceError extends Error {
  readonly code = 'XSIL_ALLOWANCE_INSUFFICIENT';

  constructor(
    public readonly requiredWei: bigint,
    public readonly allowanceWei: bigint,
  ) {
    super('Allowance insuficiente — criar proposta na DAO');
    this.name = 'XsilTreasuryAllowanceError';
  }
}

export function assertTreasuryAllowanceSufficient(
  allowance: bigint,
  amountWei: bigint,
): void {
  if (allowance < amountWei) {
    throw new XsilTreasuryAllowanceError(amountWei, allowance);
  }
}

function getXsilChain() {
  const chainId = Number.parseInt(
    process.env.XSIL_CHAIN_ID ??
      process.env.CHAIN_ID ??
      process.env.NEXT_PUBLIC_CHAIN_ID ??
      '8453',
    10,
  );
  return chainId === base.id ? base : base;
}

function getXsilRpcTransport() {
  return http(process.env.XSIL_RPC_URL?.trim() || 'https://mainnet.base.org');
}

export async function readTreasuryAllowanceWei(
  contractAddress?: string,
  treasuryAddress?: string,
  backendAddress?: string,
): Promise<bigint> {
  const contract = contractAddress ?? getXsilContractAddress();
  const treasury = treasuryAddress ?? getXsilTreasuryAddress();
  const backend = backendAddress ?? getXsilBackendAddress();
  if (!backend) {
    throw new Error('XSIL_BACKEND_ADDRESS or XSIL_BACKEND_PRIVATE_KEY must be set.');
  }

  const publicClient = createPublicClient({
    chain: getXsilChain(),
    transport: getXsilRpcTransport(),
  });

  return publicClient.readContract({
    address: contract as `0x${string}`,
    abi: XSIL_ABI,
    functionName: 'allowance',
    args: [treasury as `0x${string}`, backend as `0x${string}`],
  });
}

/**
 * Distribute XSIL from the DAO treasury to a contributor (`transferFrom`).
 * Requires ERC-20 allowance from `XSIL_TREASURY_ADDRESS` to `XSIL_BACKEND_ADDRESS`
 * (granted via an Aragon governance proposal, e.g. XSIL-1).
 */
export async function distributeXsilFromTreasury(
  contributorAddress: string,
  amount: number,
  grantIds: string[],
): Promise<string> {
  const contract = process.env.XSIL_CONTRACT_ADDRESS?.trim() || getXsilContractAddress();
  const pk = process.env.XSIL_BACKEND_PRIVATE_KEY?.trim();
  const treasury = getXsilTreasuryAddress();
  const backend = getXsilBackendAddress();
  const stub = process.env.XSIL_CLAIM_STUB === 'true';

  if (stub) {
    void grantIds;
    return `stub:${Date.now()}`;
  }

  if (!pk || !backend) {
    throw new Error('XSIL_BACKEND_PRIVATE_KEY (and optionally XSIL_BACKEND_ADDRESS) must be set.');
  }

  const amountWei = xsilAmountToWei(amount);
  void grantIds;

  const allowance = await readTreasuryAllowanceWei(contract, treasury, backend);
  assertTreasuryAllowanceSufficient(allowance, amountWei);

  const account = privateKeyToAccount(pk as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: getXsilChain(),
    transport: getXsilRpcTransport(),
  });

  const txHash = await client.writeContract({
    address: contract as `0x${string}`,
    abi: XSIL_ABI,
    functionName: 'transferFrom',
    args: [treasury as `0x${string}`, contributorAddress as `0x${string}`, amountWei],
  });

  return txHash;
}

export function isOnChainClaimConfigured(): boolean {
  return (
    process.env.XSIL_CLAIM_STUB === 'true' ||
    Boolean(
      (process.env.XSIL_CONTRACT_ADDRESS?.trim() || getXsilContractAddress()) &&
        process.env.XSIL_BACKEND_PRIVATE_KEY?.trim() &&
        getXsilBackendAddress() &&
        getXsilTreasuryAddress(),
    )
  );
}
