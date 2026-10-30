// Explicit operator-only provisioning. Never run during build, startup or seeding.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const db = new PrismaClient();
(async () => {
  if (!process.argv.includes('--create-invitation-staff'))
    throw new Error('Explicit --create-invitation-staff flag required');
  const {
    STUDIO_STAFF_EMAIL: email,
    STUDIO_STAFF_PASSWORD: password,
    STUDIO_STAFF_NAME: name,
  } = process.env;
  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !password ||
    password.length < 14 ||
    !name
  )
    throw new Error(
      'Set staff email, name, and a unique password of at least 14 characters in environment variables',
    );
  const role = await db.role.findUnique({
    where: { name: 'INVITATION_STAFF' },
  });
  if (!role) throw new Error('Deploy the invitation migration first');
  if (await db.user.findUnique({ where: { email } }))
    throw new Error(
      'Account already exists. Nothing was changed; do not repurpose a customer/vendor account.',
    );
  await db.user.create({
    data: {
      email,
      firstName: name,
      lastName: '',
      password: await bcrypt.hash(password, 12),
      roleId: role.id,
      status: 'ACTIVE',
    },
  });
  console.log(
    'Invitation staff account created. Email-code verification is required at sign-in.',
  );
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
