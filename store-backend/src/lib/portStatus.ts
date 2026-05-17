/**
 * Pure validation + helpers for the `portStatus` field on an Extension.
 *
 * `portStatus` is ORTHOGONAL to `standardStatus`:
 *
 *   - `standardStatus` (ratified | draft | vendor | research | custom)
 *     describes the SPEC.
 *   - `portStatus` (seeded | community_port | claimed | official | archived)
 *     describes the PROVENANCE of the package on ExtenSilica — who put it
 *     here, and whether the upstream maintainer has blessed it.
 *
 * The field is always SERVER-SET. We deliberately do NOT read it from the
 * uploaded `manifest.json` — otherwise a publisher could lie about being
 * the official maintainer.
 *
 * Default transitions (see `packagesController` + `ownershipRequestsController`):
 *
 *   - catalog-seed bot publishes  → `seeded`
 *   - regular user creates new    → null (unmarked / self-published)
 *   - new user publishes on top
 *     of an existing `seeded` row → `community_port`
 *   - OwnershipRequest approved
 *     on `seeded` / `community_port`→ `claimed`
 *   - admin marks                  → `official` (requires identity check)
 *   - owner / admin freezes        → `archived`
 */

export const PORT_STATUS_VALUES = [
  'seeded',
  'community_port',
  'claimed',
  'official',
  'archived',
] as const;

export type PortStatus = (typeof PORT_STATUS_VALUES)[number];

const PORT_STATUS_SET = new Set<string>(PORT_STATUS_VALUES);

export function isPortStatus(value: unknown): value is PortStatus {
  return typeof value === 'string' && PORT_STATUS_SET.has(value);
}

/**
 * Normalize a raw `portStatus` input (accepts admin write requests). Coerces
 * case, accepts hyphenated alternative `community-port`, returns null when
 * the value is unknown.
 */
export function normalizePortStatus(raw: unknown): PortStatus | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const lower = raw.trim().toLowerCase().replace(/-/g, '_');
  return isPortStatus(lower) ? (lower as PortStatus) : null;
}

/**
 * After an OwnershipRequest is approved, decide what to flip `portStatus`
 * to. Stays `official` / `archived` (those are stronger statements);
 * everything else collapses to `claimed`.
 */
export function portStatusAfterOwnershipClaim(
  current: PortStatus | null,
): PortStatus {
  if (current === 'official' || current === 'archived') return current;
  return 'claimed';
}

export const PORT_STATUS_DECISION_NOTE_MIN = 10;
export const PORT_STATUS_DECISION_NOTE_MAX = 1000;

/** Statuses that only a platform admin may assign (except owner may set `archived`). */
export const ADMIN_ONLY_PORT_STATUSES: readonly PortStatus[] = [
  'seeded',
  'community_port',
  'claimed',
  'official',
];

export function validatePortStatusDecisionNote(
  raw: unknown,
  required: boolean,
): string | null {
  if (raw === undefined || raw === null) {
    return required ? 'portStatusDecisionNote is required when setting portStatus to official.' : null;
  }
  if (typeof raw !== 'string') return 'portStatusDecisionNote must be a string.';
  const trimmed = raw.trim();
  if (!required && trimmed === '') return null;
  if (trimmed.length < PORT_STATUS_DECISION_NOTE_MIN) {
    return `portStatusDecisionNote must be at least ${PORT_STATUS_DECISION_NOTE_MIN} characters.`;
  }
  if (trimmed.length > PORT_STATUS_DECISION_NOTE_MAX) {
    return `portStatusDecisionNote must be at most ${PORT_STATUS_DECISION_NOTE_MAX} characters.`;
  }
  return null;
}

export type PortStatusAuditPatch = {
  portStatus: PortStatus | null;
  portStatusDecisionNote: string | null;
  portStatusDecidedById: number | null;
  portStatusDecidedAt: Date | null;
};

export type EvaluatePortStatusPatchInput = {
  userIsPlatformAdmin: boolean;
  userIsOwner: boolean;
  current: PortStatus | null;
  rawPortStatus: unknown;
  decisionNoteRaw: unknown;
  decidedByUserId: number;
};

export type EvaluatePortStatusPatchResult =
  | { ok: true; patch: PortStatusAuditPatch }
  | { ok: false; error: string; status: 400 | 403 };

/**
 * Validates a requested `portStatus` change. Owners may only archive; admins may
 * set any value but must supply `portStatusDecisionNote` when marking `official`.
 */
export function evaluatePortStatusPatch(
  input: EvaluatePortStatusPatchInput,
): EvaluatePortStatusPatchResult {
  const { userIsPlatformAdmin, userIsOwner, current, rawPortStatus, decisionNoteRaw, decidedByUserId } =
    input;

  if (rawPortStatus === null || rawPortStatus === '') {
    if (!userIsPlatformAdmin) {
      return {
        ok: false,
        status: 403,
        error: 'Only platform admins may clear portStatus.',
      };
    }
    return {
      ok: true,
      patch: {
        portStatus: null,
        portStatusDecisionNote: null,
        portStatusDecidedById: null,
        portStatusDecidedAt: null,
      },
    };
  }

  const normalized = normalizePortStatus(rawPortStatus);
  if (normalized === null) {
    return {
      ok: false,
      status: 400,
      error: `portStatus must be one of: ${PORT_STATUS_VALUES.join(', ')}.`,
    };
  }

  if (!userIsPlatformAdmin) {
    if (!userIsOwner || normalized !== 'archived') {
      return {
        ok: false,
        status: 403,
        error:
          'Only platform admins may change portStatus (except `archived`, which the owner may set).',
      };
    }
    return {
      ok: true,
      patch: {
        portStatus: normalized,
        portStatusDecisionNote: null,
        portStatusDecidedById: null,
        portStatusDecidedAt: null,
      },
    };
  }

  if (normalized === 'official') {
    const noteErr = validatePortStatusDecisionNote(decisionNoteRaw, true);
    if (noteErr) return { ok: false, status: 400, error: noteErr };
    const note =
      typeof decisionNoteRaw === 'string' ? decisionNoteRaw.trim() : '';
    return {
      ok: true,
      patch: {
        portStatus: 'official',
        portStatusDecisionNote: note,
        portStatusDecidedById: decidedByUserId,
        portStatusDecidedAt: new Date(),
      },
    };
  }

  const noteErr = validatePortStatusDecisionNote(decisionNoteRaw, false);
  if (noteErr) return { ok: false, status: 400, error: noteErr };

  return {
    ok: true,
    patch: {
      portStatus: normalized,
      portStatusDecisionNote: null,
      portStatusDecidedById: null,
      portStatusDecidedAt: null,
    },
  };
}

/** Verification of implementation work must never change package provenance. */
export function assertVerificationDoesNotAlterPortStatus(): void {
  // Documented guard for code review — call sites must not patch Extension.portStatus
  // from implementation-request verification flows (see implementation-plan PR-C4).
}
