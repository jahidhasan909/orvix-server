import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireInventory } from "#lib/require-inventory.js";
import {
  TX,
  applyStockChange,
  assertProjectSite,
  ownItem,
  parseDate,
  positiveInt,
} from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireInventory("view");
  if (gate.error) return jsonError(gate.error, gate.status);

  const where = { ngoId: gate.ngoId };
  if (gate.role !== "ngo_admin" && !gate.canIssue && !gate.canManage) {
    where.workerId = gate.userId;
  }

  const items = await prisma.distributionRecord.findMany({
    where,
    orderBy: { date: "desc" },
  });
  return NextResponse.json({
    items: items.map((row) => ({
      id: row.id,
      date: row.date,
      itemId: row.itemId || "",
      itemName: row.item,
      quantity: row.quantity,
      workerId: row.workerId || "",
      projectId: row.projectId || "",
      siteId: row.siteId || "",
      reason: row.reason || "",
      notes: row.notes || "",
      requestId: row.requestId || "",
      issuedBy: row.issuedBy || "",
    })),
  });
}

export async function POST(request) {
  const gate = await requireInventory("issue");
  if (gate.error) {
    const admin = await requireInventory("manage");
    if (admin.error) return jsonError(gate.error, gate.status);
    return issueStock(admin, await request.json().catch(() => null));
  }
  return issueStock(gate, await request.json().catch(() => null));
}

async function issueStock(gate, body) {
  const itemId = asString(body?.itemId);
  const quantity = positiveInt(body?.quantity);
  const workerId = asString(body?.workerId) || null;
  const projectId = asString(body?.projectId) || null;
  const siteId = asString(body?.siteId) || null;
  const reason = asString(body?.reason) || null;
  const notes = asString(body?.notes) || null;
  const requestId = asString(body?.requestId) || null;
  const type = asString(body?.type) === TX.DISTRIBUTION ? TX.DISTRIBUTION : TX.ISSUE;
  const date = parseDate(body?.date);

  if (!itemId) return jsonError("An inventory item is required.");
  if (!quantity || quantity < 1) return jsonError("Quantity must be at least 1.");

  const item = await ownItem(prisma, gate.ngoId, itemId);
  if (!item) return jsonError("Item not found.", 404);
  if (item.status !== "active") return jsonError("Cannot issue an inactive item.");

  const scoped = await assertProjectSite(prisma, gate.ngoId, projectId, siteId);
  if (scoped.error) return jsonError(scoped.error);

  if (workerId) {
    const worker = await prisma.user.findFirst({
      where: { id: workerId, ngoId: gate.ngoId, role: "worker" },
    });
    if (!worker) return jsonError("The selected worker does not belong to this NGO.");
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const { transaction } = await applyStockChange(tx, {
        ngoId: gate.ngoId,
        itemId,
        delta: -quantity,
        type,
        workerId,
        projectId,
        siteId,
        notes: reason || notes,
        createdBy: gate.userId,
        reference: requestId,
        date,
      });

      const distribution = await tx.distributionRecord.create({
        data: {
          ngoId: gate.ngoId,
          itemId,
          item: item.name,
          quantity,
          workerId,
          projectId,
          siteId,
          reason,
          notes,
          requestId,
          issuedBy: gate.userId,
          date,
        },
      });

      if (requestId) {
        const req = await tx.resourceRequest.findFirst({
          where: { id: requestId, ngoId: gate.ngoId },
        });
        if (req && req.status === "approved") {
          await tx.resourceRequest.update({
            where: { id: requestId },
            data: { status: "issued", issuedAt: date },
          });
        }
      }

      return { distribution, transaction };
    });

    return NextResponse.json({ item: created.distribution, transaction: created.transaction }, { status: 201 });
  } catch (error) {
    if (error.message === "INSUFFICIENT_STOCK") {
      return jsonError("Not enough stock available for this issue.");
    }
    console.error(error);
    return jsonError("Could not issue stock.", 500);
  }
}
