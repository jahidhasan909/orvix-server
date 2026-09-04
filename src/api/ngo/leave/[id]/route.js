import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import { publicLeave } from "#lib/leave.js";
import { notifyUser } from "#lib/notify.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await prisma.leaveRequest.findFirst({
    where: { id, ngoId: gate.ngoId },
    include: { user: { select: { name: true } } },
  });
  if (!existing) return jsonError("Leave request not found.", 404);
  if (existing.status !== "pending") return jsonError("Only pending leave can be updated.");

  const action = asString((await request.json().catch(() => null))?.action);
  if (action !== "approve" && action !== "reject") return jsonError("Use approve or reject.");

  const nextStatus = action === "approve" ? "approved" : "rejected";
  const item = await prisma.leaveRequest.update({
    where: { id },
    data: { status: nextStatus },
    include: { user: { select: { name: true } } },
  });
  await notifyUser(prisma, {
    ngoId: gate.ngoId,
    userId: existing.userId,
    title: `Leave ${nextStatus}`,
    body: `Your ${existing.type} leave request was ${nextStatus}.`,
  });
  return NextResponse.json({ item: publicLeave(item) });
}
