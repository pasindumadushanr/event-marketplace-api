import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedCategories } from '../prisma/seed-categories';

// Explicit, additive rollout for existing marketplace databases with legacy
// migration histories. Never runs during API startup.
async function main() {
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<
      { table_name: string }[]
    >`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`;
    const names = new Set(tables.map((item) => item.table_name));
    if (
      !['Business', 'BusinessCategory', 'Booking', 'User', 'Setting'].every(
        (name) => names.has(name),
      )
    )
      throw new Error(
        'Target is not an existing marketplace database. No changes made.',
      );
    const columns = await prisma.$queryRaw<
      { present: boolean }[]
    >`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'BusinessCategory' AND column_name = 'parentId') AS present`;
    console.log({
      marketplaceSchema: true,
      hierarchyColumn: columns[0].present,
      businesses: await prisma.business.count(),
      categories: await prisma.businessCategory.count(),
    });
    if (!process.argv.includes('--apply')) return;
    if (process.env.CATEGORY_ROLLOUT_CONFIRM !== 'marketplace-backed-up')
      throw new Error(
        'Back up and verify the intended target first, then set CATEGORY_ROLLOUT_CONFIRM=marketplace-backed-up.',
      );
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          'ALTER TABLE "BusinessCategory" ADD COLUMN IF NOT EXISTS "parentId" UUID',
        );
        await tx.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS "BusinessCategory_parentId_idx" ON "BusinessCategory"("parentId")',
        );
        await tx.$executeRawUnsafe(
          `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessCategory_parentId_fkey' AND conrelid = '"BusinessCategory"'::regclass) THEN ALTER TABLE "BusinessCategory" ADD CONSTRAINT "BusinessCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BusinessCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$`,
        );
        await tx.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS "Booking_businessId_date_status_idx" ON "Booking"("businessId", "date", "status")',
        );
        await tx.$executeRawUnsafe(
          `CREATE UNIQUE INDEX IF NOT EXISTS "Business_profile_slug_key" ON "Business" (("profileSettings" #>> '{seo,slug}')) WHERE COALESCE("profileSettings" #>> '{seo,slug}', '') <> ''`,
        );
      },
      { timeout: 60000 },
    );
    console.log(await seedCategories(prisma));
    console.log(
      'Additive rollout complete. Existing vendor/category records were retained.',
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Category rollout failed. Check connectivity, target schema, backup confirmation and duplicate business slugs. No secrets are logged.',
  );
  process.exitCode = 1;
});
