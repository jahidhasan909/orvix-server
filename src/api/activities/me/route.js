import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { ROLES } from "#lib/navigation.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const STATUSES = ["planned", "in_progress", "done"];

function publicActivity(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    projectId: row.projectId || "",
    projectName: row.project?.name || "",
    siteId: row.siteId || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  const gate = await requireNgoSession([ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);
  const items = await prisma.activity.findMany({
    where: { ngoId: gate.ngoId, assigneeId: gate.userId },
    orderBy: { updatedAt: "desc" },
    include: { project: { select: { name: true } } },
  });
  return NextResponse.json({ items: items.map(publicActivity) });
}

export async function PATCH(request) {
  const gate = await requireNgoSession([ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);
  const body = await request.json().catch(() => null);
  const id = asString(body?.id);
  const status = asString(body?.status);
  if (!id) return jsonError("Activity id is required.");
  if (!STATUSES.includes(status)) return jsonError("Invalid activity status.");

  const existing = await prisma.activity.findFirst({
    where: { id, ngoId: gate.ngoId, assigneeId: gate.userId },
  });
  if (!existing) return jsonError("Activity not found.", 404);

  const item = await prisma.activity.update({
    where: { id },
    data: { status },
    include: { project: { select: { name: true } } },
  });
  return NextResponse.json({ item: publicActivity(item) });
}
