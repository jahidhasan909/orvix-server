import { asString, joiningDateFrom } from "#lib/worker-payload.js";

export const TX = {
  OPENING: "opening",
  RECEIVED: "received",
  ISSUE: "issue",
  DISTRIBUTION: "distribution",
  ADJUSTMENT: "adjustment",
  RETURN: "return",
  TRANSFER: "transfer",
};

export const TX_LABELS = {
  opening: "Opening stock",
  received: "Stock received",
  issue: "Stock issue",
  distribution: "Distribution",
  adjustment: "Adjustment",
  return: "Return",
  transfer: "Transfer",
};

export const REQUEST_STATUSES = ["pending", "approved", "rejected", "issued"];

export function money(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function positiveInt(value, fallback = null) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return fallback;
  return n;
}

export async function assertProjectSite(prisma, ngoId, projectId, siteId) {
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ngoId },
      select: { id: true },
    });
    if (!project) return { error: "The selected project does not belong to this NGO." };
  }
  if (siteId) {
    const site = await prisma.site.findFirst({
      where: { id: siteId, ngoId },
      select: { id: true, projectId: true },
    });
    if (!site) return { error: "The selected site does not belong to this NGO." };
    if (projectId && site.projectId && site.projectId !== projectId) {
      return { error: "The selected site does not belong to that project." };
    }
  }
  return {};
}

export async function ownItem(prisma, ngoId, itemId) {
  if (!itemId) return null;
  return prisma.inventoryItem.findFirst({ where: { id: itemId, ngoId } });
}

export async function applyStockChange(tx, {
  ngoId,
  itemId,
  delta,
  type,
  supplierId,
  workerId,
  projectId,
  siteId,
  reference,
  notes,
  createdBy,
  unitCost,
  totalCost,
  date,
}) {
  const item = await tx.inventoryItem.findFirst({
    where: { id: itemId, ngoId },
  });
  if (!item) {
    const error = new Error("ITEM_NOT_FOUND");
    error.status = 404;
    throw error;
  }

  const next = item.quantity + delta;
  if (next < 0) {
    const error = new Error("INSUFFICIENT_STOCK");
    error.status = 400;
    throw error;
  }

  if (delta < 0) {
    const locked = await tx.inventoryItem.updateMany({
      where: { id: itemId, ngoId, quantity: { gte: Math.abs(delta) } },
      data: { quantity: { decrement: Math.abs(delta) } },
    });
    if (locked.count !== 1) {
      const error = new Error("INSUFFICIENT_STOCK");
      error.status = 400;
      throw error;
    }
  } else if (delta > 0) {
    await tx.inventoryItem.update({
      where: { id: itemId },
      data: { quantity: { increment: delta } },
    });
  }

  const transaction = await tx.stockTransaction.create({
    data: {
      ngoId,
      itemId,
      sku: item.sku,
      type,
      quantity: delta,
      quantityBefore: item.quantity,
      quantityAfter: next,
      supplierId: supplierId || null,
      workerId: workerId || null,
      projectId: projectId || null,
      siteId: siteId || null,
      reference: reference || null,
      notes: notes || null,
      createdBy: createdBy || null,
      unitCost: unitCost ?? null,
      totalCost: totalCost ?? null,
      date: date || undefined,
    },
  });

  return { item, next, transaction };
}

export function publicCategory(category, extras = {}) {
  return {
    id: category.id,
    name: category.name,
    description: category.description || "",
    status: category.status,
    itemCount: category._count?.items ?? extras.itemCount ?? 0,
  };
}

export function publicItem(item) {
  const quantity = item.quantity ?? 0;
  const minLevel = item.minLevel ?? 0;
  let stockStatus = "ok";
  if (quantity <= 0) stockStatus = "out";
  else if (minLevel > 0 && quantity <= minLevel) stockStatus = "low";

  return {
    id: item.id,
    ngoId: item.ngoId,
    sku: item.sku,
    name: item.name,
    description: item.description || "",
    categoryId: item.categoryId || "",
    categoryName: item.category?.name || "",
    unit: item.unit || "pcs",
    quantity,
    minLevel,
    status: item.status,
    projectId: item.projectId || "",
    siteId: item.siteId || "",
    warehouse: item.warehouse || "",
    stockStatus,
  };
}

