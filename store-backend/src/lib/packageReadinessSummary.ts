import type { Extension, Version } from '@prisma/client';
import { computePackageMaturityFromVersion } from './maturity';
import { sortBySemverDesc } from './semverSort';

/** Semver-latest version row (non-yanked preferred; else highest semver among all). */
export function semverLatestVersion(versions: Version[]): Version | null {
  const nonYanked = versions.filter((v) => !v.isYanked);
  const sorted = sortBySemverDesc(nonYanked);
  if (sorted.length > 0) return sorted[0];
  const fallback = sortBySemverDesc(versions);
  return fallback[0] ?? null;
}

function parseCapabilitiesJson(raw: string | null | undefined): string[] | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const j = JSON.parse(s) as unknown;
    if (!Array.isArray(j)) return null;
    const out = j.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Summary fields for org profile, user profile, and admin package lists.
 * Prefers denormalized `Extension.latestReadinessLevel` + stored `capabilities` on the semver-latest
 * version; falls back to `computePackageMaturityFromVersion` when columns are unset.
 */
export function packageReadinessSummary(
  ext: Pick<Extension, 'latestReadinessLevel' | 'portStatus'>,
  versions: Version[],
): { maturityLevel: number; capabilityBadges: string[] } {
  const latest = semverLatestVersion(versions);
  const fallback = computePackageMaturityFromVersion(latest, { portStatus: ext.portStatus ?? null });

  const extRl = ext.latestReadinessLevel;
  const verRl = latest?.readinessLevel;
  const maturityLevel =
    typeof extRl === 'number'
      ? extRl
      : typeof verRl === 'number'
        ? verRl
        : fallback.level;

  const fromStored = latest ? parseCapabilitiesJson(latest.capabilities) : null;
  const capabilityBadges = fromStored ?? [...fallback.badges];

  return { maturityLevel, capabilityBadges };
}
