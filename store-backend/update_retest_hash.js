const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.version.updateMany({
    where: { version: '1.0.6' },
    data: { packageHash: 'sha512-r7NHkW92I+Xn7aocaI3wwZNC/TZ+fDLpXn5PlixYOkvPjkj+rOSjLfvRHpWBldGpKVogbSrZZ/dFWJkHIiAQHg==' }
  });
  console.log("Updated hash to retest tarball hash");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