export function publicTransaction(row, names = {}) {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    typeLabel: TX_LABELS[row.type] || row.type,
    sku: row.sku,
    itemId: row.itemId || "",
    itemName: row.item?.name || names.itemName || row.sku,
    quantity: row.quantity,
    quantityBefore: row.quantityBefore,
    quantityAfter: row.quantityAfter,
    unitCost: row.unitCost != null ? Number(row.unitCost) : null,
    totalCost: row.totalCost != null ? Number(row.totalCost) : null,
    supplierId: row.supplierId || "",
    workerId: row.workerId || "",
    projectId: row.projectId || "",
    siteId: row.siteId || "",
    projectName: names.projects?.[row.projectId] || "",
    siteName: names.sites?.[row.siteId] || "",
    workerName: names.workers?.[row.workerId] || "",
    supplierName: names.suppliers?.[row.supplierId] || "",
    reference: row.reference || "",
    notes: row.notes || "",
    createdBy: row.createdBy || "",
  };
}

export function publicSupplier(supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    contact: supplier.contact || "",
    email: supplier.email || "",
    phone: supplier.phone || "",
    address: supplier.address || "",
    category: supplier.category || "",
    status: supplier.status || "active",
  };
}

export function publicRequest(row, names = {}) {
  return {
    id: row.id,
    itemId: row.itemId || "",
    itemName: row.inventoryItem?.name || row.item,
    sku: row.inventoryItem?.sku || "",
    quantity: row.quantity,
    available: row.inventoryItem?.quantity ?? null,
    projectId: row.projectId || "",
    siteId: row.siteId || "",
    projectName: names.projects?.[row.projectId] || "",
    siteName: names.sites?.[row.siteId] || "",
    reason: row.reason || "",
    notes: row.notes || "",
    status: row.status,
    requestedBy: row.requestedBy,
    requestedById: row.requestedById || "",
    decisionNote: row.decisionNote || "",
    decidedBy: row.decidedBy || "",
    issuedAt: row.issuedAt,
    createdAt: row.createdAt,
  };
}

export function parseItemBody(body) {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const name = asString(body.name);
  const sku = asString(body.sku).toUpperCase();
  const description = asString(body.description) || null;
  const categoryId = asString(body.categoryId) || null;
  const unit = asString(body.unit) || "pcs";
  const minLevel = positiveInt(body.minLevel, 0) ?? 0;
  const opening = positiveInt(body.openingStock ?? body.quantity, 0) ?? 0;
  const status = asString(body.status) === "inactive" ? "inactive" : "active";
  const projectId = asString(body.projectId) || null;
  const siteId = asString(body.siteId) || null;
  const warehouse = asString(body.warehouse) || null;
  if (!name) return { error: "Item name is required." };
  if (!sku) return { error: "SKU / item code is required." };
  return {
    data: { name, sku, description, categoryId, unit, minLevel, status, projectId, siteId, warehouse },
    opening,
  };
}

export function parseDate(value) {
  if (!value) return new Date();
  const date = joiningDateFrom(value) || new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function nameMaps(prisma, ngoId) {
  const [projects, sites, workers, suppliers] = await Promise.all([
    prisma.project.findMany({ where: { ngoId }, select: { id: true, name: true } }),
    prisma.site.findMany({ where: { ngoId }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { ngoId, role: "worker" }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ where: { ngoId }, select: { id: true, name: true } }),
  ]);
  return {
    projects: Object.fromEntries(projects.map((row) => [row.id, row.name])),
    sites: Object.fromEntries(sites.map((row) => [row.id, row.name])),
    workers: Object.fromEntries(workers.map((row) => [row.id, row.name])),
    suppliers: Object.fromEntries(suppliers.map((row) => [row.id, row.name])),
  };
}
