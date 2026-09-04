import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireInventory } from "#lib/require-inventory.js";
import {
  TX,
  applyStockChange,
  assertProjectSite,
  parseItemBody,
  publicItem,
} from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  let gate = await requireInventory("view");
  if (gate.error) gate = await requireInventory("request");
  if (gate.error) return jsonError(gate.error, gate.status);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const categoryId = url.searchParams.get("categoryId") || "";
  const stockStatus = url.searchParams.get("stockStatus") || "";
  const projectId = url.searchParams.get("projectId") || "";
  const siteId = url.searchParams.get("siteId") || "";
  const status = url.searchParams.get("status") || "";

  const where = { ngoId: gate.ngoId };
  if (categoryId) where.categoryId = categoryId;
  if (projectId) where.projectId = projectId;
  if (siteId) where.siteId = siteId;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    orderBy: { name: "asc" },
    include: { category: { select: { name: true } } },
  });

  let list = items.map((item) => publicItem(item));
  if (stockStatus) list = list.filter((item) => item.stockStatus === stockStatus);
  return NextResponse.json({ items: list });
}

export async function POST(request) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);

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
    where: { ngoId: gate.ngoId, sku: parsed.data.sku },
  });
  if (taken) return jsonError("That SKU is already used in this NGO.");

  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          ngoId: gate.ngoId,
          ...parsed.data,
          quantity: 0,
        },
        include: { category: { select: { name: true } } },
      });
      if (parsed.opening > 0) {
        await applyStockChange(tx, {
          ngoId: gate.ngoId,
          itemId: created.id,
          delta: parsed.opening,
          type: TX.OPENING,
          createdBy: gate.userId || gate.session.user.id,
          notes: "Opening stock",
        });
        return tx.inventoryItem.findFirst({
          where: { id: created.id },
          include: { category: { select: { name: true } } },
        });
      }
      return created;
    });
    return NextResponse.json({ item: publicItem(item) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return jsonError("Could not create the item.", 500);
  }
}
