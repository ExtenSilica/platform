/** Inbound contact addresses for mail and legal flows. */
export const CONTACT_EMAIL =
  process.env.CONTACT_EMAIL?.trim() || 'contact@extensilica.com';

export const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL?.trim() || 'support@extensilica.com';

export const LEGAL_EMAIL =
  process.env.LEGAL_EMAIL?.trim() || 'legal@extensilica.com';
