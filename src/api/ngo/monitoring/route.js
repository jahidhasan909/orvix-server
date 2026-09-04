import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);
  const ngoId = gate.ngoId;

  const [pendingLeave, pendingRequests, openOrders, stockItems, recentTx, recentRequests, recentLeave] = await Promise.all([
    prisma.leaveRequest.count({ where: { ngoId, status: "pending" } }),
    prisma.resourceRequest.count({ where: { ngoId, status: "pending" } }),
    prisma.purchaseOrder.count({ where: { ngoId, status: { in: ["open", "partial"] } } }),
    prisma.inventoryItem.findMany({
      where: { ngoId, status: "active" },
      select: { name: true, quantity: true, minLevel: true },
    }),
    prisma.stockTransaction.findMany({
      where: { ngoId },
      orderBy: { date: "desc" },
      take: 8,
      include: { item: { select: { name: true } } },
    }),
    prisma.resourceRequest.findMany({
      where: { ngoId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.leaveRequest.findMany({
      where: { ngoId, status: "pending" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
  ]);

  const lowStock = stockItems.filter(
    (item) => item.quantity <= 0 || (item.minLevel > 0 && item.quantity <= item.minLevel)
  );

  return NextResponse.json({
    pendingLeave,
    pendingRequests,
    openOrders,
    lowStockCount: lowStock.length,
    lowStock: lowStock.slice(0, 8).map((item) => ({ name: item.name, quantity: item.quantity })),
    transactions: recentTx.map((row) => ({
      id: row.id,
      date: row.date,
      type: row.type,
      itemName: row.item?.name || row.sku,
      quantity: row.quantity,
    })),
    requests: recentRequests.map((row) => ({
      id: row.id,
      item: row.item,
      quantity: row.quantity,
      status: row.status,
      requestedBy: row.requestedBy,
    })),
    leave: recentLeave.map((row) => ({
      id: row.id,
      worker: row.user?.name || row.worker,
      type: row.type,
      days: row.days,
      status: row.status,
    })),
  });
}
