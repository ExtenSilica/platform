/** Published ExtenSilica DAO on Aragon (Base mainnet, May 2026). */
export const ARAGON_DAO_PUBLIC_URL =
  "https://app.aragon.org/dao/base-mainnet/0x1FcE7Ae8B7c2fB4bf756801A270c1de237BF7c33/";

export const ARAGON_DAO_ADDRESS = "0x1FcE7Ae8B7c2fB4bf756801A270c1de237BF7c33";

/** Prefer API value from `GET /governance`; fall back to published DAO URL. */
export function resolveAragonPublicUrl(apiUrl: string | null | undefined): string {
  const trimmed = apiUrl?.trim();
  return trimmed || ARAGON_DAO_PUBLIC_URL;
}
