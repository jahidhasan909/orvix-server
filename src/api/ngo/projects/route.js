import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import {
  parseProjectBody,
  parseWorkerIds,
  publicProject,
  syncProjectWorkers,
  workersForAssignment,
} from "#lib/project-site.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const projects = await prisma.project.findMany({
    where: { ngoId: gate.ngoId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { sites: true } },
    },
  });

  return NextResponse.json({ items: projects.map((project) => publicProject(project)) });
}

export async function POST(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const parsed = parseProjectBody(body);
  if (parsed.error) return jsonError(parsed.error);

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

  const project = await prisma.project.create({
    data: {
      ngoId: gate.ngoId,
      ...parsed.data,
    },
    include: { _count: { select: { sites: true } } },
  });

  if (workerIds.length) {
    await syncProjectWorkers(prisma, { ngoId: gate.ngoId, projectId: project.id, workerIds });
  }

  const workers = await workersForAssignment(prisma, gate.ngoId, { projectId: project.id });
  return NextResponse.json({ item: publicProject(project, { workers }) }, { status: 201 });
}
