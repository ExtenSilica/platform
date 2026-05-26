/** XSILToken on Base mainnet (deployed May 2026). */
export const XSIL_CONTRACT_ADDRESS_DEFAULT =
  '0xCD64A7A8AB098Cd16E9b31E1139d8dD83530c0D8';

export const XSIL_BASESCAN_URL =
  'https://basescan.org/address/0xcd64a7a8ab098cd16e9b31e1139d8dd83530c0d8';

export const XSIL_CHAIN_ID_DEFAULT = 8453;

export function getXsilContractAddress(): string {
  return (
    process.env.XSIL_CONTRACT_ADDRESS?.trim() || XSIL_CONTRACT_ADDRESS_DEFAULT
  );
}

export function getXsilBasescanUrl(): string {
  return XSIL_BASESCAN_URL;
}
