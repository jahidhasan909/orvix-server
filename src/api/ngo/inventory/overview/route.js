import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireInventory } from "#lib/require-inventory.js";
import { publicItem, publicTransaction, nameMaps } from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireInventory("view");
  if (gate.error) return jsonError(gate.error, gate.status);

  const [items, recentTx, recentReceive, recentIssue] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { ngoId: gate.ngoId },
      include: { category: { select: { name: true } } },
    }),
    prisma.stockTransaction.findMany({
      where: { ngoId: gate.ngoId },
      orderBy: { date: "desc" },
      take: 8,
      include: { item: { select: { name: true } } },
    }),
    prisma.receivingRecord.findMany({
      where: { ngoId: gate.ngoId },
      orderBy: { date: "desc" },
      take: 5,
      include: { item: { select: { name: true, sku: true } }, supplier: { select: { name: true } } },
    }),
    prisma.distributionRecord.findMany({
      where: { ngoId: gate.ngoId },
      orderBy: { date: "desc" },
      take: 5,
    }),
  ]);

  const mapped = items.map((item) => publicItem(item));
  const names = await nameMaps(prisma, gate.ngoId);

  return NextResponse.json({
    totals: {
      items: mapped.length,
      available: mapped.reduce((sum, item) => sum + item.quantity, 0),
      low: mapped.filter((item) => item.stockStatus === "low").length,
      out: mapped.filter((item) => item.stockStatus === "out").length,
    },
    recentTransactions: recentTx.map((row) => publicTransaction(row, names)),
    recentReceipts: recentReceive.map((row) => ({
      id: row.id,
      date: row.date,
      sku: row.sku,
      itemName: row.item?.name || row.sku,
      quantity: row.quantity,
      supplierName: row.supplier?.name || "",
      reference: row.reference || "",
    })),
    recentIssues: recentIssue.map((row) => ({
      id: row.id,
      date: row.date,
      itemName: row.item,
      quantity: row.quantity,
      siteId: row.siteId || "",
    })),
  });
}
