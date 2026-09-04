import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import { designationLabel } from "#lib/worker-catalog.js";
import { PO_STATUS_LABELS } from "#lib/procurement.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function countBy(rows, key) {
  const map = {};
  for (const row of rows) {
    const value = row[key] || "unknown";
    map[value] = (map[value] || 0) + 1;
  }
  return Object.entries(map).map(([id, count]) => ({ id, count }));
}

export async function GET(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);
  const ngoId = gate.ngoId;
  const kind = new URL(request.url).searchParams.get("kind") || "operations";

  if (kind === "operations") {
    const [projects, sites, workers, pendingRequests, openOrders, pendingLeave] = await Promise.all([
      prisma.project.findMany({ where: { ngoId }, select: { status: true } }),
      prisma.site.count({ where: { ngoId } }),
      prisma.user.count({ where: { ngoId, role: "worker" } }),
      prisma.resourceRequest.count({ where: { ngoId, status: "pending" } }),
      prisma.purchaseOrder.count({ where: { ngoId, status: { in: ["open", "partial"] } } }),
      prisma.leaveRequest.count({ where: { ngoId, status: "pending" } }),
    ]);
    return NextResponse.json({
      kind,
      projects: countBy(projects, "status"),
      sites,
      workers,
      pendingRequests,
      openOrders,
      pendingLeave,
    });
  }

  if (kind === "workers") {
    const workers = await prisma.user.findMany({
      where: { ngoId, role: "worker" },
      select: { designation: true, designationOther: true, status: true, assignedProjectIds: true },
    });
    return NextResponse.json({
      kind,
      total: workers.length,
      byStatus: countBy(workers, "status"),
      byDesignation: workers.reduce((map, row) => {
        const label = designationLabel(row.designation, row.designationOther);
        map[label] = (map[label] || 0) + 1;
        return map;
      }, {}),
      assigned: workers.filter((row) => (row.assignedProjectIds ?? []).length > 0).length,
    });
  }

  if (kind === "attendance") {
    const from = new URL(request.url).searchParams.get("from");
    const to = new URL(request.url).searchParams.get("to");
    const where = { ngoId };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) where.date.lte = new Date(`${to}T23:59:59.999Z`);
    }
    const rows = await prisma.attendanceRecord.findMany({
      where,
      select: { status: true },
    });
    return NextResponse.json({
      kind,
      total: rows.length,
      byStatus: countBy(rows, "status"),
    });
  }

  if (kind === "procurement") {
    const [orders, purchases, receipts, suppliers] = await Promise.all([
      prisma.purchaseOrder.findMany({ where: { ngoId }, select: { status: true, total: true } }),
      prisma.purchase.findMany({ where: { ngoId }, select: { amount: true } }),
      prisma.receivingRecord.aggregate({ where: { ngoId }, _sum: { quantity: true } }),
      prisma.supplier.count({ where: { ngoId } }),
    ]);
    return NextResponse.json({
      kind,
      suppliers,
      orders: orders.length,
      byStatus: orders.reduce((map, row) => {
        const label = PO_STATUS_LABELS[row.status] || row.status;
        map[label] = (map[label] || 0) + 1;
        return map;
      }, {}),
      orderTotal: orders.reduce((sum, row) => sum + Number(row.total || 0), 0),
      purchaseTotal: purchases.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      receivedQty: receipts._sum.quantity || 0,
    });
  }

  return jsonError("Unknown report.");
}
