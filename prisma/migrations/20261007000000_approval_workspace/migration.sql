ALTER TYPE "VendorStatus" ADD VALUE IF NOT EXISTS 'NEEDS_INFO';
ALTER TABLE "Business" ADD COLUMN "informationRequest" TEXT;
ALTER TABLE "Business" ADD COLUMN "submittedAt" TIMESTAMP(3);
-- Legacy applications have no submission timestamp: retain their creation date.
UPDATE "Business" SET "submittedAt" = "createdAt" WHERE "submittedAt" IS NULL;
ALTER TABLE "Business" ALTER COLUMN "submittedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Business" ALTER COLUMN "submittedAt" SET NOT NULL;
CREATE INDEX "Business_vendorStatus_submittedAt_id_idx" ON "Business"("vendorStatus", "submittedAt", "id");
CREATE TABLE "ApplicationReviewEvent" (
  "id" UUID NOT NULL,
  "businessId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "message" TEXT,
  "notificationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "notificationAttemptAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationReviewEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ApplicationReviewEvent_businessId_createdAt_id_idx" ON "ApplicationReviewEvent"("businessId", "createdAt", "id");
