
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const integrity = "sha512-81f437debf903491e2e53a0b08f04e1ae41ae95679bc531256e5437b3da609ab745f4950acb4f466b43e01877b42029d85dd970a31b25e4f9bf3e8dfb7090308";
  
  const version = await prisma.version.findFirst({
    where: { version: "1.0.0" }
  });
  
  if (version) {
    await prisma.version.update({
        where: { id: version.id },
        data: {
            packageHash: integrity,
            xsilUrl: "http://localhost:4873/@extensilica/fastaes/-/fastaes-sleep.xsil"
        }
    });
    console.log("Updated version 1.0.0 to sleep package");
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
