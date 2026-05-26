/** ExtenSilica DAO on Aragon — Base mainnet (published May 2026). */
export const ARAGON_DAO_PUBLIC_URL =
  "https://app.aragon.org/dao/base-mainnet/0x1FcE7Ae8B7c2fB4bf756801A270c1de237BF7c33/" as const;

export const ARAGON_DAO_ADDRESS =
  "0x1FcE7Ae8B7c2fB4bf756801A270c1de237BF7c33" as const;

/** Public DAO app URL for all site links (do not use a placeholder). */
export function getAragonPublicUrl(): string {
  return ARAGON_DAO_PUBLIC_URL;
}

/** @deprecated Prefer {@link getAragonPublicUrl} — API value ignored so links stay canonical. */
export function resolveAragonPublicUrl(_apiUrl?: string | null): string {
  return ARAGON_DAO_PUBLIC_URL;
}
