import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireInventory } from "#lib/require-inventory.js";
import { assertProjectSite, parseItemBody, publicItem } from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function own(ngoId, id) {
  return prisma.inventoryItem.findFirst({
    where: { id, ngoId },
    include: { category: { select: { name: true } } },
  });
}

export async function GET(_request, { params }) {
  const gate = await requireInventory("view");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const item = await own(gate.ngoId, id);
  if (!item) return jsonError("Item not found.", 404);
  return NextResponse.json({ item: publicItem(item) });
}

export async function PATCH(request, { params }) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await own(gate.ngoId, id);
  if (!existing) return jsonError("Item not found.", 404);

  const parsed = parseItemBody(await request.json().catch(() => null));
  if (parsed.error) return jsonError(parsed.error);

  const scoped = await assertProjectSite(prisma, gate.ngoId, parsed.data.projectId, parsed.data.siteId);
  if (scoped.error) return jsonError(scoped.error);

  if (parsed.data.categoryId) {
    const category = await prisma.inventoryCategory.findFirst({
      where: { id: parsed.data.categoryId, ngoId: gate.ngoId },
    });
    if (!category) return jsonError("The selected category does not belong to this NGO.");
  }

  const taken = await prisma.inventoryItem.findFirst({
    where: { ngoId: gate.ngoId, sku: parsed.data.sku, NOT: { id } },
  });
  if (taken) return jsonError("That SKU is already used in this NGO.");

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: parsed.data,
    include: { category: { select: { name: true } } },
  });
  return NextResponse.json({ item: publicItem(item) });
}

export async function DELETE(_request, { params }) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await own(gate.ngoId, id);
  if (!existing) return jsonError("Item not found.", 404);

  const [txCount, requestCount] = await Promise.all([
    prisma.stockTransaction.count({ where: { ngoId: gate.ngoId, itemId: id } }),
    prisma.resourceRequest.count({ where: { ngoId: gate.ngoId, itemId: id } }),
  ]);

  if (existing.quantity > 0 || txCount > 0 || requestCount > 0) {
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: { status: "inactive" },
      include: { category: { select: { name: true } } },
    });
    return NextResponse.json({
      item: publicItem(item),
      archived: true,
      message: "Item has stock or history, so it was archived instead of deleted.",
    });
  }

  await prisma.inventoryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
