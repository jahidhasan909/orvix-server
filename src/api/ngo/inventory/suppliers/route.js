import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireInventory } from "#lib/require-inventory.js";
import { publicSupplier } from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const where = { ngoId: gate.ngoId };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { contact: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }

  const items = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items: items.map((row) => publicSupplier(row)) });
}

export async function POST(request) {
  const gate = await requireInventory("manage");
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const name = asString(body?.name);
  if (!name) return jsonError("Supplier name is required.");

  const item = await prisma.supplier.create({
    data: {
      ngoId: gate.ngoId,
      name,
      contact: asString(body?.contact) || null,
      email: asString(body?.email) || null,
      phone: asString(body?.phone) || null,
      address: asString(body?.address) || null,
      category: asString(body?.category) || null,
      status: asString(body?.status) === "inactive" ? "inactive" : "active",
    },
  });
  return NextResponse.json({ item: publicSupplier(item) }, { status: 201 });
}
