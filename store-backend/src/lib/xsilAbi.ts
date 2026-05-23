/** XSILToken — matches contracts/src/XSILToken.sol */
export const XSIL_ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'grantIds', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

export const XSIL_DECIMALS = 18;

export function xsilAmountToWei(wholeTokens: number): bigint {
  if (!Number.isInteger(wholeTokens) || wholeTokens <= 0) {
    throw new Error('XSIL amount must be a positive integer.');
  }
  return BigInt(wholeTokens) * 10n ** BigInt(XSIL_DECIMALS);
}
