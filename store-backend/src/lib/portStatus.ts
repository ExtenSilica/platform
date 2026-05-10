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
