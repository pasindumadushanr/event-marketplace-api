import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  
  if (!adminRole) {
    throw new Error('SUPER_ADMIN role not found in database.');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('admin123', salt);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@eventmarketplace.com' },
    update: {
      password: hashedPassword,
      roleId: adminRole.id,
    },
    create: {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@eventmarketplace.com',
      password: hashedPassword,
      roleId: adminRole.id,
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  console.log('Admin user created/updated successfully with email:', adminUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
