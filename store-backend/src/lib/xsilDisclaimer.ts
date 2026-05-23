/** Canonical XSIL legal disclaimer (required on token UI, API, emails, Aragon copy). */

export const XSIL_LEGAL_DISCLAIMER_LINES = [
  'XSIL tokens have no monetary value today and may never have.',
  'They are not securities, investments, or financial instruments.',
  'They represent governance participation and contribution history only.',
  'No financial return is promised or implied.',
] as const;

/** Single-paragraph form for API JSON and plain-text email. */
export const XSIL_LEGAL_DISCLAIMER = XSIL_LEGAL_DISCLAIMER_LINES.join(' ');

const ARAGON_DAO_BODY =
  'The ExtenSilica DAO on Aragon coordinates registry and platform decisions by XSIL token holders on Base. Voting weight is one token per address for eligible proposals.';

/** Default Aragon DAO public description; override with ARAGON_DAO_DESCRIPTION. */
export const ARAGON_DAO_DESCRIPTION_DEFAULT = `${ARAGON_DAO_BODY}\n\n${XSIL_LEGAL_DISCLAIMER}`;

export function aragonDaoDescription(): string {
  const custom = process.env.ARAGON_DAO_DESCRIPTION?.trim();
  if (custom) {
    return custom.includes('monetary value') ? custom : `${custom}\n\n${XSIL_LEGAL_DISCLAIMER}`;
  }
  return ARAGON_DAO_DESCRIPTION_DEFAULT;
}
