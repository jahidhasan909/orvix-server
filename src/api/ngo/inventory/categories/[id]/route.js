import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireInventory } from "#lib/require-inventory.js";
import { publicCategory } from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function own(ngoId, id) {
  return prisma.inventoryCategory.findFirst({
    where: { id, ngoId },
    include: { _count: { select: { items: true } } },
  });
}

export async function PATCH(request, { params }) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await own(gate.ngoId, id);
  if (!existing) return jsonError("Category not found.", 404);

  const body = await request.json().catch(() => null);
  const name = asString(body?.name);
  const description = asString(body?.description) || null;
  const status = asString(body?.status) === "inactive" ? "inactive" : "active";
  if (!name) return jsonError("Category name is required.");

  const clash = await prisma.inventoryCategory.findFirst({
    where: { ngoId: gate.ngoId, name: { equals: name, mode: "insensitive" }, NOT: { id } },
  });
  if (clash) return jsonError("A category with that name already exists.");

  const item = await prisma.inventoryCategory.update({
    where: { id },
    data: { name, description, status },
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ item: publicCategory(item) });
}

export async function DELETE(_request, { params }) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);
  const { id } = await params;
  const existing = await own(gate.ngoId, id);
  if (!existing) return jsonError("Category not found.", 404);
  if (existing._count.items > 0) {
    const item = await prisma.inventoryCategory.update({
      where: { id },
      data: { status: "inactive" },
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json({
      item: publicCategory(item),
      archived: true,
      message: "Category is in use, so it was archived instead of deleted.",
    });
  }
  await prisma.inventoryCategory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
