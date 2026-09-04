-- AlterTable PurchaseOrder
ALTER TABLE "PurchaseOrder" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "notes" TEXT;

-- AlterTable Purchase
ALTER TABLE "Purchase" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "ngoId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable ReceivingRecord
ALTER TABLE "ReceivingRecord" ADD COLUMN "lineId" TEXT;
ALTER TABLE "ReceivingRecord" ADD COLUMN "purchaseId" TEXT;

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");
CREATE INDEX "Purchase_orderId_idx" ON "Purchase"("orderId");
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");
CREATE INDEX "PurchaseOrderLine_ngoId_idx" ON "PurchaseOrderLine"("ngoId");
CREATE INDEX "PurchaseOrderLine_orderId_idx" ON "PurchaseOrderLine"("orderId");
CREATE INDEX "PurchaseOrderLine_itemId_idx" ON "PurchaseOrderLine"("itemId");
CREATE INDEX "ReceivingRecord_orderId_idx" ON "ReceivingRecord"("orderId");
CREATE INDEX "ReceivingRecord_lineId_idx" ON "ReceivingRecord"("lineId");
CREATE INDEX "ReceivingRecord_purchaseId_idx" ON "ReceivingRecord"("purchaseId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_ngoId_fkey" FOREIGN KEY ("ngoId") REFERENCES "Ngo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceivingRecord" ADD CONSTRAINT "ReceivingRecord_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceivingRecord" ADD CONSTRAINT "ReceivingRecord_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
