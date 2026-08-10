/** Canonical XSIL notice (required on token UI, API, emails, and Aragon copy). */

export const XSIL_NOTICE_LINES = [
  'XSIL currently has no established market price or liquidity.',
  'ExtenSilica does not sell XSIL and is not conducting an ICO, presale, or investment offering.',
  'XSIL is distributed for verified contributions and currently provides governance participation.',
  'ExtenSilica does not promise listing, liquidity, redemption, appreciation, income, or financial return.',
  'XSIL may never develop a market or market value.',
] as const;

/** Single-paragraph form for API JSON and plain-text email. */
export const XSIL_NOTICE = XSIL_NOTICE_LINES.join(' ');

const ARAGON_DAO_BODY =
  'The ExtenSilica DAO on Aragon coordinates registry and platform decisions by XSIL token holders on Base. Voting weight is one token per address for eligible proposals.';

/** Default Aragon DAO public description; override with ARAGON_DAO_DESCRIPTION. */
export const ARAGON_DAO_DESCRIPTION_DEFAULT = `${ARAGON_DAO_BODY}\n\n${XSIL_NOTICE}`;

export function aragonDaoDescription(): string {
  const custom = process.env.ARAGON_DAO_DESCRIPTION?.trim();
  if (custom?.includes(XSIL_NOTICE_LINES[0])) {
    return custom;
  }
  return ARAGON_DAO_DESCRIPTION_DEFAULT;
}
