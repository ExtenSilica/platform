import { describe, it, expect } from 'vitest';
import {
  PORT_STATUS_VALUES,
  isPortStatus,
  normalizePortStatus,
  portStatusAfterOwnershipClaim,
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
