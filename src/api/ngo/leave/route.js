import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { parseLeaveBody, publicLeave } from "#lib/leave.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const include = { user: { select: { name: true } } };

export async function GET(request) {
  const gate = await requireNgoSession([ROLES.NGO_ADMIN, ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const where = { ngoId: gate.ngoId };
  if (status) where.status = status;
  if (gate.role === ROLES.WORKER) where.userId = gate.userId;

  const items = await prisma.leaveRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include,
  });
  return NextResponse.json({ items: items.map(publicLeave) });
}

export async function POST(request) {
  const gate = await requireNgoSession([ROLES.NGO_ADMIN, ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => ({}));
  const payload = body && typeof body === "object" ? { ...body } : {};
  if (gate.role === ROLES.WORKER) payload.userId = gate.userId;
  const parsed = parseLeaveBody(payload);
  if (parsed.error) return jsonError(parsed.error);

  const worker = await prisma.user.findFirst({
    where: { id: parsed.data.userId, ngoId: gate.ngoId, role: "worker" },
    select: { id: true, name: true },
  });
  if (!worker) return jsonError("Worker not found.", 404);
  if (gate.role === ROLES.WORKER && worker.id !== gate.userId) {
    return jsonError("You can only apply for your own leave.", 403);
  }

  const item = await prisma.leaveRequest.create({
    data: {
      ngoId: gate.ngoId,
      userId: worker.id,
      worker: worker.name,
      ...parsed.data,
      status: "pending",
    },
    include,
  });
  return NextResponse.json({ item: publicLeave(item) }, { status: 201 });
}
