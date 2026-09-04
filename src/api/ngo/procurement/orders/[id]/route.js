import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import {
  loadOwnedItems,
  orderInclude,
  ownOrder,
  ownSupplier,
  parseOrderLines,
  parseOrderMeta,
  publicOrder,
  receivedQtyOf,
} from "#lib/procurement.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const order = await ownOrder(prisma, gate.ngoId, id, {
    receiving: {
      orderBy: { date: "desc" },
      include: {
        item: { select: { name: true, unit: true } },
        supplier: { select: { name: true } },
      },
    },
    purchases: { orderBy: { date: "desc" } },
  });
  if (!order) return jsonError("Purchase order not found.", 404);

  return NextResponse.json({
    item: {
      ...publicOrder(order),
      receipts: (order.receiving ?? []).map((row) => ({
        id: row.id,
        date: row.date,
        itemName: row.item?.name || row.sku,
        quantity: row.quantity,
        unitCost: row.unitCost != null ? Number(row.unitCost) : null,
        totalCost: row.totalCost != null ? Number(row.totalCost) : null,
        purchaseId: row.purchaseId || "",
        notes: row.notes || "",
      })),
      purchases: (order.purchases ?? []).map((row) => ({
        id: row.id,
        date: row.date,
        amount: Number(row.amount),
        status: row.status,
      })),
    },
  });
}

export async function PATCH(request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const existing = await ownOrder(prisma, gate.ngoId, id);
  if (!existing) return jsonError("Purchase order not found.", 404);

  const body = await request.json().catch(() => null);
  const nextStatus = asString(body?.status);
  const receivedQty = (existing.lines ?? []).reduce((sum, line) => sum + receivedQtyOf(line), 0);

  if (nextStatus === "cancelled") {
    if (existing.status === "received") return jsonError("A fully received purchase order cannot be cancelled.");
    if (existing.status === "cancelled") return NextResponse.json({ item: publicOrder(existing) });
    const item = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "cancelled" },
      include: orderInclude,
    });
    return NextResponse.json({ item: publicOrder(item) });
  }

  if (existing.status === "cancelled") return jsonError("A cancelled purchase order cannot be edited.");
  if (existing.status === "received" || receivedQty > 0) {
    return jsonError("This purchase order already has receiving and cannot be edited.");
  }

  const meta = parseOrderMeta(body);
  if (meta.error) return jsonError(meta.error);
  const parsed = parseOrderLines(body);
  if (parsed.error) return jsonError(parsed.error);

  const supplier = await ownSupplier(prisma, gate.ngoId, meta.supplierId);
  if (!supplier) return jsonError("Supplier not found.", 404);

  const items = await loadOwnedItems(prisma, gate.ngoId, parsed.lines.map((line) => line.itemId));
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  for (const line of parsed.lines) {
    const item = byId[line.itemId];
    if (!item) return jsonError("Inventory item not found.", 404);
    if (item.status !== "active") return jsonError(`Cannot order inactive item ${item.name}.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderLine.deleteMany({ where: { orderId: id, ngoId: gate.ngoId } });
    return tx.purchaseOrder.update({
      where: { id },
      data: {
        supplier: supplier.name,
        supplierId: supplier.id,
        notes: meta.notes,
        total: parsed.total,
        date: meta.date,
        status: "open",
        lines: {
          create: parsed.lines.map((line) => ({
            ngoId: gate.ngoId,
            itemId: line.itemId,
            sku: byId[line.itemId].sku,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
          })),
        },
      },
      include: orderInclude,
    });
  });

  return NextResponse.json({ item: publicOrder(updated) });
}
