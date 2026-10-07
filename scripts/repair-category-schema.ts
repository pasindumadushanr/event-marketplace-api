import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Targeted additive repair: unlike categories:rollout, never seeds the catalog
// or adds unrelated booking/profile indexes. Run only with explicit approval.
async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const tables = await tx.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`;
        const names = new Set(tables.map((row) => row.table_name));
        if (
          !['Business', 'BusinessCategory', 'User', 'Booking', 'Setting'].every(
            (name) => names.has(name),
          )
        ) {
          throw new Error('Unexpected target schema');
        }
        const beforeCategories = await tx.businessCategory.findMany({
          select: { id: true, name: true, slug: true, status: true },
          orderBy: { id: 'asc' },
        });
        const beforeAssignments = await tx.business.findMany({
          select: { id: true, categoryId: true },
          orderBy: { id: 'asc' },
        });
        if (process.argv.includes('--apply')) {
          if (process.env.CATEGORY_SCHEMA_REPAIR_APPROVED !== 'yes')
            throw new Error('Approval required');
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
          await tx.$executeRawUnsafe(
            'ALTER TABLE "BusinessCategory" ADD COLUMN IF NOT EXISTS "parentId" UUID',
          );
          await tx.$executeRawUnsafe(
            'CREATE INDEX IF NOT EXISTS "BusinessCategory_parentId_idx" ON "BusinessCategory"("parentId")',
          );
          await tx.$executeRawUnsafe(`DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BusinessCategory_parentId_fkey'
            AND conrelid = '"BusinessCategory"'::regclass) THEN
            ALTER TABLE "BusinessCategory" ADD CONSTRAINT "BusinessCategory_parentId_fkey"
            FOREIGN KEY ("parentId") REFERENCES "BusinessCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;
        END $$`);
        }
        const afterCategories = await tx.businessCategory.findMany({
          select: { id: true, name: true, slug: true, status: true },
          orderBy: { id: 'asc' },
        });
        const afterAssignments = await tx.business.findMany({
          select: { id: true, categoryId: true },
          orderBy: { id: 'asc' },
        });
        if (
          JSON.stringify(beforeCategories) !==
            JSON.stringify(afterCategories) ||
          JSON.stringify(beforeAssignments) !== JSON.stringify(afterAssignments)
        ) {
          throw new Error('Records changed during repair; rolling back');
        }
        const column = await tx.$queryRaw<{ present: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema()
          AND table_name = 'BusinessCategory' AND column_name = 'parentId') AS present`;
        return {
          hierarchyColumn: column[0].present,
          categories: afterCategories.length,
          businesses: afterAssignments.length,
          recordsPreserved: true,
        };
      },
      { timeout: 30000 },
    );
    console.log(result);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  const details = error as {
    name?: string;
    code?: string;
    meta?: { code?: string };
  };
  console.error({
    errorType: details.name,
    code: details.code,
    databaseCode: details.meta?.code,
  });
  console.error(
    'Category schema repair failed; transaction rolled back. Check target schema, approval and database connectivity. No credentials are logged.',
  );
  process.exitCode = 1;
});
