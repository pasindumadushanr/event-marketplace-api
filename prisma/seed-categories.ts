import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  legacyCategoryTargets,
  serviceCategoryAliases,
  taxonomyRows,
} from '../src/business-categories/category-taxonomy';

export async function seedCategories(prisma: PrismaClient) {
  // One transaction, repeatable, with no category or vendor deletion.
  return prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const originals = await tx.businessCategory.findMany();
      const ids = new Map<string, string>();
      const rows = taxonomyRows();
      // Roots must exist before moving broad legacy assignments.
      for (const row of rows.filter((item) => !item.parentSlug)) {
        const { parentSlug, ...values } = row;
        const category = await tx.businessCategory.upsert({
          where: { slug: row.slug },
          update: { ...values, parentId: null, status: 'ACTIVE' },
          create: values,
        });
        ids.set(row.slug, category.id);
      }
      for (const old of originals) {
        const target = legacyCategoryTargets[old.slug];
        // The bridal-wear slug is reused by the narrower new Bridal Wear category.
        // Only migrate it if this is still the old broad dress-and-suit category.
        if (
          !target ||
          (old.slug === 'bridal-wear' && old.name === 'Bridal Wear')
        )
          continue;
        await tx.business.updateMany({
          where: { categoryId: old.id },
          data: { categoryId: ids.get(target)! },
        });
        if (!rows.some((row) => row.slug === old.slug)) {
          await tx.businessCategory.update({
            where: { id: old.id },
            data: { status: 'INACTIVE', parentId: ids.get(target)! },
          });
        }
      }
      for (const row of rows.filter((item) => item.parentSlug)) {
        const { parentSlug, ...values } = row;
        const data = {
          ...values,
          parentId: ids.get(parentSlug!)!,
          status: 'ACTIVE' as const,
        };
        const previous = originals.find(
          (item) => serviceCategoryAliases[item.slug] === row.slug,
        );
        const alreadyExists = originals.some((item) => item.slug === row.slug);
        const category =
          previous && !alreadyExists
            ? await tx.businessCategory.update({
                where: { id: previous.id },
                data,
              })
            : await tx.businessCategory.upsert({
                where: { slug: row.slug },
                update: data,
                create: data,
              });
        if (previous && previous.id !== category.id) {
          await tx.business.updateMany({
            where: { categoryId: previous.id },
            data: { categoryId: category.id },
          });
          await tx.businessCategory.update({
            where: { id: previous.id },
            data: { status: 'INACTIVE', parentId: data.parentId },
          });
        }
        ids.set(row.slug, category.id);
      }
      // Unclassified/custom legacy categories remain stored and assigned; hide only
      // the old catch-all from new selections. Existing vendors can reclassify later.
      await tx.businessCategory.updateMany({
        where: { slug: 'other' },
        data: { status: 'INACTIVE' },
      });
      return { roots: 12, categories: rows.length };
    },
    { timeout: 60000 },
  );
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedCategories(prisma)
    .then(console.log)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
