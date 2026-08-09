import { describe, expect, it } from 'vitest';
import { extractManifestPorts, portRewardForTargetKind } from '../src/lib/ports';

describe('extractManifestPorts', () => {
  it('turns evidence-backed working targets into verified Ports', () => {
    const ports = extractManifestPorts(JSON.stringify({
      spike: { status: 'working', tests: '42/42' },
      qemu: { status: 'working' },
    }));

    expect(ports).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetSlug: 'spike',
        targetName: 'Spike',
        verificationStatus: 'verified',
        testSummary: '42/42',
      }),
      expect.objectContaining({
        targetSlug: 'qemu',
        verificationStatus: 'declared',
      }),
    ]));
  });

  it('normalizes backend-specific names to their concrete Target', () => {
    const ports = extractManifestPorts(JSON.stringify({
      'cva6-cvxif': { build: 'Passed', tests: '1200/1200' },
      'rocket-rocc': { build: 'Passed' },
    }));

    expect(ports).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetSlug: 'cva6', verificationStatus: 'tested' }),
      expect.objectContaining({ targetSlug: 'rocket', verificationStatus: 'built' }),
    ]));
  });

  it('returns no candidates for malformed targets JSON', () => {
    expect(extractManifestPorts('{not json')).toEqual([]);
  });

  it('assigns larger deterministic rewards to hardware targets', () => {
    expect(portRewardForTargetKind('simulator')).toBe(500);
    expect(portRewardForTargetKind('core')).toBe(1500);
    expect(portRewardForTargetKind('board')).toBe(2000);
  });
});
