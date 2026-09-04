import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireInventory } from "#lib/require-inventory.js";
import {
  TX,
  applyStockChange,
  assertProjectSite,
  money,
  ownItem,
  parseDate,
  positiveInt,
} from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireInventory("view");
  if (gate.error) return jsonError(gate.error, gate.status);

  const items = await prisma.receivingRecord.findMany({
    where: { ngoId: gate.ngoId },
    orderBy: { date: "desc" },
    include: {
      item: { select: { name: true, unit: true } },
      supplier: { select: { name: true } },
    },
  });

  return NextResponse.json({
    items: items.map((row) => ({
      id: row.id,
      date: row.date,
      sku: row.sku,
      itemId: row.itemId || "",
      itemName: row.item?.name || row.sku,
      quantity: row.quantity,
      unit: row.item?.unit || "pcs",
      unitCost: row.unitCost != null ? Number(row.unitCost) : null,
      totalCost: row.totalCost != null ? Number(row.totalCost) : null,
      supplierId: row.supplierId || "",
      supplierName: row.supplier?.name || "",
      reference: row.reference || "",
      projectId: row.projectId || "",
      siteId: row.siteId || "",
      notes: row.notes || "",
    })),
  });
}

export async function POST(request) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const itemId = asString(body?.itemId);
  const quantity = positiveInt(body?.quantity);
  const supplierId = asString(body?.supplierId) || null;
  const reference = asString(body?.reference) || null;
  const notes = asString(body?.notes) || null;
  const projectId = asString(body?.projectId) || null;
  const siteId = asString(body?.siteId) || null;
  const unitCost = money(body?.unitCost);
  const date = parseDate(body?.date);

  if (!itemId) return jsonError("An inventory item is required.");
  if (!quantity || quantity < 1) return jsonError("Quantity must be at least 1.");

  const item = await ownItem(prisma, gate.ngoId, itemId);
  if (!item) return jsonError("Item not found.", 404);
  if (item.status !== "active") return jsonError("Cannot receive stock against an inactive item.");

  const scoped = await assertProjectSite(prisma, gate.ngoId, projectId, siteId);
  if (scoped.error) return jsonError(scoped.error);

  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, ngoId: gate.ngoId } });
    if (!supplier) return jsonError("The selected supplier does not belong to this NGO.");
  }

  const totalCost = unitCost != null ? unitCost * quantity : money(body?.totalCost);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const { transaction } = await applyStockChange(tx, {
        ngoId: gate.ngoId,
        itemId,
        delta: quantity,
        type: TX.RECEIVED,
        supplierId,
        projectId,
        siteId,
        reference,
        notes,
        createdBy: gate.userId,
        unitCost,
        totalCost,
        date,
      });

      if (totalCost != null) {
        await tx.purchase.create({
          data: {
            ngoId: gate.ngoId,
            amount: totalCost,
            status: "posted",
            date,
          },
        });
      }

      const receipt = await tx.receivingRecord.create({
        data: {
          ngoId: gate.ngoId,
          itemId,
          sku: item.sku,
          quantity,
          supplierId,
          unitCost,
          totalCost,
          projectId,
          siteId,
          reference,
          notes,
          createdBy: gate.userId,
          date,
        },
      });

      return { receipt, transaction };
    });

    return NextResponse.json({ item: created.receipt, transaction: created.transaction }, { status: 201 });
  } catch (error) {
    if (error.message === "INSUFFICIENT_STOCK") return jsonError("Not enough stock.");
    console.error(error);
    return jsonError("Could not record the receipt.", 500);
  }
}
