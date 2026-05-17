/**
 * Validators for optional implementer identity fields on User (PR-B1).
 */

export const IMPLEMENTER_BIO_MAX = 500;
export const IMPLEMENTER_GITHUB_URL_MAX = 200;

/** https://github.com/<username> — profile root only, no repo paths. */
const GITHUB_PROFILE_RE =
  /^https:\/\/github\.com\/[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?\/?$/;

export function validateImplementerGithubUrl(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'implementerGithubUrl must be a string.';
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.length > IMPLEMENTER_GITHUB_URL_MAX) {
    return `implementerGithubUrl must be at most ${IMPLEMENTER_GITHUB_URL_MAX} characters.`;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'implementerGithubUrl must be a valid URL.';
  }
  if (parsed.protocol !== 'https:') {
    return 'implementerGithubUrl must use https.';
  }
  if (parsed.hostname !== 'github.com') {
    return 'implementerGithubUrl must be a github.com profile URL.';
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 1) {
    return 'implementerGithubUrl must be a GitHub profile URL (https://github.com/<username>), not a repository link.';
  }
  const normalized = `https://github.com/${segments[0]}`;
  if (!GITHUB_PROFILE_RE.test(normalized)) {
    return 'implementerGithubUrl must be a valid GitHub username.';
  }
  return null;
}

/** Returns canonical https://github.com/<user> or null when cleared. */
export function normalizeImplementerGithubUrl(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const err = validateImplementerGithubUrl(trimmed);
  if (err) return null;
  const parsed = new URL(trimmed);
  const login = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  return `https://github.com/${login}`;
}

export function validateImplementerBio(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'implementerBio must be a string.';
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.length > IMPLEMENTER_BIO_MAX) {
    return `implementerBio must be at most ${IMPLEMENTER_BIO_MAX} characters (got ${trimmed.length}).`;
  }
  return null;
}

export function normalizeImplementerBio(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}
