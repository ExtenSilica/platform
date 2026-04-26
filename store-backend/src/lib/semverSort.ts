import * as semver from 'semver';

/**
 * Sort versions by semver descending (newest first).
 * Versions that are not valid semver strings are placed at the end.
 */
export function sortBySemverDesc<T extends { version: string }>(versions: T[]): T[] {
  return [...versions].sort((a, b) => {
    const av = semver.valid(a.version);
    const bv = semver.valid(b.version);
    if (av && bv) return semver.rcompare(av, bv);
    if (av) return -1;
    if (bv) return 1;
    return a.version.localeCompare(b.version);
  });
}
