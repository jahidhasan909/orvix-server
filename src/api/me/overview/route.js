import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { ROLES } from "#lib/navigation.js";
import { dateKey, utcDate } from "#lib/payroll.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireNgoSession([ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);

  const user = await prisma.user.findFirst({
    where: { id: gate.userId, ngoId: gate.ngoId, role: ROLES.WORKER },
    select: { assignedProjectIds: true, assignedSiteIds: true, joiningDate: true },
  });
  if (!user) return jsonError("Worker not found.", 404);

  const today = utcDate(dateKey(new Date())) ?? new Date();
  const [
    attendance,
    pendingRequests,
    unreadNotifications,
    pendingLeave,
    issued,
    activities,
    forms,
    openForms,
  ] = await Promise.all([
    prisma.attendanceRecord.findFirst({
      where: { ngoId: gate.ngoId, userId: gate.userId, date: today },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
    prisma.resourceRequest.count({ where: { ngoId: gate.ngoId, requestedById: gate.userId, status: "pending" } }),
    prisma.notification.count({ where: { userId: gate.userId, unread: true } }),
    prisma.leaveRequest.count({ where: { ngoId: gate.ngoId, userId: gate.userId, status: "pending" } }),
    prisma.distributionRecord.count({ where: { ngoId: gate.ngoId, workerId: gate.userId } }),
    prisma.activity.count({ where: { ngoId: gate.ngoId, assigneeId: gate.userId } }),
    prisma.dataEntryRecord.count({ where: { ngoId: gate.ngoId, assigneeId: gate.userId } }),
    prisma.dataEntryRecord.aggregate({
      where: { ngoId: gate.ngoId, assigneeId: gate.userId, status: "open" },
      _sum: { records: true },
    }),
  ]);

  return NextResponse.json({
    joiningDate: user.joiningDate ? dateKey(user.joiningDate) : "",
    attendance: attendance?.status || "unmarked",
    assignedProjects: (user.assignedProjectIds ?? []).length,
    assignedSites: (user.assignedSiteIds ?? []).length,
    pendingRequests,
    unreadNotifications,
    pendingLeave,
    issued,
    activities,
    forms,
    queuedRecords: openForms._sum.records ?? 0,
  });
}
