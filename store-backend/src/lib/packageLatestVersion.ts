import * as semver from 'semver';

/**
 * Highest non-yanked semver from version rows; if all yanked, highest semver among all.
 * Matches `packagesController` / registry “latest” semantics.
 */
export function computeLatestVersion(
  versions: Array<{ version: string; isYanked: boolean }>,
): string | null {
  const valid = (v: string) => semver.valid(v) !== null;
  const rcompare = (a: string, b: string) => semver.rcompare(a, b);

  const active = versions.filter((v) => !v.isYanked && valid(v.version));
  if (active.length > 0) {
    return active.sort((a, b) => rcompare(a.version, b.version))[0].version;
  }

  const all = versions.filter((v) => valid(v.version));
  if (all.length > 0) {
    return all.sort((a, b) => rcompare(a.version, b.version))[0].version;
  }

  return null;
}
