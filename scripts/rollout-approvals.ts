import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<
      { table_name: string }[]
    >`SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`;
    const names = new Set(tables.map((item) => item.table_name));
    if (
      !['User', 'Business', 'Document', 'AdminActivity'].every((name) =>
        names.has(name),
      )
    )
      throw new Error('Wrong marketplace target or security rollout missing');
    const columns = await prisma.$queryRaw<
      { column_name: string }[]
    >`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Business' AND column_name IN ('informationRequest', 'submittedAt')`;
    const enums = await prisma.$queryRaw<
      { present: boolean }[]
    >`SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typname='VendorStatus' AND n.nspname=current_schema() AND e.enumlabel='NEEDS_INFO') AS present`;
    console.log({
      marketplaceSchema: true,
      approvalColumns: columns.map((c) => c.column_name),
      reviewHistoryTable: names.has('ApplicationReviewEvent'),
      needsInformationState: enums[0].present,
    });
    if (!process.argv.includes('--apply')) return;
    if (process.env.APPROVAL_ROLLOUT_CONFIRM !== 'marketplace-backed-up')
      throw new Error('Backup and target approval required');
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'NEEDS_INFO'`,
        );
        await tx.$executeRawUnsafe(
          'ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "informationRequest" TEXT',
        );
        await tx.$executeRawUnsafe(
          'ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3)',
        );
        // Only initialize the new field: never change existing application states.
        await tx.$executeRawUnsafe(
          'UPDATE "Business" SET "submittedAt" = "createdAt" WHERE "submittedAt" IS NULL',
        );
        await tx.$executeRawUnsafe(
          'ALTER TABLE "Business" ALTER COLUMN "submittedAt" SET DEFAULT CURRENT_TIMESTAMP',
        );
        await tx.$executeRawUnsafe(
          'ALTER TABLE "Business" ALTER COLUMN "submittedAt" SET NOT NULL',
        );
        await tx.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS "Business_vendorStatus_submittedAt_id_idx" ON "Business"("vendorStatus", "submittedAt", "id")',
        );
        await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ApplicationReviewEvent" (
        "id" UUID NOT NULL, "businessId" UUID NOT NULL, "actorId" UUID NOT NULL,
        "actorName" TEXT NOT NULL, "action" TEXT NOT NULL, "message" TEXT,
        "notificationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED', "notificationAttemptAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ApplicationReviewEvent_pkey" PRIMARY KEY ("id"))`);
        await tx.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS "ApplicationReviewEvent_businessId_createdAt_id_idx" ON "ApplicationReviewEvent"("businessId", "createdAt", "id")',
        );
      },
      { timeout: 60000 },
    );
    console.log(
      'Approval schema ready. Existing decisions and business visibility were preserved.',
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Approval rollout failed. Check target schema, connectivity and backup confirmation. No secrets logged.',
  );
  process.exitCode = 1;
});
