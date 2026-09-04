import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import { ROLES } from "#lib/navigation.js";
import { dateKey, utcDate } from "#lib/payroll.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function countsBy(rows, key = "status") {
  return Object.fromEntries((rows ?? []).map((row) => [row[key], row._count._all]));
}

export async function GET() {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);
  const ngoId = gate.ngoId;
  const today = utcDate(dateKey(new Date()));
  const tomorrow = today ? new Date(today.getTime() + 86400000) : null;

  const [
    projects,
    workers,
    pendingRequests,
    stockItems,
    attendanceRows,
    requestRows,
    projectRows,
    workerRows,
    leaveRows,
  ] = await Promise.all([
    prisma.project.count({ where: { ngoId, status: "active" } }),
    prisma.user.count({ where: { ngoId, role: ROLES.WORKER } }),
    prisma.resourceRequest.count({ where: { ngoId, status: "pending" } }),
    prisma.inventoryItem.findMany({
      where: { ngoId, status: "active" },
      select: { quantity: true, minLevel: true },
    }),
    today
      ? prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { ngoId, date: { gte: today, lt: tomorrow } },
          _count: { _all: true },
        })
      : [],
    prisma.resourceRequest.groupBy({
      by: ["status"],
      where: { ngoId },
      _count: { _all: true },
    }),
    prisma.project.groupBy({
      by: ["status"],
      where: { ngoId },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["status"],
      where: { ngoId, role: ROLES.WORKER },
      _count: { _all: true },
    }),
    prisma.leaveRequest.groupBy({
      by: ["status"],
      where: { ngoId },
      _count: { _all: true },
    }),
  ]);

  const lowStock = stockItems.filter(
    (item) => item.quantity <= 0 || (item.minLevel > 0 && item.quantity <= item.minLevel)
  ).length;
  const attendanceByStatus = countsBy(attendanceRows);
  const recordedToday = Object.values(attendanceByStatus).reduce((sum, value) => sum + value, 0);

  return NextResponse.json({
    projects,
    workers,
    pendingRequests,
    lowStock,
    charts: {
      attendanceToday: {
        present: attendanceByStatus.present || 0,
        absent: attendanceByStatus.absent || 0,
        leave: attendanceByStatus.leave || 0,
        holiday: attendanceByStatus.holiday || 0,
        unmarked: Math.max(0, workers - recordedToday),
      },
      requests: countsBy(requestRows),
      projects: countsBy(projectRows),
      workers: countsBy(workerRows),
      leave: countsBy(leaveRows),
    },
  });
}
