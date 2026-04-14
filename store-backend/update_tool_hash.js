const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.version.updateMany({
    where: { version: '1.0.6' },
    data: { packageHash: 'sha512-qI9UT7s2wExr9jFy9LiHBmXv0KnQ5iV8bj6ad4su4iBXo25uX24G9mkAtzgyRQhc7bHSCPoVEKKf9DYYKz2cLw==' }
  });
  console.log("Updated hash to missing tool tarball hash");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });

