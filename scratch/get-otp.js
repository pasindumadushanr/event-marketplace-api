const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'admineventmarketplace@gmail.com' },
    select: { emailVerificationOtp: true, emailVerificationOtpExpiry: true }
  });
  console.log(user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
