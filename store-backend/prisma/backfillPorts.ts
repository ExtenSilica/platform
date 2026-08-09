import { prisma } from '../src/db';
import { syncPortsFromVersion } from '../src/lib/ports';

async function main() {
  const extensions = await prisma.extension.findMany({
    where: { recordKind: 'extension' },
    include: {
      versions: {
        where: { isYanked: false },
        orderBy: { publishedAt: 'desc' },
      },
    },
  });

  let ports = 0;
  for (const extension of extensions) {
    const version = extension.versions.find((row) => row.version === extension.latestVersion)
      ?? extension.versions[0];
    if (!version) continue;
    ports += await syncPortsFromVersion({
      extensionId: extension.id,
      versionId: version.id,
      targets: version.targets,
      toolchain: version.toolchain,
      contributorId: extension.ownerId,
    });
  }

  console.log(`Backfilled ${ports} manifest target(s) across ${extensions.length} extension(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
