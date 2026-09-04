import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { positiveInt } from "#lib/inventory.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { ROLES } from "#lib/navigation.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function publicForm(row) {
  return {
    id: row.id,
    form: row.form,
    records: row.records,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET() {
  const gate = await requireNgoSession([ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);
  const items = await prisma.dataEntryRecord.findMany({
    where: { ngoId: gate.ngoId, assigneeId: gate.userId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ items: items.map(publicForm) });
}

export async function PATCH(request) {
  const gate = await requireNgoSession([ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);
  const body = await request.json().catch(() => null);
  const id = asString(body?.id);
  const records = positiveInt(body?.records, 0);
  const status = asString(body?.status) === "submitted" ? "submitted" : "open";
  if (!id) return jsonError("Form id is required.");

  const existing = await prisma.dataEntryRecord.findFirst({
    where: { id, ngoId: gate.ngoId, assigneeId: gate.userId },
  });
  if (!existing) return jsonError("Form not found.", 404);

  const item = await prisma.dataEntryRecord.update({
    where: { id },
    data: { records: records ?? existing.records, status },
  });
  return NextResponse.json({ item: publicForm(item) });
}
