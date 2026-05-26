import { privateKeyToAccount } from 'viem/accounts';

/** XSILToken on Base mainnet (deployed May 2026). */
export const XSIL_CONTRACT_ADDRESS_DEFAULT =
  '0xCD64A7A8AB098Cd16E9b31E1139d8dD83530c0D8';

export const XSIL_BASESCAN_URL =
  'https://basescan.org/address/0xcd64a7a8ab098cd16e9b31e1139d8dd83530c0d8';

export const XSIL_CHAIN_ID_DEFAULT = 8453;

/** Aragon DAO on Base — holds treasury XSIL (70% supply). */
export const XSIL_TREASURY_ADDRESS_DEFAULT =
  '0x1FcE7Ae8B7c2fB4bf756801A270c1de237BF7c33';

/** Approved via Aragon proposal XSIL-1 (effective 2026-06-01). */
export const XSIL_TREASURY_ALLOWANCE_XSIL1_WHOLE = 500_000;

export function getXsilTreasuryAddress(): string {
  return (
    process.env.XSIL_TREASURY_ADDRESS?.trim() || XSIL_TREASURY_ADDRESS_DEFAULT
  );
}

/** Spender for treasury `transferFrom` — set explicitly or derived from the backend private key. */
export function getXsilBackendAddress(): string | undefined {
  const explicit = process.env.XSIL_BACKEND_ADDRESS?.trim();
  if (explicit) return explicit;
  const pk = process.env.XSIL_BACKEND_PRIVATE_KEY?.trim();
  if (!pk) return undefined;
  return privateKeyToAccount(pk as `0x${string}`).address;
}

export function getXsilContractAddress(): string {
  return (
    process.env.XSIL_CONTRACT_ADDRESS?.trim() || XSIL_CONTRACT_ADDRESS_DEFAULT
  );
}

export function getXsilBasescanUrl(): string {
  return XSIL_BASESCAN_URL;
}
