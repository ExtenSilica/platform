
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const integrity = "sha512-2aae0d4b69ba464078461c00fb6c17743a45c5a3a4de55a7b141cea7a3fb66864043b387817db3731dedc7af9d61699fbf7996f6876c86b7e9f704ca21aeeff4"; // FROM PREVIOUS STEP
  
  // We reuse version 1.0.6 (which was used for requirement test).
  // Update it to point to fastaes-nobin.xsil
  const version = await prisma.version.findFirst({
    where: { version: "1.0.6" }
  });
  
  if (version) {
    await prisma.version.update({
        where: { id: version.id },
        data: {
            packageHash: integrity,
            xsilUrl: "http://localhost:4873/@extensilica/fastaes/-/fastaes-nobin.xsil"
        }
    });
    console.log("Updated version 1.0.6 to point to nobin package");
  } else {
      console.log("Version 1.0.6 not found");
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

