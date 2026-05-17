/**
 * Pure validators and state helpers for implementation coordination (Phase C).
 * No database access — controllers and tests import from here.
 */

export type ImplementationRequestVisibility = 'public' | 'org_only' | 'unlisted';

export const IMPLEMENTATION_REQUEST_VISIBILITIES: readonly ImplementationRequestVisibility[] =
  ['public', 'org_only', 'unlisted'];

export type ImplementationRequestStatus =
  | 'draft'
  | 'open'
  | 'in_progress'
  | 'submitted'
  | 'verified'
  | 'completed'
  | 'cancelled';

export const IMPLEMENTATION_REQUEST_STATUSES: readonly ImplementationRequestStatus[] = [
  'draft',
  'open',
  'in_progress',
  'submitted',
  'verified',
  'completed',
  'cancelled',
];

export type ImplementationSubmissionStatus = 'draft' | 'submitted';

export const IMPLEMENTATION_SUBMISSION_STATUSES: readonly ImplementationSubmissionStatus[] = [
  'draft',
  'submitted',
];

export type VerificationRunOutcome = 'pass' | 'fail';

export const VERIFICATION_RUN_OUTCOMES: readonly VerificationRunOutcome[] = ['pass', 'fail'];

export const TITLE_MIN = 5;
export const TITLE_MAX = 200;
export const DESCRIPTION_MIN = 50;
export const DESCRIPTION_MAX = 10000;
export const TARGET_CAPABILITY_MAX = 120;
export const ACCEPTANCE_CRITERIA_MAX = 4000;
export const FUNDING_NOTE_MAX = 2000;
export const FUNDING_EMAIL_MAX = 254;
export const MILESTONE_TITLE_MIN = 3;
export const MILESTONE_TITLE_MAX = 200;
export const MILESTONE_DESCRIPTION_MAX = 2000;
export const SUBMISSION_SUMMARY_MIN = 50;
export const SUBMISSION_SUMMARY_MAX = 10000;
export const INTEREST_MESSAGE_MAX = 500;
export const VERIFICATION_NOTES_MAX = 4000;
export const URL_MAX = 2000;

/** Keys that must never appear in implementation-request API bodies. */
export const FORBIDDEN_MONEY_KEYS = [
  'amount',
  'currency',
  'wallet',
  'txhash',
  'payout',
  'escrow',
  'usdc',
  'funded',
  'paid',
] as const;

const REQUEST_TRANSITIONS: Record<
  ImplementationRequestStatus,
  readonly ImplementationRequestStatus[]
> = {
  draft: ['open', 'cancelled'],
  open: ['in_progress', 'cancelled'],
  in_progress: ['submitted', 'cancelled'],
  submitted: ['verified', 'cancelled'],
  verified: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

/**
 * Reject API bodies that carry structured payment fields (off-platform funding
 * uses fundingContactEmail + fundingNote only).
 */
export function rejectStructuredMoney(body: Record<string, unknown>): string | null {
  const keys: string[] = [];
  collectObjectKeys(body, keys);
  for (const key of keys) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_MONEY_KEYS.includes(lower as (typeof FORBIDDEN_MONEY_KEYS)[number])) {
      return `Field "${key}" is not allowed on implementation requests (no on-platform payments).`;
    }
  }
  return null;
}

function collectObjectKeys(value: unknown, out: string[]): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, out);
    return;
  }
  if (typeof value !== 'object') return;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out.push(k);
    collectObjectKeys(v, out);
  }
}

export function isImplementationRequestVisibility(
  raw: unknown,
): raw is ImplementationRequestVisibility {
  return (
    typeof raw === 'string' &&
    (IMPLEMENTATION_REQUEST_VISIBILITIES as readonly string[]).includes(raw)
  );
}

export function isImplementationRequestStatus(
  raw: unknown,
): raw is ImplementationRequestStatus {
  return (
    typeof raw === 'string' &&
    (IMPLEMENTATION_REQUEST_STATUSES as readonly string[]).includes(raw)
  );
}

export function isImplementationSubmissionStatus(
  raw: unknown,
): raw is ImplementationSubmissionStatus {
  return (
    typeof raw === 'string' &&
    (IMPLEMENTATION_SUBMISSION_STATUSES as readonly string[]).includes(raw)
  );
}

