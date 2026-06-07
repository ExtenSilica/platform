import { describe, it, expect } from 'vitest';
import {
  PORT_STATUS_VALUES,
  isPortStatus,
  normalizePortStatus,
  portStatusAfterOwnershipClaim,
  evaluatePortStatusPatch,
  validatePortStatusDecisionNote,
  autoPromotePortStatusOnPublish,
  PORT_STATUS_DECISION_NOTE_MIN,
  type PortStatus,
} from '../src/lib/portStatus';

describe('PORT_STATUS_VALUES', () => {
  it('exposes the five canonical values in stable order', () => {
    expect(PORT_STATUS_VALUES).toEqual([
      'seeded',
      'community_port',
      'claimed',
      'official',
      'archived',
    ]);
  });
});

describe('isPortStatus', () => {
  it('accepts every canonical value', () => {
    for (const v of PORT_STATUS_VALUES) {
      expect(isPortStatus(v)).toBe(true);
    }
  });

  it('rejects unknown / wrong-type values', () => {
    expect(isPortStatus(undefined)).toBe(false);
    expect(isPortStatus(null)).toBe(false);
    expect(isPortStatus('verified')).toBe(false);
    expect(isPortStatus('community-port')).toBe(false); // hyphenated alias is NOT canonical
    expect(isPortStatus(42 as unknown)).toBe(false);
  });
});

describe('normalizePortStatus', () => {
  it('lower-cases and accepts the hyphenated `community-port` alias', () => {
    expect(normalizePortStatus(' Seeded ')).toBe('seeded');
    expect(normalizePortStatus('Community-Port')).toBe('community_port');
    expect(normalizePortStatus('community-port')).toBe('community_port');
    expect(normalizePortStatus('OFFICIAL')).toBe('official');
  });

  it('returns null for unknown / falsy input', () => {
    expect(normalizePortStatus('')).toBe(null);
    expect(normalizePortStatus('  ')).toBe(null);
    expect(normalizePortStatus('unverified')).toBe(null);
    expect(normalizePortStatus(undefined)).toBe(null);
    expect(normalizePortStatus(null)).toBe(null);
    expect(normalizePortStatus(123 as unknown)).toBe(null);
  });
});

describe('portStatusAfterOwnershipClaim', () => {
  it('collapses seeded / community_port to claimed', () => {
    expect(portStatusAfterOwnershipClaim('seeded')).toBe('claimed');
    expect(portStatusAfterOwnershipClaim('community_port')).toBe('claimed');
  });

  it('defaults null (legacy / self-published) to claimed', () => {
    expect(portStatusAfterOwnershipClaim(null)).toBe('claimed');
  });

  it('preserves stronger statuses (official, archived)', () => {
    expect(portStatusAfterOwnershipClaim('official' as PortStatus)).toBe('official');
    expect(portStatusAfterOwnershipClaim('archived' as PortStatus)).toBe('archived');
  });

  it('leaves an already-claimed package as claimed', () => {
    expect(portStatusAfterOwnershipClaim('claimed' as PortStatus)).toBe('claimed');
  });
});

describe('validatePortStatusDecisionNote', () => {
  it('requires a note when marking official', () => {
    expect(validatePortStatusDecisionNote(undefined, true)).toMatch(/required/);
    expect(validatePortStatusDecisionNote('short', true)).toMatch(/at least/);
    expect(validatePortStatusDecisionNote('a'.repeat(PORT_STATUS_DECISION_NOTE_MIN), true)).toBeNull();
  });
});

describe('evaluatePortStatusPatch', () => {
  const adminId = 42;

  it('blocks non-admins from setting official', () => {
    const result = evaluatePortStatusPatch({
      userIsPlatformAdmin: false,
      userIsOwner: true,
      current: 'claimed',
      rawPortStatus: 'official',
      decisionNoteRaw: 'a'.repeat(PORT_STATUS_DECISION_NOTE_MIN),
      decidedByUserId: adminId,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it('requires portStatusDecisionNote when admin sets official', () => {
    const missing = evaluatePortStatusPatch({
      userIsPlatformAdmin: true,
      userIsOwner: false,
      current: 'claimed',
      rawPortStatus: 'official',
      decisionNoteRaw: undefined,
      decidedByUserId: adminId,
    });
    expect(missing.ok).toBe(false);

    const ok = evaluatePortStatusPatch({
      userIsPlatformAdmin: true,
      userIsOwner: false,
      current: 'claimed',
      rawPortStatus: 'official',
      decisionNoteRaw: 'Verified upstream maintainer identity via org email.',
      decidedByUserId: adminId,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.patch.portStatus).toBe('official');
      expect(ok.patch.portStatusDecisionNote).toContain('Verified');
      expect(ok.patch.portStatusDecidedById).toBe(adminId);
      expect(ok.patch.portStatusDecidedAt).toBeInstanceOf(Date);
    }
  });

  it('lets owners archive without a decision note', () => {
    const result = evaluatePortStatusPatch({
      userIsPlatformAdmin: false,
      userIsOwner: true,
      current: 'claimed',
      rawPortStatus: 'archived',
      decisionNoteRaw: undefined,
      decidedByUserId: 1,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.portStatus).toBe('archived');
      expect(result.patch.portStatusDecisionNote).toBeNull();
    }
  });

  it('clears audit fields when admin clears portStatus', () => {
    const result = evaluatePortStatusPatch({
      userIsPlatformAdmin: true,
      userIsOwner: false,
      current: 'official',
      rawPortStatus: null,
      decisionNoteRaw: undefined,
      decidedByUserId: adminId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.portStatus).toBeNull();
      expect(result.patch.portStatusDecisionNote).toBeNull();
    }
  });
});

describe('autoPromotePortStatusOnPublish', () => {
  it('promotes seeded -> community_port when a non-bot user publishes', () => {
    expect(autoPromotePortStatusOnPublish('seeded', false)).toBe('community_port');
  });

  it('does NOT promote when the catalog-seed bot itself re-publishes a seeded row', () => {
    expect(autoPromotePortStatusOnPublish('seeded', true)).toBeNull();
  });

  it('returns null (no change) for any non-seeded state, regardless of publisher', () => {
    const others: (PortStatus | null)[] = [null, 'community_port', 'claimed', 'official', 'archived'];
    for (const s of others) {
      expect(autoPromotePortStatusOnPublish(s, false)).toBeNull();
      expect(autoPromotePortStatusOnPublish(s, true)).toBeNull();
    }
  });
});
