const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vendorRole = await prisma.role.findUnique({ where: { name: 'VENDOR' } });
  if (!vendorRole) {
    console.error('VENDOR role not found');
    return;
  }
  await prisma.user.updateMany({
    where: { email: 'testuser9@gmail.com' },
    data: { roleId: vendorRole.id },
  });
  console.log('Role updated to VENDOR');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
