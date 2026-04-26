/**
 * Readiness + capabilities — canonical backend utility.
 *
 * This is the backend counterpart to the UI/CLI notion of:
 * - Readiness Level (RL)
 * - Capabilities (facts derived from registry-stored manifest echoes)
 *
 * Notes:
 * - Today we use RL 1–5 as an evaluable ladder (same numbers as the existing maturity ladder).
 * - RL6/RL7 are reserved for future explicit evidence schema (do not infer from targets alone).
 */
import type { Version } from '@prisma/client';
import { computePackageMaturityFromVersion } from './maturity';

export type ReadinessLevel = 1 | 2 | 3 | 4 | 5;

export type Capability =
  | 'ISA'
  | 'entry'
  | 'testEntry'
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

export type VersionReadinessFields = Pick<
  Version,
  'isa' | 'toolchain' | 'targets' | 'resolutionMode' | 'execution' | 'dependencies'
>;

export function computeReadinessFromVersion(
  v: VersionReadinessFields | null | undefined,
): { readinessLevel: ReadinessLevel; capabilities: Capability[] } {
  if (!v) return { readinessLevel: 1, capabilities: [] };

  // Reuse the already synced badge logic as the base capability set.
  const m = computePackageMaturityFromVersion({
    isa: v.isa,
    toolchain: v.toolchain,
    targets: v.targets,
    resolutionMode: v.resolutionMode,
    execution: v.execution,
  });

  const caps = new Set<Capability>(m.badges as Capability[]);

  // Add entry/testEntry as explicit capabilities.
  const exec = safeParseJsonObject(v.execution ?? null);
  if (exec && typeof exec.entry === 'string' && exec.entry.trim()) caps.add('entry');
  if (exec && typeof exec.testEntry === 'string' && exec.testEntry.trim()) caps.add('testEntry');

  // Keep readinessLevel aligned with current RL=level (1–5).
  const readinessLevel = m.level as ReadinessLevel;

  return { readinessLevel, capabilities: Array.from(caps) };
}

