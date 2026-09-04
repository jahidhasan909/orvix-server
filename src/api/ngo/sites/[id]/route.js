import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import {
  parseSiteBody,
  parseWorkerIds,
  publicSite,
  stripSiteAssignments,
  syncSiteWorkers,
  workersForAssignment,
} from "#lib/project-site.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function ownSite(ngoId, id) {
  return prisma.site.findFirst({
    where: { id, ngoId },
    include: { project: { select: { id: true, name: true } } },
  });
}

async function ownProject(ngoId, projectId) {
  if (!projectId) return null;
  return prisma.project.findFirst({
    where: { id: projectId, ngoId },
    select: { id: true, name: true },
  });
}

export async function GET(_request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const site = await ownSite(gate.ngoId, id);
  if (!site) return jsonError("Site not found.", 404);

  const workers = await workersForAssignment(prisma, gate.ngoId, { siteId: id });
  return NextResponse.json({ item: publicSite(site, { workers }) });
}

export async function PATCH(request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const existing = await ownSite(gate.ngoId, id);
  if (!existing) return jsonError("Site not found.", 404);

  const body = await request.json().catch(() => null);
  const workerIds = parseWorkerIds(body);
  if (workerIds) {
    const allowed = await prisma.user.findMany({
      where: { ngoId: gate.ngoId, role: "worker", id: { in: workerIds } },
      select: { id: true },
    });
    if (allowed.length !== workerIds.length) {
      return jsonError("One or more workers do not belong to this NGO.");
    }
    await syncSiteWorkers(prisma, {
      ngoId: gate.ngoId,
      siteId: id,
      projectId: existing.projectId,
      workerIds,
    });
  }

  const hasFields = ["name", "status", "projectId", "location", "description", "startDate", "endDate"].some(
    (key) => body?.[key] !== undefined
  );
  if (hasFields) {
    const parsed = parseSiteBody(body);
    if (parsed.error) return jsonError(parsed.error);
    const project = await ownProject(gate.ngoId, parsed.data.projectId);
    if (!project) return jsonError("The selected project does not belong to this NGO.");
    await prisma.site.update({
      where: { id },
      data: parsed.data,
    });
  }

  const site = await ownSite(gate.ngoId, id);
  const workers = await workersForAssignment(prisma, gate.ngoId, { siteId: id });
  return NextResponse.json({ item: publicSite(site, { workers }) });
}

export async function DELETE(_request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const site = await ownSite(gate.ngoId, id);
  if (!site) return jsonError("Site not found.", 404);

  await prisma.site.delete({ where: { id } });
  await stripSiteAssignments(prisma, { ngoId: gate.ngoId, siteId: id });
  return NextResponse.json({ ok: true });
}
