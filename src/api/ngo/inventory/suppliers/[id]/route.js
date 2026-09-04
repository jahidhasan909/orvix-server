import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireInventory } from "#lib/require-inventory.js";
import { publicSupplier } from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function own(ngoId, id) {
  return prisma.supplier.findFirst({
    where: { id, ngoId },
    include: {
      _count: { select: { receiving: true, purchaseOrders: true, purchases: true } },
    },
  });
}

export async function GET(_request, { params }) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await own(gate.ngoId, id);
  if (!existing) return jsonError("Supplier not found.", 404);
  return NextResponse.json({
    item: {
      ...publicSupplier(existing),
      receiptCount: existing._count.receiving,
      orderCount: existing._count.purchaseOrders,
      purchaseCount: existing._count.purchases,
    },
  });
}

export async function PATCH(request, { params }) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await own(gate.ngoId, id);
  if (!existing) return jsonError("Supplier not found.", 404);

  const body = await request.json().catch(() => null);
  const name = asString(body?.name);
  if (!name) return jsonError("Supplier name is required.");

  const item = await prisma.supplier.update({
    where: { id },
    data: {
      name,
      contact: asString(body?.contact) || null,
      email: asString(body?.email) || null,
      phone: asString(body?.phone) || null,
      address: asString(body?.address) || null,
      category: asString(body?.category) || null,
      status: asString(body?.status) === "inactive" ? "inactive" : "active",
    },
  });
  return NextResponse.json({ item: publicSupplier(item) });
}

export async function DELETE(_request, { params }) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await own(gate.ngoId, id);
  if (!existing) return jsonError("Supplier not found.", 404);

  const used =
    (await prisma.receivingRecord.count({ where: { ngoId: gate.ngoId, supplierId: id } })) +
    (await prisma.purchaseOrder.count({ where: { ngoId: gate.ngoId, supplierId: id } })) +
    (await prisma.purchase.count({ where: { ngoId: gate.ngoId, supplierId: id } }));
  if (used > 0) {
    const item = await prisma.supplier.update({
      where: { id },
      data: { status: "inactive" },
    });
    return NextResponse.json({
      item: publicSupplier(item),
      archived: true,
      message: "Supplier is used on orders or receipts, so it was archived instead of deleted.",
    });
  }
  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
