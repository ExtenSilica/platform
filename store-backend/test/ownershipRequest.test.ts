import { describe, it, expect } from 'vitest';
import {
  validateReason,
  validateEvidenceUrl,
  validateDecisionNote,
  isOwnershipRequestStatus,
  isTerminalStatus,
  evaluateEligibility,
  REASON_MIN,
  REASON_MAX,
  DECISION_NOTE_MAX,
} from '../src/lib/ownershipRequest';

describe('validateReason', () => {
  it('accepts a reason with at least the minimum number of characters', () => {
    const reason = 'a'.repeat(REASON_MIN);
    expect(validateReason(reason)).toBeNull();
  });

  it('rejects empty string', () => {
    expect(validateReason('')).toMatch(/at least/);
  });

  it('rejects undefined / non-string', () => {
    expect(validateReason(undefined)).toMatch(/required/);
    expect(validateReason(null)).toMatch(/required/);
    expect(validateReason(42 as unknown)).toMatch(/required/);
  });

  it('rejects when below the minimum after trimming', () => {
    const tooShort = '   ' + 'b'.repeat(REASON_MIN - 5) + '   ';
    expect(validateReason(tooShort)).toMatch(/at least/);
  });

  it('rejects when over the maximum length', () => {
    expect(validateReason('c'.repeat(REASON_MAX + 1))).toMatch(/at most/);
  });
});

describe('validateEvidenceUrl', () => {
  it('treats undefined / null / empty string as valid (optional)', () => {
    expect(validateEvidenceUrl(undefined)).toBeNull();
    expect(validateEvidenceUrl(null)).toBeNull();
    expect(validateEvidenceUrl('')).toBeNull();
    expect(validateEvidenceUrl('   ')).toBeNull();
  });

  it('accepts http and https URLs', () => {
    expect(validateEvidenceUrl('https://github.com/me/proj/commit/deadbeef')).toBeNull();
    expect(validateEvidenceUrl('http://example.com/proof')).toBeNull();
  });

  it('rejects non-http(s) protocols', () => {
    expect(validateEvidenceUrl('ftp://example.com')).toMatch(/http or https/);
    expect(validateEvidenceUrl('javascript:alert(1)')).toMatch(/http or https/);
  });

  it('rejects malformed URLs', () => {
    expect(validateEvidenceUrl('not a url')).toMatch(/valid URL/);
  });

  it('rejects non-string values', () => {
    expect(validateEvidenceUrl(123 as unknown)).toMatch(/string URL/);
  });
});

describe('validateDecisionNote', () => {
  it('treats undefined / null as valid', () => {
    expect(validateDecisionNote(undefined)).toBeNull();
    expect(validateDecisionNote(null)).toBeNull();
  });

  it('accepts strings up to the limit', () => {
    expect(validateDecisionNote('Looks good.')).toBeNull();
    expect(validateDecisionNote('x'.repeat(DECISION_NOTE_MAX))).toBeNull();
  });

  it('rejects strings over the limit', () => {
    expect(validateDecisionNote('x'.repeat(DECISION_NOTE_MAX + 1))).toMatch(/at most/);
  });

  it('rejects non-string values', () => {
    expect(validateDecisionNote(true as unknown)).toMatch(/must be a string/);
  });
});

describe('isOwnershipRequestStatus', () => {
  it('accepts the four canonical statuses', () => {
    expect(isOwnershipRequestStatus('pending')).toBe(true);
    expect(isOwnershipRequestStatus('approved')).toBe(true);
    expect(isOwnershipRequestStatus('rejected')).toBe(true);
    expect(isOwnershipRequestStatus('withdrawn')).toBe(true);
  });

  it('rejects unknown / wrong-typed values', () => {
    expect(isOwnershipRequestStatus('open')).toBe(false);
    expect(isOwnershipRequestStatus('PENDING')).toBe(false);
    expect(isOwnershipRequestStatus('')).toBe(false);
    expect(isOwnershipRequestStatus(undefined)).toBe(false);
    expect(isOwnershipRequestStatus(0 as unknown)).toBe(false);
  });
});

describe('isTerminalStatus', () => {
  it('returns true for non-pending statuses', () => {
    expect(isTerminalStatus('approved')).toBe(true);
    expect(isTerminalStatus('rejected')).toBe(true);
    expect(isTerminalStatus('withdrawn')).toBe(true);
  });

  it('returns false for pending', () => {
    expect(isTerminalStatus('pending')).toBe(false);
  });
});

describe('evaluateEligibility', () => {
  const baseInput = {
    userId: 7,
    packageOwnerId: null as number | null,
    isMaintainer: false,
    hasPendingRequest: false,
    isOrgMember: false,
  };

  it('allows a fresh request when nothing blocks', () => {
    expect(evaluateEligibility(baseInput)).toEqual({ eligible: true });
  });

  it('blocks when the user already owns the package', () => {
    expect(evaluateEligibility({ ...baseInput, packageOwnerId: 7 })).toEqual({
      eligible: false,
      reason: 'You already own this package.',
    });
  });

  it('does NOT trip the owner check when ownerId is set to a different user', () => {
    expect(
      evaluateEligibility({ ...baseInput, packageOwnerId: 99 }),
    ).toEqual({ eligible: true });
  });

  it('blocks when the user is already a maintainer', () => {
    expect(
      evaluateEligibility({ ...baseInput, isMaintainer: true }),
    ).toMatchObject({ eligible: false });
  });

  it('blocks when the user is in the package org', () => {
    expect(
      evaluateEligibility({ ...baseInput, isOrgMember: true }),
    ).toMatchObject({ eligible: false });
  });

  it('blocks when there is already a pending request from this user', () => {
    expect(
      evaluateEligibility({ ...baseInput, hasPendingRequest: true }),
    ).toMatchObject({ eligible: false });
  });

  it('owner check has priority over pending check (more specific wording)', () => {
    const r = evaluateEligibility({
      ...baseInput,
      packageOwnerId: 7,
      hasPendingRequest: true,
    });
    expect(r).toMatchObject({
      eligible: false,
      reason: 'You already own this package.',
    });
  });

  it('orphaned package (ownerId=null) is requestable when nothing else blocks', () => {
    expect(
      evaluateEligibility({ ...baseInput, packageOwnerId: null }),
    ).toEqual({ eligible: true });
  });
});
