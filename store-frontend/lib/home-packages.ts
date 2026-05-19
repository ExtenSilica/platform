import type { RegistryPackage, StandardStatus } from "@/lib/types";
const HOME_STATUS_PRIORITY: StandardStatus[] = [
  "ratified",
  "vendor",
  "research",
  "draft",
  "custom",
];

/** Pick up to `count` packages with varied standardStatus for the home grid. */
export function pickDiverseHomePackages(
  all: RegistryPackage[],
  count = 6,
): RegistryPackage[] {
  if (all.length <= count) return all;

  const picked: RegistryPackage[] = [];
  const usedIds = new Set<number>();

  for (const status of HOME_STATUS_PRIORITY) {
    const match = all.find(
      (p) => p.standardStatus === status && !usedIds.has(p.id),
    );
    if (match) {
      picked.push(match);
      usedIds.add(match.id);
    }
    if (picked.length >= count) break;
  }

  for (const p of all) {
    if (picked.length >= count) break;
    if (!usedIds.has(p.id)) {
      picked.push(p);
      usedIds.add(p.id);
    }
  }

  return picked.slice(0, count);
}
