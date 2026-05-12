import { describe, it, expect } from 'vitest';
import {
  computePackageMaturityFromVersion,
  type VersionMaturityFields,
} from '../src/lib/maturity';
import { computeReadinessFromVersion } from '../src/lib/readiness';

// Fixture: a catalog-seed shaped manifest. It declares `targets.spike` (the
// scaffold ships a Spike extension skeleton) and `execution.testEntry` (an
// assemble-only smoke test), which would otherwise drive the ladder to L4.
const seededShapedVersion: VersionMaturityFields = {
  isa: 'RV64G_Zbkb',
  toolchain: JSON.stringify({ external: true }),
  targets: JSON.stringify({ spike: { entry: 'spike-stub.sh' } }),
  execution: JSON.stringify({ entry: 'examples/run.sh', testEntry: 'tests/run.sh' }),
  resolutionMode: 'host-dependent',
};

describe('computePackageMaturityFromVersion — seeded cap', () => {
  it('returns L4 when portStatus is unspecified (structural signals only)', () => {
    const { level, badges } = computePackageMaturityFromVersion(seededShapedVersion);
    expect(level).toBe(4);
    expect(badges).toContain('Sim: Spike');
    expect(badges).toContain('Tests');
  });

  it('caps level at 1 when portStatus is "seeded"', () => {
    const { level, badges } = computePackageMaturityFromVersion(seededShapedVersion, {
      portStatus: 'seeded',
    });
    expect(level).toBe(1);
    // Badges remain factual — only the aggregate level is capped.
    expect(badges).toContain('Sim: Spike');
    expect(badges).toContain('Tests');
  });

  it('does not cap for other portStatus values', () => {
    for (const ps of ['community_port', 'claimed', 'official', 'archived']) {
      const { level } = computePackageMaturityFromVersion(seededShapedVersion, {
        portStatus: ps,
      });
      expect(level, `portStatus=${ps} should not be capped`).toBe(4);
    }
  });

  it('accepts case-insensitive "seeded"', () => {
    const { level } = computePackageMaturityFromVersion(seededShapedVersion, {
      portStatus: 'SEEDED',
    });
    expect(level).toBe(1);
  });

  it('handles null / undefined portStatus gracefully', () => {
    expect(
      computePackageMaturityFromVersion(seededShapedVersion, { portStatus: null }).level,
    ).toBe(4);
    expect(
      computePackageMaturityFromVersion(seededShapedVersion, { portStatus: undefined }).level,
    ).toBe(4);
  });
});

describe('computeReadinessFromVersion — propagates portStatus', () => {
  const seededWithDeps = {
    ...seededShapedVersion,
    dependencies: null as string | null,
  };

  it('caps readinessLevel at 1 for seeded scaffolds', () => {
    const { readinessLevel, capabilities } = computeReadinessFromVersion(seededWithDeps, {
      portStatus: 'seeded',
    });
    expect(readinessLevel).toBe(1);
    // Capabilities still include the factual badges + entry/testEntry signals.
    expect(capabilities).toContain('Sim: Spike');
    expect(capabilities).toContain('Tests');
    expect(capabilities).toContain('testEntry');
  });

  it('reports L4 when portStatus is absent', () => {
    const { readinessLevel } = computeReadinessFromVersion(seededWithDeps);
    expect(readinessLevel).toBe(4);
  });
});
