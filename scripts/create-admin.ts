import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' },
    });

    if (!adminRole) {
      console.error('ADMIN role not found.');
      return;
    }
    
    const email = 'admin@eventmarketplace.com';
    const password = await bcrypt.hash('admin123', 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: { roleId: adminRole.id },
      create: {
        email,
        password,
        firstName: 'Super',
        lastName: 'Admin',
        roleId: adminRole.id
      }
    });

    console.log(`Successfully created ADMIN account: ${user.email}`);
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
