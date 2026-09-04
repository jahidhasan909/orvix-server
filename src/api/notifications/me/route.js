import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";
import { ROLES } from "#lib/navigation.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function publicNote(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body || "",
    unread: row.unread,
    createdAt: row.createdAt,
  };
}

async function requireNotes() {
  const platform = await requirePlatformAdmin();
  if (!platform.error) return { userId: platform.userId, ngoId: null };
  return requireNgoSession([ROLES.WORKER, ROLES.NGO_ADMIN]);
}

function noteWhere(gate) {
  return gate.ngoId ? { userId: gate.userId, ngoId: gate.ngoId } : { userId: gate.userId };
}

export async function GET() {
  const gate = await requireNotes();
  if (gate.error) return jsonError(gate.error, gate.status);
  const items = await prisma.notification.findMany({
    where: noteWhere(gate),
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ items: items.map(publicNote) });
}

export async function PATCH(request) {
  const gate = await requireNotes();
  if (gate.error) return jsonError(gate.error, gate.status);
  const body = await request.json().catch(() => null);
  const id = asString(body?.id);
  if (asString(body?.action) === "readAll") {
    await prisma.notification.updateMany({
      where: { ...noteWhere(gate), unread: true },
      data: { unread: false },
    });
    return NextResponse.json({ ok: true });
  }
  if (!id) return jsonError("Notification id is required.");
  const existing = await prisma.notification.findFirst({ where: { id, ...noteWhere(gate) } });
  if (!existing) return jsonError("Notification not found.", 404);
  const item = await prisma.notification.update({
    where: { id },
    data: { unread: false },
  });
  return NextResponse.json({ item: publicNote(item) });
}
