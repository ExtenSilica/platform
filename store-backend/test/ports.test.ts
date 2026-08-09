import { describe, expect, it } from 'vitest';
import { extractManifestPorts, portRewardForTargetKind, resolvePortBackend } from '../src/lib/ports';

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
      expect.objectContaining({
        targetSlug: 'cva6',
        backendSlug: 'cvxif',
        backendName: 'CV-X-IF',
        verificationStatus: 'tested',
      }),
      expect.objectContaining({
        targetSlug: 'rocket',
        backendSlug: 'rocc',
        backendName: 'RoCC',
        verificationStatus: 'built',
      }),
    ]));
  });

  it('keeps multiple backends on the same Target as separate Ports', () => {
    const ports = extractManifestPorts(JSON.stringify({
      cva6: { status: 'built' },
      'cva6-cvxif': { status: 'working', tests: '10/10' },
    }));

    expect(ports.filter((port) => port.targetSlug === 'cva6')).toHaveLength(2);
    expect(ports.map((port) => port.backendSlug)).toEqual(expect.arrayContaining(['default', 'cvxif']));
  });

  it('uses known interfaces for new core implementation requests', () => {
    expect(resolvePortBackend({ targetSlug: 'neorv32' })).toEqual({
      backendSlug: 'cfu',
      backendName: 'CFU',
    });
    expect(resolvePortBackend({ targetSlug: 'custom-core', backendName: 'My Bus' })).toEqual({
      backendSlug: 'my-bus',
      backendName: 'My Bus',
    });
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
