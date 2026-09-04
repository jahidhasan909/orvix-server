import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(_request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await prisma.document.findFirst({ where: { id, ngoId: gate.ngoId } });
  if (!existing) return jsonError("Document not found.", 404);
  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
