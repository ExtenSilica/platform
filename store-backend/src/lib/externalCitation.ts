/**
 * Validators for external citations (papers, DOIs, blog posts) — PR-G2.
 */

export type ExternalCitationKind = 'doi' | 'paper' | 'website' | 'other';

export const EXTERNAL_CITATION_KINDS: readonly ExternalCitationKind[] = [
  'doi',
  'paper',
  'website',
  'other',
];

export const CITATION_LABEL_MIN = 2;
export const CITATION_LABEL_MAX = 200;
export const CITATION_URL_MAX = 2000;

export function isExternalCitationKind(raw: unknown): raw is ExternalCitationKind {
  return (
    typeof raw === 'string' &&
    (EXTERNAL_CITATION_KINDS as readonly string[]).includes(raw)
  );
}

export function validateCitationLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'label is required.';
  const t = raw.trim();
  if (t.length < CITATION_LABEL_MIN) {
    return `label must be at least ${CITATION_LABEL_MIN} characters.`;
  }
  if (t.length > CITATION_LABEL_MAX) {
    return `label must be at most ${CITATION_LABEL_MAX} characters.`;
  }
  return null;
}

export function validateCitationUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'url is required.';
  const t = raw.trim();
  if (!t) return 'url is required.';
  if (t.length > CITATION_URL_MAX) {
    return `url must be at most ${CITATION_URL_MAX} characters.`;
  }
  let parsed: URL;
  try {
    parsed = new URL(t);
  } catch {
    return 'url must be a valid URL.';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'url must use http or https.';
  }
  return null;
}

export function validateCitationKind(raw: unknown): string | null {
  if (!isExternalCitationKind(raw)) {
    return `kind must be one of: ${EXTERNAL_CITATION_KINDS.join(', ')}.`;
  }
  return null;
}

export function parseOptionalPackageSlug(raw: unknown): {
  value: string | null;
  error: string | null;
} {
  if (raw === undefined || raw === null || raw === '') {
    return { value: null, error: null };
  }
  if (typeof raw !== 'string') {
    return { value: null, error: 'packageSlug must be a string.' };
  }
  const t = raw.trim();
  if (!t) return { value: null, error: null };
  if (t.length > 200) {
    return { value: null, error: 'packageSlug is too long.' };
  }
  return { value: t, error: null };
}
