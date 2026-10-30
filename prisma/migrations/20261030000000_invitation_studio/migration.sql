CREATE TABLE "WeddingInvitation" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "templateId" TEXT NOT NULL DEFAULT 'W01',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "draft" JSONB NOT NULL,
  "published" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "previewDigest" TEXT,
  "previewExpires" TIMESTAMP(3),
  "createdBy" UUID NOT NULL,
  "updatedBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeddingInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WeddingInvitation_slug_key" ON "WeddingInvitation"("slug");
CREATE INDEX "WeddingInvitation_status_updatedAt_idx" ON "WeddingInvitation"("status", "updatedAt");
INSERT INTO "Role" ("id", "name", "description")
VALUES ('a55d7c27-4bab-4e31-bdbf-354d4f30f4d1', 'INVITATION_STAFF', 'Invitation Studio only; no marketplace administration')
ON CONFLICT ("name") DO NOTHING;
CREATE TABLE "InvitationStudioMember" (
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvitationStudioMember_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "InvitationStudioMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
