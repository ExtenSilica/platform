/**
 * Pure validators for the ownership-request flow.
 *
 * These functions never touch the database. The controller pulls them in for
 * input validation; the unit tests in `test/ownershipRequest.test.ts` exercise
 * them directly with no fixtures.
 */

export type OwnershipRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export const OWNERSHIP_REQUEST_STATUSES: readonly OwnershipRequestStatus[] = [
  'pending',
  'approved',
  'rejected',
  'withdrawn',
];

export const REASON_MIN = 50;
export const REASON_MAX = 2000;
export const DECISION_NOTE_MAX = 1000;
export const EVIDENCE_URL_MAX = 2000;

/**
 * Returns null when valid, or a human-readable string explaining what's wrong.
 */
export function validateReason(raw: unknown): string | null {
  if (typeof raw !== 'string') return 'Reason is required.';
  const trimmed = raw.trim();
  if (trimmed.length < REASON_MIN) {
    return `Reason must be at least ${REASON_MIN} characters (got ${trimmed.length}).`;
  }
  if (trimmed.length > REASON_MAX) {
    return `Reason must be at most ${REASON_MAX} characters (got ${trimmed.length}).`;
  }
  return null;
}

/** Optional, but if provided must be a valid http(s) URL. */
export function validateEvidenceUrl(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'evidenceUrl must be a string URL.';
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (trimmed.length > EVIDENCE_URL_MAX) {
    return `evidenceUrl must be at most ${EVIDENCE_URL_MAX} characters.`;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'evidenceUrl must be a valid URL.';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'evidenceUrl must use http or https.';
  }
  return null;
}

export function validateDecisionNote(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'decisionNote must be a string.';
  if (raw.length > DECISION_NOTE_MAX) {
    return `decisionNote must be at most ${DECISION_NOTE_MAX} characters.`;
  }
  return null;
}

export function isOwnershipRequestStatus(
  raw: unknown,
): raw is OwnershipRequestStatus {
  return (
    typeof raw === 'string' &&
    (OWNERSHIP_REQUEST_STATUSES as readonly string[]).includes(raw)
  );
}

/** A request is closed once it has a non-pending status. */
export function isTerminalStatus(status: string): boolean {
  return status !== 'pending';
}

export type EligibilityInput = {
  /** Currently authenticated user. */
  userId: number;
  /** Package owner (may be null for orphaned packages). */
  packageOwnerId: number | null;
  /** True when the user is already a maintainer (owner or maintainer role). */
  isMaintainer: boolean;
  /** True when the user has any pending request for this package. */
  hasPendingRequest: boolean;
  /** True when the package is published under an org and the user is a member. */
  isOrgMember: boolean;
};

export type Eligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Pure decision: can this user open a fresh ownership request for this package?
 * Used both as a guard in the create-request endpoint and as a signal sent to
 * the frontend so it can hide/disable the "Request ownership" button.
 */
export function evaluateEligibility(input: EligibilityInput): Eligibility {
  if (input.packageOwnerId !== null && input.packageOwnerId === input.userId) {
    return {
      eligible: false,
      reason: 'You already own this package.',
    };
  }
  if (input.isMaintainer) {
    return {
      eligible: false,
      reason: 'You are already a maintainer of this package.',
    };
  }
  if (input.isOrgMember) {
    return {
      eligible: false,
      reason: 'This package belongs to an organization you are a member of.',
    };
  }
  if (input.hasPendingRequest) {
    return {
      eligible: false,
      reason: 'You already have a pending ownership request for this package.',
    };
  }
  return { eligible: true };
}
