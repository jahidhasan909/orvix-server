import { asString } from "#lib/worker-payload.js";
import { money, parseDate, positiveInt } from "#lib/inventory.js";

export const PO_STATUSES = ["open", "partial", "received", "cancelled"];

export const PO_STATUS_LABELS = {
  open: "Open",
  partial: "Partially received",
  received: "Fully received",
  cancelled: "Cancelled",
};

export const RECEIVABLE_STATUSES = ["open", "partial"];

export function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function receivedQtyOf(line) {
  return (line.receiving ?? []).reduce((sum, row) => sum + (row.quantity || 0), 0);
}

export function remainingQtyOf(line) {
  return Math.max(0, (line.quantity || 0) - receivedQtyOf(line));
}

export function poStatusFromLines(lines) {
  const remaining = lines.reduce((sum, line) => sum + remainingQtyOf(line), 0);
  const received = lines.reduce((sum, line) => sum + receivedQtyOf(line), 0);
  if (received <= 0) return "open";
  if (remaining <= 0) return "received";
  return "partial";
}

export function publicLine(line) {
  const receivedQty = receivedQtyOf(line);
  const remaining = Math.max(0, (line.quantity || 0) - receivedQty);
  return {
    id: line.id,
    itemId: line.itemId,
    sku: line.sku,
    itemName: line.item?.name || line.sku,
    unit: line.item?.unit || "pcs",
    quantity: line.quantity,
    unitPrice: Number(line.unitPrice),
    lineTotal: Number(line.lineTotal),
    receivedQty,
    remaining,
  };
}

export function publicOrder(order) {
  const lines = (order.lines ?? []).map(publicLine);
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const receivedQty = lines.reduce((sum, line) => sum + line.receivedQty, 0);
  const remainingQty = lines.reduce((sum, line) => sum + line.remaining, 0);
  const canEdit = order.status === "open" && receivedQty === 0;
  return {
    id: order.id,
    supplierId: order.supplierId || "",
    supplierName: order.vendor?.name || order.supplier || "",
    supplier: order.supplier || "",
    notes: order.notes || "",
    status: order.status,
    statusLabel: PO_STATUS_LABELS[order.status] || order.status,
    total: Number(order.total),
    subtotal,
    date: order.date,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    lines,
    orderedQty: lines.reduce((sum, line) => sum + line.quantity, 0),
    receivedQty,
    remainingQty,
    canEdit,
    canReceive: RECEIVABLE_STATUSES.includes(order.status) && remainingQty > 0,
    canCancel: RECEIVABLE_STATUSES.includes(order.status),
  };
}

export function publicReceipt(row) {
  return {
    id: row.id,
    date: row.date,
    orderId: row.orderId || "",
    lineId: row.lineId || "",
    purchaseId: row.purchaseId || "",
    itemId: row.itemId || "",
    itemName: row.item?.name || row.sku,
    sku: row.sku,
    quantity: row.quantity,
    unit: row.item?.unit || "pcs",
    unitCost: row.unitCost != null ? Number(row.unitCost) : null,
    totalCost: row.totalCost != null ? Number(row.totalCost) : null,
    supplierId: row.supplierId || "",
    supplierName: row.supplier?.name || row.order?.vendor?.name || row.order?.supplier || "",
    reference: row.reference || "",
    notes: row.notes || "",
    status: row.status,
  };
}

export function publicPurchase(row) {
  const items = (row.receiving ?? []).map(publicReceipt);
  return {
    id: row.id,
    date: row.date,
    amount: Number(row.amount),
    status: row.status,
    notes: row.notes || "",
    supplierId: row.supplierId || "",
    supplierName: row.vendor?.name || items[0]?.supplierName || "",
    orderId: row.orderId || "",
    orderStatus: row.order?.status || "",
    orderStatusLabel: row.order ? PO_STATUS_LABELS[row.order.status] || row.order.status : "",
    items,
    receiving: items,
  };
}

export function parseOrderLines(body) {
  if (!Array.isArray(body?.lines) || body.lines.length === 0) {
    return { error: "Add at least one line item." };
  }

  const lines = [];
  for (const raw of body.lines) {
    const itemId = asString(raw?.itemId);
    const quantity = positiveInt(raw?.quantity);
    const unitPrice = money(raw?.unitPrice);
    if (!itemId) return { error: "Each line needs an inventory item." };
    if (!quantity || quantity < 1) return { error: "Quantity must be greater than 0." };
    if (unitPrice == null) return { error: "Unit price must be 0 or greater." };
    const lineTotal = roundMoney(quantity * unitPrice);
    lines.push({ itemId, quantity, unitPrice, lineTotal });
  }

  return { lines, total: roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0)) };
}

export function parseOrderMeta(body) {
  const supplierId = asString(body?.supplierId);
  if (!supplierId) return { error: "A supplier is required." };
  return {
    supplierId,
    notes: asString(body?.notes) || null,
    date: parseDate(body?.date),
    status: asString(body?.status),
  };
}

export const orderInclude = {
  vendor: { select: { id: true, name: true, status: true } },
  lines: {
    orderBy: { createdAt: "asc" },
    include: {
      item: { select: { name: true, unit: true, status: true } },
      receiving: { select: { quantity: true } },
    },
  },
};

export async function ownOrder(prisma, ngoId, id, extra = {}) {
  return prisma.purchaseOrder.findFirst({
    where: { id, ngoId },
    include: { ...orderInclude, ...extra },
  });
}

export async function ownSupplier(prisma, ngoId, id) {
  if (!id) return null;
  return prisma.supplier.findFirst({ where: { id, ngoId } });
}

export async function loadOwnedItems(prisma, ngoId, itemIds) {
  const unique = [...new Set(itemIds.filter(Boolean))];
  if (!unique.length) return [];
  return prisma.inventoryItem.findMany({
    where: { id: { in: unique }, ngoId },
  });
}

export function orderStatusFrom(current, lines) {
  if (current === "cancelled") return "cancelled";
  return poStatusFromLines(lines);
}
