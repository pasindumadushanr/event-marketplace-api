const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const newEmail = 'admineventmarketplace@gmail.com';
  const newPassword = '2164226WL@pdc';
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Find the admin user
  // Usually the role is ADMIN or SUPER_ADMIN
  const adminRole = await prisma.role.findFirst({
    where: { name: { in: ['ADMIN', 'SUPER_ADMIN'] } }
  });

  if (!adminRole) {
    console.log('No admin role found!');
    return;
  }

  const adminUser = await prisma.user.findFirst({
    where: { roleId: adminRole.id }
  });

  if (adminUser) {
    const updated = await prisma.user.update({
      where: { id: adminUser.id },
      data: { 
        email: newEmail,
        password: hashedPassword,
        emailVerified: true
      }
    });
    console.log('Updated existing admin user:', updated.email);
  } else {
    const created = await prisma.user.create({
      data: {
        email: newEmail,
        password: hashedPassword,
        firstName: 'System',
        lastName: 'Admin',
        emailVerified: true,
        roleId: adminRole.id
      }
    });
    console.log('Created new admin user:', created.email);
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
