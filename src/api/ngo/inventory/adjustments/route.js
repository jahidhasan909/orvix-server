import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireInventory } from "#lib/require-inventory.js";
import { TX, applyStockChange, ownItem, parseDate, positiveInt } from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireInventory("view");
  if (gate.error) return jsonError(gate.error, gate.status);

  const items = await prisma.stockAdjustment.findMany({
    where: { ngoId: gate.ngoId },
    orderBy: { date: "desc" },
    include: { item: { select: { name: true } } },
  });
  return NextResponse.json({
    items: items.map((row) => ({
      id: row.id,
      date: row.date,
      sku: row.sku,
      itemName: row.item?.name || row.sku,
      quantity: row.quantity,
      quantityBefore: row.quantityBefore,
      quantityAfter: row.quantityAfter,
      reason: row.reason || "",
    })),
  });
}

export async function POST(request) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const itemId = asString(body?.itemId);
  const direction = asString(body?.direction) === "decrease" ? "decrease" : "increase";
  const amount = positiveInt(body?.quantity);
  const reason = asString(body?.reason);
  const date = parseDate(body?.date);

  if (!itemId) return jsonError("An inventory item is required.");
  if (!amount || amount < 1) return jsonError("Quantity must be at least 1.");
  if (!reason) return jsonError("An adjustment reason is required.");

  const item = await ownItem(prisma, gate.ngoId, itemId);
  if (!item) return jsonError("Item not found.", 404);

  const delta = direction === "decrease" ? -amount : amount;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const { item: current, next, transaction } = await applyStockChange(tx, {
        ngoId: gate.ngoId,
        itemId,
        delta,
        type: TX.ADJUSTMENT,
        notes: reason,
        createdBy: gate.userId,
        date,
      });
      const adjustment = await tx.stockAdjustment.create({
        data: {
          ngoId: gate.ngoId,
          itemId,
          sku: current.sku,
          quantity: delta,
          quantityBefore: current.quantity,
          quantityAfter: next,
          reason,
          createdBy: gate.userId,
          date,
        },
      });
      return { adjustment, transaction };
    });
    return NextResponse.json({ item: created.adjustment, transaction: created.transaction }, { status: 201 });
  } catch (error) {
    if (error.message === "INSUFFICIENT_STOCK") {
      return jsonError("Adjustment would make stock negative.");
    }
    console.error(error);
    return jsonError("Could not save the adjustment.", 500);
  }
}
