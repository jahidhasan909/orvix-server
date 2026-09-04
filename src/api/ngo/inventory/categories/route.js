import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireInventory } from "#lib/require-inventory.js";
import { publicCategory } from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireInventory("view");
  if (gate.error) return jsonError(gate.error, gate.status);

  const items = await prisma.inventoryCategory.findMany({
    where: { ngoId: gate.ngoId },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ items: items.map((row) => publicCategory(row)) });
}

export async function POST(request) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const name = asString(body?.name);
  const description = asString(body?.description) || null;
  if (!name) return jsonError("Category name is required.");

  const exists = await prisma.inventoryCategory.findFirst({
    where: { ngoId: gate.ngoId, name: { equals: name, mode: "insensitive" } },
  });
  if (exists) return jsonError("A category with that name already exists.");

  const item = await prisma.inventoryCategory.create({
    data: { ngoId: gate.ngoId, name, description },
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({ item: publicCategory(item) }, { status: 201 });
}
