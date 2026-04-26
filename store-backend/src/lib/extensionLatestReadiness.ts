import { prisma } from '../db';
import { computeLatestVersion } from './packageLatestVersion';

/** Denormalize semver-latest version’s `readinessLevel` onto `Extension` for indexed list filters. */
export async function syncExtensionLatestReadiness(extensionId: number): Promise<void> {
  const rows = await prisma.version.findMany({
    where: { extensionId },
    select: { version: true, isYanked: true, readinessLevel: true },
  });

  const latestVer = computeLatestVersion(rows);
  const latestRl =
    latestVer == null ? null : rows.find((r) => r.version === latestVer)?.readinessLevel ?? null;

  await prisma.extension.update({
    where: { id: extensionId },
    data: { latestReadinessLevel: latestRl },
  });
}
