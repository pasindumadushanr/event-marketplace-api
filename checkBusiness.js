const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const businesses = await prisma.business.findMany({
    select: { id: true, name: true, status: true, vendorStatus: true }
  });
  console.log('Businesses:', businesses);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
