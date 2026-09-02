-- AlterTable
ALTER TABLE "Ngo" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "Ngo" ADD COLUMN "categoryOther" TEXT;
ALTER TABLE "Ngo" ADD COLUMN "description" TEXT;
ALTER TABLE "Ngo" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Ngo" ADD COLUMN "registrationNo" TEXT;
ALTER TABLE "Ngo" ADD COLUMN "contactEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ngo" ADD COLUMN "contactPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ngo" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Ngo_status_idx" ON "Ngo"("status");
CREATE INDEX "Ngo_category_idx" ON "Ngo"("category");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
