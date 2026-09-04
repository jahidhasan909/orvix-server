import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import { publicPurchase } from "#lib/procurement.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const purchaseInclude = {
  vendor: { select: { id: true, name: true } },
  order: { select: { id: true, status: true, supplier: true } },
  receiving: {
    orderBy: { date: "asc" },
    include: {
      item: { select: { name: true, unit: true } },
      supplier: { select: { name: true } },
    },
  },
};

export async function GET(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const supplierId = url.searchParams.get("supplierId") || "";
  const orderId = url.searchParams.get("orderId") || "";
  const status = url.searchParams.get("status") || "";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";

  const where = { ngoId: gate.ngoId };
  if (supplierId) where.supplierId = supplierId;
  if (orderId) where.orderId = orderId;
  if (status) where.status = status;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.date.lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (q) {
    where.OR = [
      { notes: { contains: q, mode: "insensitive" } },
      { vendor: { name: { contains: q, mode: "insensitive" } } },
      { order: { supplier: { contains: q, mode: "insensitive" } } },
    ];
  }

  const items = await prisma.purchase.findMany({
    where,
    orderBy: { date: "desc" },
    include: purchaseInclude,
  });

  return NextResponse.json({ items: items.map((row) => publicPurchase(row)) });
}
