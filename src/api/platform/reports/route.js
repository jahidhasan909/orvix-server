import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const kind = new URL(request.url).searchParams.get("kind") || "ngos";

  if (kind === "users") {
    const [platformAdmins, ngoAdmins, workers, inactive] = await Promise.all([
      prisma.user.count({ where: { role: ROLES.PLATFORM_ADMIN } }),
      prisma.user.count({ where: { role: ROLES.NGO_ADMIN } }),
      prisma.user.count({ where: { role: ROLES.WORKER } }),
      prisma.user.count({ where: { status: "inactive" } }),
    ]);
    return NextResponse.json({ kind, platformAdmins, ngoAdmins, workers, inactive });
  }

  if (kind === "operations") {
    const [projects, sites, attendance, pendingLeave, pendingRequests] = await Promise.all([
      prisma.project.count(),
      prisma.site.count(),
      prisma.attendanceRecord.count(),
      prisma.leaveRequest.count({ where: { status: "pending" } }),
      prisma.resourceRequest.count({ where: { status: "pending" } }),
    ]);
    return NextResponse.json({ kind, projects, sites, attendance, pendingLeave, pendingRequests });
  }

  if (kind === "supply") {
    const [items, purchaseOrders, issues, documents] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.purchaseOrder.count(),
      prisma.distributionRecord.count(),
      prisma.document.count(),
    ]);
    return NextResponse.json({ kind, items, purchaseOrders, issues, documents });
  }

  const ngos = await prisma.ngo.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      category: true,
      _count: { select: { users: true, projects: true, sites: true } },
    },
  });

  return NextResponse.json({
    kind: "ngos",
    items: ngos.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      category: row.category,
      users: row._count.users,
      projects: row._count.projects,
      sites: row._count.sites,
    })),
  });
}
