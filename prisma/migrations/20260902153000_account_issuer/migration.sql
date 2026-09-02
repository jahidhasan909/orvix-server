-- AlterTable
ALTER TABLE "Account" ADD COLUMN "issuer" TEXT;

-- CreateIndex
CREATE INDEX "Account_issuer_accountId_idx" ON "Account"("issuer", "accountId");
