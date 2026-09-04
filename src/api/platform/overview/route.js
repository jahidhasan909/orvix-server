import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const [
    ngos,
    activeNgos,
    inactiveNgos,
    workers,
    ngoAdmins,
    platformAdmins,
    projects,
    sites,
    pendingRequests,
    auditEvents,
  ] = await Promise.all([
    prisma.ngo.count(),
    prisma.ngo.count({ where: { status: "active" } }),
    prisma.ngo.count({ where: { status: "inactive" } }),
    prisma.user.count({ where: { role: ROLES.WORKER } }),
    prisma.user.count({ where: { role: ROLES.NGO_ADMIN } }),
    prisma.user.count({ where: { role: ROLES.PLATFORM_ADMIN } }),
    prisma.project.count(),
    prisma.site.count(),
    prisma.resourceRequest.count({ where: { status: "pending" } }),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({
    ngos,
    activeNgos,
    inactiveNgos,
    workers,
    ngoAdmins,
    platformAdmins,
    projects,
    sites,
    pendingRequests,
    auditEvents,
    charts: {
      ngos: { active: activeNgos, inactive: inactiveNgos },
      users: {
        worker: workers,
        ngo_admin: ngoAdmins,
        platform_admin: platformAdmins,
      },
      operations: {
        projects,
        sites,
        pendingRequests,
        workers,
      },
    },
  });
}
