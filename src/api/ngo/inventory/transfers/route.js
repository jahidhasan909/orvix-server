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

  const items = await prisma.stockTransfer.findMany({
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
      from: row.from,
      to: row.to,
      fromSiteId: row.fromSiteId || "",
      toSiteId: row.toSiteId || "",
      status: row.status,
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
  const fromSiteId = asString(body?.fromSiteId) || null;
  const toSiteId = asString(body?.toSiteId) || null;
  const notes = asString(body?.notes) || null;
  const date = parseDate(body?.date);

  if (!itemId) return jsonError("An inventory item is required.");
  if (!quantity || quantity < 1) return jsonError("Quantity must be at least 1.");
  if (!fromSiteId || !toSiteId) return jsonError("From and to sites are required.");
  if (fromSiteId === toSiteId) return jsonError("From and to sites must be different.");

  const [item, fromSite, toSite] = await Promise.all([
    ownItem(prisma, gate.ngoId, itemId),
    prisma.site.findFirst({ where: { id: fromSiteId, ngoId: gate.ngoId } }),
    prisma.site.findFirst({ where: { id: toSiteId, ngoId: gate.ngoId } }),
  ]);
  if (!item) return jsonError("Item not found.", 404);
  if (!fromSite || !toSite) return jsonError("Both sites must belong to this NGO.");
  if (item.quantity < quantity) return jsonError("Not enough stock available to transfer.");

  try {
    const created = await prisma.$transaction(async (tx) => {
      const { transaction } = await applyStockChange(tx, {
        ngoId: gate.ngoId,
        itemId,
        delta: 0,
        type: TX.TRANSFER,
        siteId: toSiteId,
        notes: notes || `Transfer ${fromSite.name} → ${toSite.name}`,
        createdBy: gate.userId,
        reference: `${fromSiteId}:${toSiteId}`,
        date,
      });
      const transfer = await tx.stockTransfer.create({
        data: {
          ngoId: gate.ngoId,
          itemId,
          sku: item.sku,
          quantity,
          from: fromSite.name,
          to: toSite.name,
          fromSiteId,
          toSiteId,
          notes,
          createdBy: gate.userId,
          date,
          status: "completed",
        },
      });
      return { transfer, transaction };
    });
    return NextResponse.json({ item: created.transfer, transaction: created.transaction }, { status: 201 });
  } catch (error) {
    console.error(error);
    return jsonError("Could not record the transfer.", 500);
  }
}
