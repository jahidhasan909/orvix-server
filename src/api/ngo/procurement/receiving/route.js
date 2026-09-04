import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import { TX, applyStockChange, assertProjectSite, parseDate, positiveInt } from "#lib/inventory.js";
import {
  orderInclude,
  ownOrder,
  poStatusFromLines,
  publicOrder,
  publicReceipt,
  remainingQtyOf,
  roundMoney,
} from "#lib/procurement.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId") || "";

  const [orders, receipts] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { ngoId: gate.ngoId, status: { in: ["open", "partial"] } },
      orderBy: { date: "desc" },
      include: orderInclude,
    }),
    prisma.receivingRecord.findMany({
      where: {
        ngoId: gate.ngoId,
        ...(orderId ? { orderId } : { orderId: { not: null } }),
      },
      orderBy: { date: "desc" },
      take: 50,
      include: {
        item: { select: { name: true, unit: true } },
        supplier: { select: { name: true } },
        order: { select: { supplier: true, vendor: { select: { name: true } } } },
      },
    }),
  ]);

  const eligible = orders.map((row) => publicOrder(row)).filter((row) => row.remainingQty > 0);
  return NextResponse.json({
    orders: eligible,
    receipts: receipts.map((row) => publicReceipt(row)),
  });
}

export async function POST(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const orderId = asString(body?.orderId);
  const notes = asString(body?.notes) || null;
  const projectId = asString(body?.projectId) || null;
  const siteId = asString(body?.siteId) || null;
  const date = parseDate(body?.date);

  if (!orderId) return jsonError("A purchase order is required.");
  if (!Array.isArray(body?.lines) || body.lines.length === 0) {
    return jsonError("Enter a received quantity for at least one line.");
  }

  const incoming = [];
  for (const raw of body.lines) {
    const lineId = asString(raw?.lineId);
    const quantity = Number(raw?.quantity);
    if (!lineId) return jsonError("Each receiving line must reference a purchase order line.");
    if (!Number.isFinite(quantity) || quantity < 0) return jsonError("Received quantity cannot be negative.");
    if (quantity === 0) continue;
    const qty = positiveInt(quantity);
    if (!qty || qty < 1) return jsonError("Received quantity must be a whole number greater than 0.");
    incoming.push({ lineId, quantity: qty });
  }
  if (!incoming.length) return jsonError("Received quantity must be greater than 0.");

  const scoped = await assertProjectSite(prisma, gate.ngoId, projectId, siteId);
  if (scoped.error) return jsonError(scoped.error);

  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${orderId} AND "ngoId" = ${gate.ngoId} FOR UPDATE`;

      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, ngoId: gate.ngoId },
        include: {
          ...orderInclude,
          lines: {
            include: {
              item: { select: { name: true, unit: true, status: true, sku: true } },
              receiving: { select: { quantity: true } },
            },
          },
        },
      });
      if (!order) {
        const error = new Error("ORDER_NOT_FOUND");
        error.status = 404;
        throw error;
      }
      if (order.status === "cancelled") {
        const error = new Error("ORDER_CANCELLED");
        error.status = 400;
        throw error;
      }
      if (order.status === "received") {
        const error = new Error("ORDER_RECEIVED");
        error.status = 400;
        throw error;
      }

      const byLine = Object.fromEntries((order.lines ?? []).map((line) => [line.id, line]));
      const movements = [];
      for (const row of incoming) {
        const line = byLine[row.lineId];
        if (!line || line.orderId !== order.id) {
          const error = new Error("LINE_NOT_FOUND");
          error.status = 404;
          throw error;
        }
        const remaining = remainingQtyOf(line);
        if (row.quantity > remaining) {
          const error = new Error("OVER_RECEIVE");
          error.status = 400;
          error.detail = `Cannot receive ${row.quantity} of ${line.item?.name || line.sku}. Remaining quantity is ${remaining}.`;
          throw error;
        }
        movements.push({ line, quantity: row.quantity });
      }

      const amount = roundMoney(
        movements.reduce((sum, row) => sum + row.quantity * Number(row.line.unitPrice), 0)
      );

      const purchase = await tx.purchase.create({
        data: {
          ngoId: gate.ngoId,
          orderId: order.id,
          supplierId: order.supplierId,
          amount,
          status: "posted",
          notes,
          date,
        },
      });

      const receipts = [];
      const transactions = [];
      for (const row of movements) {
        const unitCost = Number(row.line.unitPrice);
        const totalCost = roundMoney(row.quantity * unitCost);
        const { transaction } = await applyStockChange(tx, {
          ngoId: gate.ngoId,
          itemId: row.line.itemId,
          delta: row.quantity,
          type: TX.RECEIVED,
          supplierId: order.supplierId,
          projectId,
          siteId,
          reference: purchase.id,
          notes: notes || `Received against purchase order ${order.id}`,
          createdBy: gate.session.user.id,
          unitCost,
          totalCost,
          date,
        });
        transactions.push(transaction);

        const receipt = await tx.receivingRecord.create({
          data: {
            ngoId: gate.ngoId,
            orderId: order.id,
            lineId: row.line.id,
            purchaseId: purchase.id,
            supplierId: order.supplierId,
            itemId: row.line.itemId,
            sku: row.line.sku,
            quantity: row.quantity,
            unitCost,
            totalCost,
            projectId,
            siteId,
            reference: purchase.id,
            notes,
            createdBy: gate.session.user.id,
            date,
          },
        });
        receipts.push(receipt);
      }

      const refreshed = await tx.purchaseOrder.findFirst({
        where: { id: order.id },
        include: {
          lines: { include: { receiving: { select: { quantity: true } } } },
        },
      });
      const nextStatus = poStatusFromLines(refreshed.lines ?? []);
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: nextStatus },
      });

      return { purchase, receipts, transactions, status: nextStatus };
    });

    const order = await ownOrder(prisma, gate.ngoId, orderId);
    return NextResponse.json(
      {
        purchase: { id: created.purchase.id, amount: Number(created.purchase.amount), status: created.purchase.status },
        receipts: created.receipts,
        order: publicOrder(order),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.message === "ORDER_NOT_FOUND" || error.message === "LINE_NOT_FOUND") {
      return jsonError("Purchase order not found.", 404);
    }
    if (error.message === "ORDER_CANCELLED") return jsonError("Cannot receive against a cancelled purchase order.");
    if (error.message === "ORDER_RECEIVED") return jsonError("This purchase order is already fully received.");
    if (error.message === "OVER_RECEIVE") return jsonError(error.detail || "Cannot receive more than the remaining quantity.");
    if (error.message === "ITEM_NOT_FOUND") return jsonError("Inventory item not found.", 404);
    console.error(error);
    return jsonError("Could not confirm receiving.", 500);
  }
}
