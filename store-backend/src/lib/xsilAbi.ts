/** Minimal ERC-20 surface for treasury payouts (Base mainnet XSIL). */
export const XSIL_ABI = [
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'amount', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'amount', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export const XSIL_DECIMALS = 18;

export function xsilAmountToWei(wholeTokens: number): bigint {
  if (!Number.isInteger(wholeTokens) || wholeTokens <= 0) {
    throw new Error('XSIL amount must be a positive integer.');
  }
  return BigInt(wholeTokens) * 10n ** BigInt(XSIL_DECIMALS);
}
