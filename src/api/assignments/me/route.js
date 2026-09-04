import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { asIdList, publicProject, publicSite } from "#lib/project-site.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireNgoSession([ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);

  const user = await prisma.user.findFirst({
    where: { id: gate.userId, ngoId: gate.ngoId, role: ROLES.WORKER },
    select: { assignedProjectIds: true, assignedSiteIds: true },
  });

  if (!user) return jsonError("Worker not found.", 404);

  const projectIds = asIdList(user.assignedProjectIds);
  const siteIds = asIdList(user.assignedSiteIds);

  const sites = siteIds.length
    ? await prisma.site.findMany({
        where: { ngoId: gate.ngoId, id: { in: siteIds } },
        orderBy: { name: "asc" },
        include: { project: { select: { id: true, name: true } } },
      })
    : [];

  const allProjectIds = [...new Set([
    ...projectIds,
    ...sites.map((site) => site.projectId).filter(Boolean),
  ])];

  const projects = allProjectIds.length
    ? await prisma.project.findMany({
        where: { ngoId: gate.ngoId, id: { in: allProjectIds } },
        orderBy: { name: "asc" },
        include: { _count: { select: { sites: true } } },
      })
    : [];

  return NextResponse.json({
    projects: projects.map((project) => publicProject(project)),
    sites: sites.map((site) => publicSite(site)),
  });
}
