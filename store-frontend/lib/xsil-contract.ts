/** XSILToken on Base mainnet (deployed May 2026). */
export const XSIL_CONTRACT_ADDRESS =
  "0xCD64A7A8AB098Cd16E9b31E1139d8dD83530c0D8" as const;

export const XSIL_CHAIN_ID = 8453;

export function getXsilContractAddress(): string {
  return (
    process.env.NEXT_PUBLIC_XSIL_CONTRACT_ADDRESS?.trim() || XSIL_CONTRACT_ADDRESS
  );
}

export function getXsilBasescanUrl(address = getXsilContractAddress()): string {
  return `https://basescan.org/address/${address}`;
}
