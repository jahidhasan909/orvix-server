import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { PERMISSIONS, ROLES } from "#lib/navigation.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const RELATED = ["ngo", "project", "worker", "supplier", "operational"];

function publicDoc(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category || "",
    relatedType: row.relatedType || "operational",
    relatedId: row.relatedId || "",
    url: row.url || "",
    notes: row.notes || "",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function canViewDocuments() {
  const gate = await requireNgoSession([ROLES.NGO_ADMIN, ROLES.WORKER]);
  if (gate.error) return gate;
  if (gate.role === ROLES.NGO_ADMIN) return gate;
  const permissions = gate.session.user.permissions ?? [];
  if (!permissions.includes(PERMISSIONS.DOCUMENTS_VIEW)) {
    return { error: "You cannot access documents.", status: 403 };
  }
  return gate;
}

async function assertRelated(ngoId, relatedType, relatedId) {
  if (!relatedId || relatedType === "operational" || relatedType === "ngo") return {};
  if (relatedType === "project") {
    const row = await prisma.project.findFirst({ where: { id: relatedId, ngoId }, select: { id: true } });
    return row ? {} : { error: "Project not found." };
  }
  if (relatedType === "worker") {
    const row = await prisma.user.findFirst({ where: { id: relatedId, ngoId, role: "worker" }, select: { id: true } });
    return row ? {} : { error: "Worker not found." };
  }
  if (relatedType === "supplier") {
    const row = await prisma.supplier.findFirst({ where: { id: relatedId, ngoId }, select: { id: true } });
    return row ? {} : { error: "Supplier not found." };
  }
  return {};
}

export async function GET() {
  const gate = await canViewDocuments();
  if (gate.error) return jsonError(gate.error, gate.status);
  const items = await prisma.document.findMany({
    where: { ngoId: gate.ngoId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ items: items.map(publicDoc) });
}

export async function POST(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const name = asString(body?.name);
  const relatedType = RELATED.includes(asString(body?.relatedType)) ? asString(body.relatedType) : "operational";
  const relatedId = asString(body?.relatedId) || null;
  const url = asString(body?.url) || null;
  const notes = asString(body?.notes) || null;
  const category = asString(body?.category) || relatedType;
  if (!name) return jsonError("Document name is required.");

  const related = await assertRelated(gate.ngoId, relatedType, relatedId);
  if (related.error) return jsonError(related.error, 404);

  const item = await prisma.document.create({
    data: {
      ngoId: gate.ngoId,
      name,
      category,
      relatedType,
      relatedId,
      url,
      notes,
      createdBy: gate.session.user.id,
    },
  });
  return NextResponse.json({ item: publicDoc(item) }, { status: 201 });
}
