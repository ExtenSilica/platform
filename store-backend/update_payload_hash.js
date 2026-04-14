const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const integrity =
    "sha512-7ccd808e6cdff04225182b7c55452bac11eeca1a9030935e4bca8352aed524cf7c18c1671cff58d1d671b9bcdde6337101885e03ccdbe10f7c926353ba088878";

  const version = await prisma.version.findFirst({
    where: { version: "1.0.0" },
  });

  if (version) {
    await prisma.version.update({
      where: { id: version.id },
      data: {
        packageHash: integrity,
        xsilUrl:
          "http://localhost:4873/@extensilica/fastaes/-/fastaes-payload.xsil",
      },
    });
    console.log("Updated version 1.0.0 to payload mismatch package");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
