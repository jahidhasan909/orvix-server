import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { asString } from "#lib/worker-payload.js";
import { requireInventory } from "#lib/require-inventory.js";
import { assertProjectSite, nameMaps, ownItem, positiveInt, publicRequest } from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const gate = await requireInventory("request");
  if (gate.error) return jsonError(gate.error, gate.status);

  const status = new URL(request.url).searchParams.get("status") || "";
  const where = { ngoId: gate.ngoId };
  if (status) where.status = status;
  if (gate.role === ROLES.WORKER) where.requestedById = gate.userId;

  const [rows, names] = await Promise.all([
    prisma.resourceRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { inventoryItem: { select: { name: true, sku: true, quantity: true } } },
    }),
    nameMaps(prisma, gate.ngoId),
  ]);

  return NextResponse.json({ items: rows.map((row) => publicRequest(row, names)) });
}

export async function POST(request) {
  const gate = await requireInventory("request");
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const itemId = asString(body?.itemId);
  const quantity = positiveInt(body?.quantity);
  const projectId = asString(body?.projectId) || null;
  const siteId = asString(body?.siteId) || null;
  const reason = asString(body?.reason) || null;
  const notes = asString(body?.notes) || null;

  if (!itemId) return jsonError("An inventory item is required.");
  if (!quantity || quantity < 1) return jsonError("Requested quantity must be at least 1.");

  const item = await ownItem(prisma, gate.ngoId, itemId);
  if (!item || item.status !== "active") return jsonError("Item not found.", 404);

  const scoped = await assertProjectSite(prisma, gate.ngoId, projectId, siteId);
  if (scoped.error) return jsonError(scoped.error);

  if (gate.role === ROLES.WORKER) {
    const assignedProjects = gate.session.user.assignedProjectIds ?? [];
    const assignedSites = gate.session.user.assignedSiteIds ?? [];
    if (projectId && assignedProjects.length && !assignedProjects.includes(projectId)) {
      return jsonError("You can only request for a project assigned to you.");
    }
    if (siteId && assignedSites.length && !assignedSites.includes(siteId)) {
      return jsonError("You can only request for a site assigned to you.");
    }
  }

  const created = await prisma.resourceRequest.create({
    data: {
      ngoId: gate.ngoId,
      itemId,
      item: item.name,
      quantity,
      projectId,
      siteId,
      reason,
      notes,
      requestedBy: gate.session.user.name || gate.session.user.email,
      requestedById: gate.userId,
      status: "pending",
    },
    include: { inventoryItem: { select: { name: true, sku: true, quantity: true } } },
  });

  return NextResponse.json({ item: publicRequest(created) }, { status: 201 });
}