export function isVerificationRunOutcome(raw: unknown): raw is VerificationRunOutcome {
  return (
    typeof raw === 'string' && (VERIFICATION_RUN_OUTCOMES as readonly string[]).includes(raw)
  );
}

export function isTerminalRequestStatus(status: ImplementationRequestStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

export function validateRequestStatusTransition(
  from: ImplementationRequestStatus,
  to: ImplementationRequestStatus,
): string | null {
  if (from === to) return null;
  const allowed = REQUEST_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    return `Cannot transition request from "${from}" to "${to}".`;
  }
  return null;
}

export function validateTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'title is required.';
  const trimmed = raw.trim();
  if (trimmed.length < TITLE_MIN) {
    return `title must be at least ${TITLE_MIN} characters (got ${trimmed.length}).`;
  }
  if (trimmed.length > TITLE_MAX) {
    return `title must be at most ${TITLE_MAX} characters.`;
  }
  return null;
}

export function validateDescription(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'description is required.';
  const trimmed = raw.trim();
  if (trimmed.length < DESCRIPTION_MIN) {
    return `description must be at least ${DESCRIPTION_MIN} characters (got ${trimmed.length}).`;
  }
  if (trimmed.length > DESCRIPTION_MAX) {
    return `description must be at most ${DESCRIPTION_MAX} characters.`;
  }
  return null;
}

export function validateVisibility(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (!isImplementationRequestVisibility(raw)) {
    return `visibility must be one of: ${IMPLEMENTATION_REQUEST_VISIBILITIES.join(', ')}.`;
  }
  return null;
}

export function validateOptionalShortText(
  raw: unknown,
  field: string,
  max: number,
): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return `${field} must be a string.`;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.length > max) {
    return `${field} must be at most ${max} characters.`;
  }
  return null;
}

export function validateFundingContactEmail(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'fundingContactEmail must be a string.';
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.length > FUNDING_EMAIL_MAX) {
    return `fundingContactEmail must be at most ${FUNDING_EMAIL_MAX} characters.`;
  }
  if (!trimmed.includes('@')) {
    return 'fundingContactEmail must look like an email address.';
  }
  return null;
}

export function validateHttpsUrl(raw: unknown, field: string): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return `${field} must be a string URL.`;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.length > URL_MAX) {
    return `${field} must be at most ${URL_MAX} characters.`;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return `${field} must be a valid URL.`;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `${field} must use http or https.`;
  }
  return null;
}

export function parseCreatedByOrgId(
  raw: unknown,
): { value: number | null; error: string | null } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: null, error: null };
  }
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n <= 0) {
    return { value: null, error: 'createdByOrgId must be a positive integer.' };
  }
  return { value: n, error: null };
}

export function parsePositiveInt(
  raw: unknown,
  field: string,
): { value: number | null; error: string | null } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: null, error: null };
  }
  const n =
    typeof raw === 'number' && Number.isInteger(raw)
      ? raw
      : Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n <= 0) {
    return { value: null, error: `${field} must be a positive integer.` };
  }
  return { value: n, error: null };
}

export function validateMilestoneTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'title is required.';
  const trimmed = raw.trim();
  if (trimmed.length < MILESTONE_TITLE_MIN) {
    return `title must be at least ${MILESTONE_TITLE_MIN} characters.`;
  }
  if (trimmed.length > MILESTONE_TITLE_MAX) {
    return `title must be at most ${MILESTONE_TITLE_MAX} characters.`;
  }
  return null;
}

export function validateSubmissionSummary(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'summary is required.';
  const trimmed = raw.trim();
  if (trimmed.length < SUBMISSION_SUMMARY_MIN) {
    return `summary must be at least ${SUBMISSION_SUMMARY_MIN} characters (got ${trimmed.length}).`;
  }
  if (trimmed.length > SUBMISSION_SUMMARY_MAX) {
    return `summary must be at most ${SUBMISSION_SUMMARY_MAX} characters.`;
  }
  return null;
}

export function validateInterestMessage(raw: unknown): string | null {
  return validateOptionalShortText(raw, 'message', INTEREST_MESSAGE_MAX);
}
