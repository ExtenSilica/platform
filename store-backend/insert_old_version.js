const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get extension ID
  const ext = await prisma.extension.findUnique({ where: { slug: 'fastaes' } });
  
  await prisma.version.create({
    data: {
      version: '1.0.5',
      changelog: 'Old version',
      xsilUrl: 'http://localhost:4873/@extensilica/fastaes/-/fastaes-1.0.5.xsil',
      extensionId: ext.id,
      // packageHash: null // or undefined
    }
  });
  console.log("Inserted 1.0.5");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

