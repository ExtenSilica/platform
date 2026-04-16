import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.version.deleteMany({});
  await prisma.extension.deleteMany({});

  // Demo catalog rows need a real owner so authenticated publish works (see
  // packagesController.publishVersion). Default: user "extensilica" from §8.
  const ownerUsername =
    (process.env.SEED_OWNER_USERNAME ?? 'extensilica').trim().toLowerCase() || 'extensilica';
  const owner = await prisma.user.findUnique({ where: { username: ownerUsername } });
  const allowNoOwner = ['1', 'true', 'yes'].includes(
    (process.env.ALLOW_SEED_WITHOUT_OWNER ?? '').trim().toLowerCase()
  );

  if (!owner && !allowNoOwner) {
    throw new Error(
      `Seed owner user "${ownerUsername}" not found. Create that account first (deploy runbook §8), ` +
        `or re-run with SEED_OWNER_USERNAME matching an existing username. ` +
        `For local-only catalogs with no user, set ALLOW_SEED_WITHOUT_OWNER=1 (packages will have no owner).`
    );
  }

  if (!owner && allowNoOwner) {
    console.warn(
      `[seed] No user "${ownerUsername}" — continuing with ownerId unset (ALLOW_SEED_WITHOUT_OWNER=1).`
    );
  }

  const packages = [
    {
      name: 'FastAES',
      slug: 'fastaes',
      description: 'High-performance AES-256 acceleration extension for RISC-V processors.',
      shortDescription: 'AES-256 hardware acceleration for RISC-V.',
      author: 'xsil-community',
      keywords: 'aes,encryption,security,riscv',
      versions: {
        create: [
          {
            version: '1.0.0',
            changelog: 'Initial release',
            xsilUrl: 'https://registry.extensilica.com/fastaes/-/fastaes-1.0.0.xsil',
            isa: 'rv64gc',
          },
          {
            version: '1.0.7',
            changelog: 'Performance improvements; reduced cycle count by 18%',
            xsilUrl: 'https://registry.extensilica.com/fastaes/-/fastaes-1.0.7.xsil',
            isa: 'rv64gc',
          },
        ],
      },
    },
    {
      name: 'MLBoost',
      slug: 'mlboost',
      description: 'Optimised matrix-multiply and activation extensions for RISC-V ML inference.',
      shortDescription: 'ML inference acceleration on RISC-V.',
      author: 'ai-labs',
      keywords: 'ml,ai,inference,matrix,riscv',
      versions: {
        create: [
          {
            version: '2.1.0',
            changelog: 'Added support for transformer attention kernels',
            xsilUrl: 'https://registry.extensilica.com/mlboost/-/mlboost-2.1.0.xsil',
            isa: 'rv64gcv',
          },
        ],
      },
    },
    {
      name: 'DSPFilter',
      slug: 'dspfilter',
      description: 'Advanced FIR and IIR digital signal processing filters for RISC-V.',
      shortDescription: 'FIR/IIR DSP filters for RISC-V.',
      author: 'signal-masters',
      keywords: 'dsp,filter,audio,signal,riscv',
      versions: {
        create: [
          {
            version: '3.0.1',
            changelog: 'Fixed memory alignment bug in FIR implementation',
            xsilUrl: 'https://registry.extensilica.com/dspfilter/-/dspfilter-3.0.1.xsil',
            isa: 'rv32imc',
          },
        ],
      },
    },
    {
      name: 'RVX Demo',
      slug: 'rvx-demo',
      description: 'Minimal demonstration package: a RISC-V program that runs under Spike.',
      shortDescription: 'Hello-world .xsil package for RISC-V.',
      author: 'extensilica',
      keywords: 'demo,tutorial,spike,riscv',
      // No Version rows: deploy §9 publishes examples/rvx-demo@1.0.0 from the laptop.
      // A pre-seeded 1.0.0 row would block publish with HTTP 409.
      versions: { create: [] },
    },
    {
      name: 'Vec128',
      slug: 'vec128',
      description: 'RISC-V Vector (RVV 1.0) extension package with 128-bit VLEN examples and tests.',
      shortDescription: 'RVV 1.0 vector extension examples.',
      author: 'rvv-contributors',
      keywords: 'vector,rvv,simd,riscv',
      versions: {
        create: [
          {
            version: '0.9.0',
            changelog: 'Beta release; covers vadd, vmul, and reduction operations',
            xsilUrl: 'https://registry.extensilica.com/vec128/-/vec128-0.9.0.xsil',
            isa: 'rv64gcv',
          },
        ],
      },
    },
  ];

  for (const pkg of packages) {
    const created = await prisma.extension.create({
      data: {
        ...pkg,
        ...(owner ? { ownerId: owner.id } : {}),
      },
    });
    console.log(`Created: ${created.slug}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
