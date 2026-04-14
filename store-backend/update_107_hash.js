const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.version.updateMany({
    where: { version: '1.0.7' },
    data: { packageHash: 'sha512-t/DrmJzO8TJE0/l+8TQHKI7bAb9yV9tKemgt++TrqPsyHtk2cJE6ELA6oAuKxgCEwPwZVavHouV7pF9eFQaF3Q==' }
  });
  console.log("Updated 1.0.7 hash");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

