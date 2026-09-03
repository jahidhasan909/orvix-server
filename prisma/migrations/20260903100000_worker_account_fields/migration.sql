-- AlterTable
ALTER TABLE "User" ADD COLUMN "designationOther" TEXT;
ALTER TABLE "User" ADD COLUMN "employeeId" TEXT;
ALTER TABLE "User" ADD COLUMN "address" TEXT;
ALTER TABLE "User" ADD COLUMN "joiningDate" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_ngoId_employeeId_idx" ON "User"("ngoId", "employeeId");
