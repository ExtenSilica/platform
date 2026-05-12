/**
 * Package maturity / capability badges — keep in sync with
 * store-frontend/lib/xsil-parser.ts `computeCapabilityBadges`.
 */
import type { Version } from '@prisma/client';

export type PackageMaturityLevel = 1 | 2 | 3 | 4 | 5;

export type CapabilityBadge =
  | 'ISA'
  | 'Repro: bundled'
  | 'Repro: resolved'
  | 'Repro: host-dependent'
  | 'Toolchain: bundled'
  | 'Toolchain: external'
  | 'Sim: Spike'
  | 'Emu: QEMU'
  | 'FPGA'
  | 'RTL'
  | 'Tests';

function safeParseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === 'object' && !Array.isArray(j)) return j as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function toolchainExternalFlag(toolchain: string | null | undefined): boolean | null {
  if (!toolchain) return null;
  const trim = toolchain.trim();
  if (trim.startsWith('{') && trim.endsWith('}')) {
    const o = safeParseJsonObject(trim);
    if (o && typeof o.external === 'boolean') return o.external;
    return null;
  }
  return null;
}

/** True when manifest execution declares a test entry point. */
export function executionIndicatesTests(executionRaw: string | null | undefined): boolean {
  const o = safeParseJsonObject(executionRaw ?? null);
  if (!o) return false;
  if (typeof o.testEntry === 'string' && o.testEntry.trim()) return true;
  if (typeof o.tests === 'string' && o.tests.trim()) return true;
  return false;
}

export type VersionMaturityFields = Pick<
  Version,
  'isa' | 'toolchain' | 'targets' | 'resolutionMode' | 'execution'
>;

/**
 * Optional package-level signals that influence the *aggregate* maturity level,
 * but not the capability badge list. Today the only signal is `portStatus`:
 * a `"seeded"` package is, by construction, a spec-derived scaffold (the
 * catalog-seed agent ships a Spike skeleton with `// TODO` handlers and an
 * assemble-only smoke test). The structural presence of `targets.spike` and
 * `execution.testEntry` would otherwise mislead the ladder into L4 ("Tests"),
 * which is dishonest. We cap the level at 1 for seeded packages so the badge
 * matches the actual readiness of the code, and let badges remain factual.
 */
export interface PackageMaturityOpts {
  portStatus?: string | null;
}

export function computePackageMaturityFromVersion(
  v: VersionMaturityFields | null | undefined,
  opts?: PackageMaturityOpts,
): { badges: CapabilityBadge[]; level: PackageMaturityLevel } {
  if (!v) {
    return { badges: [], level: 1 };
  }

  const badges: CapabilityBadge[] = [];
  const input = {
    isa: v.isa,
    targetsRaw: v.targets,
    resolutionMode: v.resolutionMode,
    hasTests: executionIndicatesTests(v.execution),
  };

  if (input.isa?.trim()) badges.push('ISA');

  const tcExternal = toolchainExternalFlag(v.toolchain ?? null);
  if (tcExternal === true) badges.push('Toolchain: external');
  else if (tcExternal === false) badges.push('Toolchain: bundled');

  const targetsObj = safeParseJsonObject(input.targetsRaw ?? null);
  const keys = targetsObj ? Object.keys(targetsObj) : [];
  if (keys.includes('spike')) badges.push('Sim: Spike');
  if (keys.includes('qemu')) badges.push('Emu: QEMU');
  if (keys.includes('fpga')) badges.push('FPGA');
  if (keys.includes('rtl')) badges.push('RTL');

  if (input.hasTests) badges.push('Tests');

  const rm = (input.resolutionMode ?? '').trim().toLowerCase();
  if (rm === 'bundled') badges.push('Repro: bundled');
  else if (rm === 'resolved') badges.push('Repro: resolved');
  else if (rm === 'host-dependent' || rm === 'host_dependent' || rm === 'hostdependent') {
    badges.push('Repro: host-dependent');
  } else if (tcExternal === true) {
    badges.push('Repro: host-dependent');
  }

  const hasSim = keys.includes('spike') || keys.includes('qemu');
  const hasHw = keys.includes('fpga') || keys.includes('rtl');
  const bundledToolchain = tcExternal === false;

  let level: PackageMaturityLevel = 1;
  if (hasSim) level = 2;
  if (level >= 2 && bundledToolchain) level = 3;
  if (level >= 2 && input.hasTests) level = 4;
  if (hasHw && level >= 2) level = 5;

  // Seeded packages are spec-derived scaffolds. The ladder reads structural
  // signals (declared targets, declared testEntry) it cannot semantically
  // validate; for catalog-seed publishes those signals point at TODO handlers
  // and assemble-only checks, so cap the level to keep the badge honest.
  const portStatus = (opts?.portStatus ?? '').toLowerCase();
  if (portStatus === 'seeded') {
    level = 1;
  }

  return { badges, level };
}
