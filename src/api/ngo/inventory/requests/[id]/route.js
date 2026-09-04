import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { asString } from "#lib/worker-payload.js";
import { requireInventory } from "#lib/require-inventory.js";
import { TX, applyStockChange, nameMaps, publicRequest } from "#lib/inventory.js";
import { notifyUser } from "#lib/notify.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function own(ngoId, id) {
  return prisma.resourceRequest.findFirst({
    where: { id, ngoId },
    include: { inventoryItem: { select: { name: true, sku: true, quantity: true } } },
  });
}

export async function GET(_request, { params }) {
  const gate = await requireInventory("request");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const item = await own(gate.ngoId, id);
  if (!item) return jsonError("Request not found.", 404);
  if (gate.role === ROLES.WORKER && item.requestedById !== gate.userId) {
    return jsonError("Request not found.", 404);
  }
  return NextResponse.json({ item: publicRequest(item, await nameMaps(prisma, gate.ngoId)) });
}

export async function PATCH(request, { params }) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await own(gate.ngoId, id);
  if (!existing) return jsonError("Request not found.", 404);

  const body = await request.json().catch(() => null);
  const action = asString(body?.action);
  const decisionNote = asString(body?.decisionNote) || null;

  if (action === "approve") {
    if (existing.status !== "pending") return jsonError("Only pending requests can be approved.");
    const item = await prisma.resourceRequest.update({
      where: { id },
      data: { status: "approved", decisionNote, decidedBy: gate.userId },
      include: { inventoryItem: { select: { name: true, sku: true, quantity: true } } },
    });
    await notifyUser(prisma, {
      ngoId: gate.ngoId,
      userId: existing.requestedById,
      title: "Resource request approved",
      body: `${existing.item} × ${existing.quantity} was approved.`,
    });
    return NextResponse.json({ item: publicRequest(item, await nameMaps(prisma, gate.ngoId)) });
  }

  if (action === "reject") {
    if (existing.status !== "pending") return jsonError("Only pending requests can be rejected.");
    const item = await prisma.resourceRequest.update({
      where: { id },
      data: { status: "rejected", decisionNote, decidedBy: gate.userId },
      include: { inventoryItem: { select: { name: true, sku: true, quantity: true } } },
    });
    await notifyUser(prisma, {
      ngoId: gate.ngoId,
      userId: existing.requestedById,
      title: "Resource request rejected",
      body: `${existing.item} × ${existing.quantity} was rejected.`,
    });
    return NextResponse.json({ item: publicRequest(item, await nameMaps(prisma, gate.ngoId)) });
  }

  if (action === "issue") {
    if (existing.status !== "approved") return jsonError("Only approved requests can be issued.");
    if (!existing.itemId) return jsonError("This request has no inventory item linked.");

    try {
      await prisma.$transaction(async (tx) => {
        await applyStockChange(tx, {
          ngoId: gate.ngoId,
          itemId: existing.itemId,
          delta: -existing.quantity,
          type: TX.ISSUE,
          workerId: existing.requestedById,
          projectId: existing.projectId,
          siteId: existing.siteId,
          notes: existing.reason || existing.notes,
          createdBy: gate.userId,
          reference: existing.id,
        });
        await tx.distributionRecord.create({
          data: {
            ngoId: gate.ngoId,
            itemId: existing.itemId,
            item: existing.item,
            quantity: existing.quantity,
            workerId: existing.requestedById,
            projectId: existing.projectId,
            siteId: existing.siteId,
            reason: existing.reason,
            notes: existing.notes,
            requestId: existing.id,
            issuedBy: gate.userId,
          },
        });
        await tx.resourceRequest.update({
          where: { id },
          data: { status: "issued", issuedAt: new Date(), decisionNote, decidedBy: gate.userId },
        });
      });
    } catch (error) {
      if (error.message === "INSUFFICIENT_STOCK") {
        return jsonError("Not enough stock available to issue this request.");
      }
      console.error(error);
      return jsonError("Could not issue the request.", 500);
    }

    await notifyUser(prisma, {
      ngoId: gate.ngoId,
      userId: existing.requestedById,
      title: "Resource issued",
      body: `${existing.item} × ${existing.quantity} has been issued to you.`,
    });
    const item = await own(gate.ngoId, id);
    return NextResponse.json({ item: publicRequest(item, await nameMaps(prisma, gate.ngoId)) });
  }

  return jsonError("Unknown action. Use approve, reject, or issue.");
}
