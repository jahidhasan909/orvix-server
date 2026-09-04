import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import {
  parseProjectBody,
  parseWorkerIds,
  publicProject,
  stripProjectAssignments,
  syncProjectWorkers,
  workersForAssignment,
} from "#lib/project-site.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function ownProject(ngoId, id) {
  return prisma.project.findFirst({
    where: { id, ngoId },
    include: {
      sites: { orderBy: { name: "asc" } },
      _count: { select: { sites: true, activities: true } },
    },
  });
}

export async function GET(_request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const project = await ownProject(gate.ngoId, id);
  if (!project) return jsonError("Project not found.", 404);

  const workers = await workersForAssignment(prisma, gate.ngoId, { projectId: id });
  return NextResponse.json({ item: publicProject(project, { workers }) });
}

export async function PATCH(request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const existing = await ownProject(gate.ngoId, id);
  if (!existing) return jsonError("Project not found.", 404);

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
    await syncProjectWorkers(prisma, { ngoId: gate.ngoId, projectId: id, workerIds });
  }

  const hasFields = ["name", "status", "description", "manager", "startDate", "endDate"].some(
    (key) => body?.[key] !== undefined
  );
  if (hasFields) {
    const parsed = parseProjectBody(body);
    if (parsed.error) return jsonError(parsed.error);
    await prisma.project.update({
      where: { id },
      data: parsed.data,
    });
  }

  const project = await ownProject(gate.ngoId, id);
  const workers = await workersForAssignment(prisma, gate.ngoId, { projectId: id });
  return NextResponse.json({ item: publicProject(project, { workers }) });
}

export async function DELETE(_request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const project = await ownProject(gate.ngoId, id);
  if (!project) return jsonError("Project not found.", 404);

  if (project._count.sites > 0 || project._count.activities > 0) {
    const archived = await prisma.project.update({
      where: { id },
      data: { status: "archived" },
      include: {
        sites: { orderBy: { name: "asc" } },
        _count: { select: { sites: true } },
      },
    });
    const workers = await workersForAssignment(prisma, gate.ngoId, { projectId: id });
    return NextResponse.json({
      item: publicProject(archived, { workers }),
      archived: true,
      message: "Project has sites or activities, so it was archived instead of deleted.",
    });
  }

  await prisma.project.delete({ where: { id } });
  await stripProjectAssignments(prisma, { ngoId: gate.ngoId, projectId: id });
  return NextResponse.json({ ok: true });
}
