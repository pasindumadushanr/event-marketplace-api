import 'dotenv/config';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { BusinessCategoriesService } from '../src/business-categories/business-categories.service';

async function main() {
  const prisma = new PrismaClient();
  const rollback = new Error(
    'Verification complete; rollback temporary records',
  );
  try {
    const before = await prisma.businessCategory.count();
    let verified = false;
    try {
      await prisma.$transaction(
        async (tx) => {
          const service = new BusinessCategoriesService(
            tx as unknown as PrismaService,
          );
          const suffix = randomUUID();
          const root = await service.create({
            name: `Temporary schema check ${suffix}`,
            slug: `schema-check-${suffix}`,
            parentId: null,
          });
          const child = await service.create({
            name: `Temporary child check ${suffix}`,
            slug: `child-check-${suffix}`,
            parentId: root.id,
          });
          await service.updateStatus(child.id, 'INACTIVE');
          const found = await service.findById(child.id);
          if (found?.parentId !== root.id || found.status !== 'INACTIVE')
            throw new Error('Update verification failed');
          let protectedParent = false;
          try {
            await service.delete(root.id);
          } catch (error) {
            if (error instanceof Error && error.message.includes('Deactivate'))
              protectedParent = true;
            else throw error;
          }
          if (!protectedParent) throw new Error('Parent deletion guard failed');
          await service.delete(child.id);
          await service.delete(root.id);
          verified = true;
          throw rollback;
        },
        { timeout: 30000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    }
    const after = await prisma.businessCategory.count();
    if (!verified || before !== after) throw new Error('Verification failed');
    console.log({
      create: true,
      childCreate: true,
      statusUpdate: true,
      parentDeletionProtected: true,
      unassignedDeletion: true,
      rolledBack: true,
      categoriesBefore: before,
      categoriesAfter: after,
    });
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Category management verification failed. Temporary changes were transaction-protected; no secrets are logged.',
  );
  process.exitCode = 1;
});
