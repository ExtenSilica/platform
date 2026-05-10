/**
 * Pure validation + helpers for the `standardStatus` / `authority` pair on an
 * Extension. These two fields express how a package relates to the official
 * RISC-V standard:
 *
 *   - `ratified`  — frozen specification approved by RISC-V International.
 *   - `draft`     — working draft published under RISC-V International or
 *                   another standards body; not yet ratified.
 *   - `vendor`    — custom extension defined and shipped by a commercial vendor.
 *   - `research`  — academic / experimental extension.
 *   - `custom`    — bespoke / one-off extension that does not fit the above.
 *
 * `authority` is free text (e.g. "RISC-V International", "T-Head / XuanTie",
 * "Qualcomm"). It is rendered next to the StandardStatus badge on the package
 * detail page.
 *
 * Both fields are mirrored in `manifest.standardStatus` / `manifest.authority`
 * so a `.xsil` file is self-describing.
 */

export const STANDARD_STATUS_VALUES = [
  'ratified',
  'draft',
  'vendor',
  'research',
  'custom',
] as const;

export type StandardStatus = (typeof STANDARD_STATUS_VALUES)[number];

export const AUTHORITY_MIN = 1;
export const AUTHORITY_MAX = 120;

const STANDARD_STATUS_SET = new Set<string>(STANDARD_STATUS_VALUES);

export function isStandardStatus(value: unknown): value is StandardStatus {
  return typeof value === 'string' && STANDARD_STATUS_SET.has(value);
}

/**
 * Normalize a raw `standardStatus` input. Accepts only known values and
 * coerces case (e.g. "Ratified" → "ratified").
 */
export function normalizeStandardStatus(raw: unknown): StandardStatus | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const lower = raw.trim().toLowerCase();
  return isStandardStatus(lower) ? (lower as StandardStatus) : null;
}

/**
 * Normalize a raw `authority` input. Trims, enforces length, and returns
 * `null` for empty strings so it stores cleanly.
 */
export function normalizeAuthority(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > AUTHORITY_MAX) return trimmed.slice(0, AUTHORITY_MAX);
  return trimmed;
}

/** True iff `authority` text passes basic length validation. */
export function isValidAuthority(value: string): boolean {
  return value.length >= AUTHORITY_MIN && value.length <= AUTHORITY_MAX;
}
