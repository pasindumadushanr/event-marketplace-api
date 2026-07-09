import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const roles = ['SUPER_ADMIN', 'ADMIN', 'VENDOR', 'CUSTOMER'];

  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `Default ${roleName} role`,
      },
    });
  }
  console.log('Roles seeded successfully.');

  const categories = [
    { name: 'Hotels & Venues', slug: 'hotels-venues' },
    { name: 'Photographers', slug: 'photographers' },
    { name: 'Videographers', slug: 'videographers' },
    { name: 'Beauty Salons & Makeup Artists', slug: 'beauty-makeup' },
    { name: 'Bridal Dress & Suit Shops', slug: 'bridal-wear' },
    { name: 'Decorators & Florists', slug: 'decorators-florists' },
    { name: 'DJs, Bands & Entertainment', slug: 'entertainment' },
    { name: 'Catering & Cake Services', slug: 'catering-cakes' },
    { name: 'Vehicle Rental', slug: 'vehicle-rental' },
    { name: 'Wedding & Event Planners', slug: 'event-planners' },
    { name: 'Invitation & Printing Services', slug: 'invitations-printing' },
    { name: 'Other Event Services', slug: 'other' },
  ];

  for (let i = 0; i < categories.length; i++) {
    await prisma.businessCategory.upsert({
      where: { slug: categories[i].slug },
      update: {},
      create: {
        name: categories[i].name,
        slug: categories[i].slug,
        sortOrder: i + 1,
      },
    });
  }
  console.log('Business Categories seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
