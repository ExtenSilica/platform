/** Canonical XSIL legal disclaimer (must match store-backend/src/lib/xsilDisclaimer.ts). */

export const XSIL_LEGAL_DISCLAIMER_LINES = [
  "XSIL tokens have no monetary value today and may never have.",
  "They are not securities, investments, or financial instruments.",
  "They represent governance participation and contribution history only.",
  "No financial return is promised or implied.",
] as const;

export const XSIL_LEGAL_DISCLAIMER = XSIL_LEGAL_DISCLAIMER_LINES.join(" ");

/** @deprecated Use XSIL_LEGAL_DISCLAIMER — kept for imports from token-page-data. */
export const XSIL_DISCLAIMER_FULL = XSIL_LEGAL_DISCLAIMER;

export const ARAGON_DAO_DESCRIPTION_DEFAULT = `The ExtenSilica DAO on Aragon coordinates registry and platform decisions by XSIL token holders on Base. Voting weight is one token per address for eligible proposals.

${XSIL_LEGAL_DISCLAIMER}`;
