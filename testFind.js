const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const business = await prisma.business.findFirst({
      where: { id: 'e1a91d33-e2b4-4ae0-b8b4-125bbd0e3704', status: 'ACTIVE' },
      include: {
        category: { select: { name: true, id: true } },
        galleries: { orderBy: { sortOrder: 'asc' } },
        packages: { where: { status: 'ACTIVE' }, orderBy: { price: 'asc' } },
        reviews: {
          include: { customer: { select: { firstName: true, lastName: true, profileImage: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    console.log('Found:', business !== null);
  } catch (e) {
    console.error('Error:', e);
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
