import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Explicit additive rollout for the existing, unbaselined production database.
// Never run migrate deploy against legacy tables or run this on API startup.
async function main() {
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`;
    const names = new Set(tables.map((item) => item.table_name));
    if (
      !['User', 'Business', 'Setting', 'Booking'].every((name) =>
        names.has(name),
      )
    )
      throw new Error('Not an existing marketplace database');
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'User'
      AND column_name IN ('sessionVersion', 'otpPurpose')`;
    console.log({
      marketplaceSchema: true,
      sessionColumns: columns.map((c) => c.column_name),
      activityTable: names.has('AdminActivity'),
    });
    if (!process.argv.includes('--apply')) return;
    if (process.env.SECURITY_ROLLOUT_CONFIRM !== 'marketplace-backed-up')
      throw new Error('Back up and verify the target before applying');
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0',
        );
        await tx.$executeRawUnsafe(
          'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "otpPurpose" TEXT',
        );
        await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "AdminActivity" (
        "id" UUID NOT NULL, "actorId" UUID NOT NULL, "actorName" TEXT NOT NULL,
        "action" TEXT NOT NULL, "targetType" TEXT NOT NULL, "targetId" TEXT NOT NULL,
        "summary" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AdminActivity_pkey" PRIMARY KEY ("id"))`);
        await tx.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS "AdminActivity_createdAt_id_idx" ON "AdminActivity"("createdAt", "id")',
        );
        await tx.$executeRawUnsafe(
          'CREATE INDEX IF NOT EXISTS "AdminActivity_actorId_createdAt_idx" ON "AdminActivity"("actorId", "createdAt")',
        );
      },
      { timeout: 60000 },
    );
    console.log(
      'Security schema ready. Existing accounts retained; sessions will be reset by the new backend release.',
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Security rollout failed. Check connectivity, target schema and backup confirmation. No secrets are logged.',
  );
  process.exitCode = 1;
});
