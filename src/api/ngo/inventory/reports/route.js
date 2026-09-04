import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireInventory } from "#lib/require-inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireInventory("view");
  if (gate.error) return jsonError(gate.error, gate.status);

  const [items, receipts, issues] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { ngoId: gate.ngoId, status: "active" },
      include: { category: { select: { name: true } } },
    }),
    prisma.receivingRecord.findMany({ where: { ngoId: gate.ngoId } }),
    prisma.distributionRecord.findMany({ where: { ngoId: gate.ngoId } }),
  ]);

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category?.name || "",
      quantity: item.quantity,
      minLevel: item.minLevel,
      unit: item.unit || "pcs",
    })),
    receivedQty: receipts.reduce((sum, row) => sum + row.quantity, 0),
    issuedQty: issues.reduce((sum, row) => sum + row.quantity, 0),
  });
}
