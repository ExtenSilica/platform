
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const integrity = "sha512-b7f0eb989ccef13244d3f97ef13407288edb01bf7257db4a7a682dfbe4eba8fb321ed93670913a10b03aa00b8ac60084c0fc1955abc7a2e57ba45f5e150685dd";
  
  const version = await prisma.version.findFirst({
    where: { version: "1.0.0" }
  });
  
  if (version) {
    await prisma.version.update({
        where: { id: version.id },
        data: {
            packageHash: integrity,
            xsilUrl: "http://localhost:4873/@extensilica/fastaes/-/fastaes-1.0.0.xsil"
        }
    });
    console.log("Updated version 1.0.0");
  } else {
      console.log("Version 1.0.0 not found");
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

