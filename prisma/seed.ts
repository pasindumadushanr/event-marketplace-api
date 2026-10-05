import { PrismaClient } from '@prisma/client';
import { seedCategories } from './seed-categories';

const prisma = new PrismaClient();
async function main() {
  for (const name of ['SUPER_ADMIN', 'ADMIN', 'VENDOR', 'CUSTOMER']) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `Default ${name} role` },
    });
  }
  console.log('Roles seeded successfully.');
  console.log(await seedCategories(prisma));
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
