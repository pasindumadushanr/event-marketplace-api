-- Additive migration: existing categories and vendor assignments are retained.
ALTER TABLE "BusinessCategory" ADD COLUMN "parentId" UUID;
CREATE INDEX "BusinessCategory_parentId_idx" ON "BusinessCategory"("parentId");
ALTER TABLE "BusinessCategory" ADD CONSTRAINT "BusinessCategory_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "BusinessCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
