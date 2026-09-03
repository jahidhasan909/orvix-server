-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "ngoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN "description" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "minLevel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "InventoryItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "InventoryItem" ADD COLUMN "projectId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "siteId" TEXT;
ALTER TABLE "InventoryItem" ALTER COLUMN "unit" SET DEFAULT 'pcs';

-- AlterTable StockTransaction
ALTER TABLE "StockTransaction" ADD COLUMN "itemId" TEXT;
ALTER TABLE "StockTransaction" ADD COLUMN "quantityBefore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StockTransaction" ADD COLUMN "quantityAfter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StockTransaction" ADD COLUMN "unitCost" DECIMAL(12,2);
ALTER TABLE "StockTransaction" ADD COLUMN "totalCost" DECIMAL(12,2);
ALTER TABLE "StockTransaction" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "StockTransaction" ADD COLUMN "workerId" TEXT;
ALTER TABLE "StockTransaction" ADD COLUMN "projectId" TEXT;
ALTER TABLE "StockTransaction" ADD COLUMN "siteId" TEXT;
ALTER TABLE "StockTransaction" ADD COLUMN "notes" TEXT;
ALTER TABLE "StockTransaction" ADD COLUMN "createdBy" TEXT;

-- AlterTable StockTransfer
ALTER TABLE "StockTransfer" ADD COLUMN "itemId" TEXT;
ALTER TABLE "StockTransfer" ADD COLUMN "fromSiteId" TEXT;
ALTER TABLE "StockTransfer" ADD COLUMN "toSiteId" TEXT;
ALTER TABLE "StockTransfer" ADD COLUMN "notes" TEXT;
ALTER TABLE "StockTransfer" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "StockTransfer" ALTER COLUMN "status" SET DEFAULT 'completed';

-- AlterTable StockAdjustment
ALTER TABLE "StockAdjustment" ADD COLUMN "itemId" TEXT;
ALTER TABLE "StockAdjustment" ADD COLUMN "quantityBefore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StockAdjustment" ADD COLUMN "quantityAfter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StockAdjustment" ADD COLUMN "createdBy" TEXT;

-- AlterTable Supplier
ALTER TABLE "Supplier" ADD COLUMN "email" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "phone" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "address" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable ReceivingRecord
ALTER TABLE "ReceivingRecord" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "ReceivingRecord" ADD COLUMN "itemId" TEXT;
ALTER TABLE "ReceivingRecord" ADD COLUMN "unitCost" DECIMAL(12,2);
ALTER TABLE "ReceivingRecord" ADD COLUMN "totalCost" DECIMAL(12,2);
ALTER TABLE "ReceivingRecord" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ReceivingRecord" ADD COLUMN "siteId" TEXT;
ALTER TABLE "ReceivingRecord" ADD COLUMN "reference" TEXT;
ALTER TABLE "ReceivingRecord" ADD COLUMN "notes" TEXT;
ALTER TABLE "ReceivingRecord" ADD COLUMN "createdBy" TEXT;

-- AlterTable ResourceRequest
ALTER TABLE "ResourceRequest" ADD COLUMN "requestedById" TEXT;
ALTER TABLE "ResourceRequest" ADD COLUMN "itemId" TEXT;
ALTER TABLE "ResourceRequest" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ResourceRequest" ADD COLUMN "reason" TEXT;
ALTER TABLE "ResourceRequest" ADD COLUMN "notes" TEXT;
ALTER TABLE "ResourceRequest" ADD COLUMN "decisionNote" TEXT;
ALTER TABLE "ResourceRequest" ADD COLUMN "decidedBy" TEXT;
ALTER TABLE "ResourceRequest" ADD COLUMN "issuedAt" TIMESTAMP(3);

-- AlterTable DistributionRecord
ALTER TABLE "DistributionRecord" ADD COLUMN "itemId" TEXT;
ALTER TABLE "DistributionRecord" ADD COLUMN "workerId" TEXT;
ALTER TABLE "DistributionRecord" ADD COLUMN "projectId" TEXT;
ALTER TABLE "DistributionRecord" ADD COLUMN "reason" TEXT;
ALTER TABLE "DistributionRecord" ADD COLUMN "notes" TEXT;
ALTER TABLE "DistributionRecord" ADD COLUMN "requestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_ngoId_name_key" ON "InventoryCategory"("ngoId", "name");
CREATE INDEX "InventoryCategory_ngoId_idx" ON "InventoryCategory"("ngoId");
CREATE INDEX "InventoryItem_categoryId_idx" ON "InventoryItem"("categoryId");
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");
CREATE INDEX "StockTransaction_itemId_idx" ON "StockTransaction"("itemId");
CREATE INDEX "StockTransaction_type_idx" ON "StockTransaction"("type");
CREATE INDEX "StockTransaction_date_idx" ON "StockTransaction"("date");
CREATE INDEX "ReceivingRecord_itemId_idx" ON "ReceivingRecord"("itemId");
CREATE INDEX "ResourceRequest_status_idx" ON "ResourceRequest"("status");
CREATE INDEX "ResourceRequest_itemId_idx" ON "ResourceRequest"("itemId");

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_ngoId_fkey" FOREIGN KEY ("ngoId") REFERENCES "Ngo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceivingRecord" ADD CONSTRAINT "ReceivingRecord_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceivingRecord" ADD CONSTRAINT "ReceivingRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResourceRequest" ADD CONSTRAINT "ResourceRequest_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DistributionRecord" ADD CONSTRAINT "DistributionRecord_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
