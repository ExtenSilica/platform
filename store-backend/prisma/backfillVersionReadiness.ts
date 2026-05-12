/**
 * Backfill Version.readinessLevel + Version.capabilities for existing rows.
 *
 * Run from store-backend:
 *   npx ts-node prisma/backfillVersionReadiness.ts
 */
import 'dotenv/config';
import { prisma } from '../src/db';
import { computeReadinessFromVersion } from '../src/lib/readiness';
import { syncExtensionLatestReadiness } from '../src/lib/extensionLatestReadiness';

async function main() {
  const versions = await prisma.version.findMany({
    select: {
      id: true,
      isa: true,
      toolchain: true,
      targets: true,
      execution: true,
      dependencies: true,
      resolutionMode: true,
      extension: { select: { portStatus: true } },
    },
  });

  let updated = 0;
  for (const v of versions) {
    const { readinessLevel, capabilities } = computeReadinessFromVersion(v, {
      portStatus: v.extension?.portStatus ?? null,
    });
    await prisma.version.update({
      where: { id: v.id },
      data: {
        readinessLevel,
        capabilities: JSON.stringify(capabilities),
      },
    });
    updated += 1;
  }

  console.log(`[backfillVersionReadiness] updated ${updated} version(s).`);

  const extIds = await prisma.extension.findMany({ select: { id: true } });
  for (const { id } of extIds) {
    await syncExtensionLatestReadiness(id);
  }
  console.log(`[backfillVersionReadiness] synced latestReadinessLevel for ${extIds.length} package(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
