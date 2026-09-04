import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import {
  parseSiteBody,
  parseWorkerIds,
  publicSite,
  syncSiteWorkers,
  workersForAssignment,
} from "#lib/project-site.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function ownProject(ngoId, projectId) {
  if (!projectId) return null;
  return prisma.project.findFirst({
    where: { id: projectId, ngoId },
    select: { id: true, name: true },
  });
}

export async function GET(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  const sites = await prisma.site.findMany({
    where: {
      ngoId: gate.ngoId,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { project: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ items: sites.map((site) => publicSite(site)) });
}

export async function POST(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const parsed = parseSiteBody(body);
  if (parsed.error) return jsonError(parsed.error);

  const project = await ownProject(gate.ngoId, parsed.data.projectId);
  if (!project) return jsonError("The selected project does not belong to this NGO.");

  const workerIds = parseWorkerIds(body) ?? [];
  if (workerIds.length) {
    const allowed = await prisma.user.findMany({
      where: { ngoId: gate.ngoId, role: "worker", id: { in: workerIds } },
      select: { id: true },
    });
    if (allowed.length !== workerIds.length) {
      return jsonError("One or more workers do not belong to this NGO.");
    }
  }

  const site = await prisma.site.create({
    data: {
      ngoId: gate.ngoId,
      ...parsed.data,
    },
    include: { project: { select: { id: true, name: true } } },
  });

  if (workerIds.length) {
    await syncSiteWorkers(prisma, {
      ngoId: gate.ngoId,
      siteId: site.id,
      projectId: site.projectId,
      workerIds,
    });
  }

  const workers = await workersForAssignment(prisma, gate.ngoId, { siteId: site.id });
  return NextResponse.json({ item: publicSite(site, { workers }) }, { status: 201 });
}
