import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import {
  loadOwnedItems,
  orderInclude,
  ownSupplier,
  parseOrderLines,
  parseOrderMeta,
  publicOrder,
} from "#lib/procurement.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const status = url.searchParams.get("status") || "";
  const supplierId = url.searchParams.get("supplierId") || "";
  const receivable = url.searchParams.get("receivable") === "1";

  const where = { ngoId: gate.ngoId };
  if (status) where.status = status;
  if (supplierId) where.supplierId = supplierId;
  if (receivable) where.status = { in: ["open", "partial"] };
  if (q) {
    where.OR = [
      { supplier: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { vendor: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const items = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { date: "desc" },
    include: orderInclude,
  });

  return NextResponse.json({ items: items.map((row) => publicOrder(row)) });
}

export async function POST(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const meta = parseOrderMeta(body);
  if (meta.error) return jsonError(meta.error);
  const parsed = parseOrderLines(body);
  if (parsed.error) return jsonError(parsed.error);

  const supplier = await ownSupplier(prisma, gate.ngoId, meta.supplierId);
  if (!supplier) return jsonError("Supplier not found.", 404);
  if (supplier.status !== "active") return jsonError("Cannot create a purchase order for an inactive supplier.");

  const items = await loadOwnedItems(prisma, gate.ngoId, parsed.lines.map((line) => line.itemId));
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  for (const line of parsed.lines) {
    const item = byId[line.itemId];
    if (!item) return jsonError("Inventory item not found.", 404);
    if (item.status !== "active") return jsonError(`Cannot order inactive item ${item.name}.`);
  }

  const created = await prisma.purchaseOrder.create({
    data: {
      ngoId: gate.ngoId,
      supplier: supplier.name,
      supplierId: supplier.id,
      notes: meta.notes,
      status: "open",
      total: parsed.total,
      date: meta.date,
      lines: {
        create: parsed.lines.map((line) => ({
          ngoId: gate.ngoId,
          itemId: line.itemId,
          sku: byId[line.itemId].sku,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        })),
      },
    },
    include: orderInclude,
  });

  return NextResponse.json({ item: publicOrder(created) }, { status: 201 });
}
