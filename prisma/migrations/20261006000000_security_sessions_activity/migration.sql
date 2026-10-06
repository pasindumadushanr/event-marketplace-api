ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "otpPurpose" TEXT;

CREATE TABLE "AdminActivity" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminActivity_createdAt_id_idx" ON "AdminActivity"("createdAt", "id");
CREATE INDEX "AdminActivity_actorId_createdAt_idx" ON "AdminActivity"("actorId", "createdAt");
