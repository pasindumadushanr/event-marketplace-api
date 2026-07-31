import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function promoteAdmin(email: string) {
  try {
    const adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' },
    });

    if (!adminRole) {
      console.error('ADMIN role not found in database.');
      return;
    }

    const user = await prisma.user.update({
      where: { email },
      data: { roleId: adminRole.id },
    });

    console.log(`Successfully promoted ${user.email} to ADMIN!`);
  } catch (error) {
    console.error('Error promoting user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Please provide an email address.');
  process.exit(1);
}

promoteAdmin(email);
