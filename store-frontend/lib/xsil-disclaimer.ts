/** Canonical XSIL notice (must match store-backend/src/lib/xsilDisclaimer.ts). */

export const XSIL_NOTICE_LINES = [
  "XSIL currently has no established market price or liquidity.",
  "ExtenSilica does not sell XSIL and is not conducting an ICO, presale, or investment offering.",
  "XSIL is distributed for verified contributions and currently provides governance participation.",
  "ExtenSilica does not promise listing, liquidity, redemption, appreciation, income, or financial return.",
  "XSIL may never develop a market or market value.",
] as const;

export const XSIL_NOTICE = XSIL_NOTICE_LINES.join(" ");

export const ARAGON_DAO_DESCRIPTION_DEFAULT = `The ExtenSilica DAO on Aragon coordinates registry and platform decisions by XSIL token holders on Base. Voting weight is one token per address for eligible proposals.

${XSIL_NOTICE}`;
