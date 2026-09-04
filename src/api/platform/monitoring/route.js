import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const [inactiveNgos, pendingByNgo, recentNgos, recentAudit] = await Promise.all([
    prisma.ngo.findMany({
      where: { status: "inactive" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, name: true, updatedAt: true },
    }),
    prisma.resourceRequest.groupBy({
      by: ["ngoId"],
      where: { status: "pending" },
      _count: { _all: true },
    }),
    prisma.ngo.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, status: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { at: "desc" },
      take: 8,
    }),
  ]);

  const ngoNames = await prisma.ngo.findMany({
    where: { id: { in: pendingByNgo.map((row) => row.ngoId) } },
    select: { id: true, name: true },
  });
  const nameById = Object.fromEntries(ngoNames.map((row) => [row.id, row.name]));

  return NextResponse.json({
    inactiveNgos,
    pendingRequests: pendingByNgo
      .map((row) => ({ ngoId: row.ngoId, ngoName: nameById[row.ngoId] || row.ngoId, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    recentNgos,
    recentAudit,
  });
}
