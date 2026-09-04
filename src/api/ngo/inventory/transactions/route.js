import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireInventory } from "#lib/require-inventory.js";
import { nameMaps, publicTransaction } from "#lib/inventory.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const gate = await requireInventory("view");
  if (gate.error) return jsonError(gate.error, gate.status);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const type = url.searchParams.get("type") || "";
  const projectId = url.searchParams.get("projectId") || "";
  const siteId = url.searchParams.get("siteId") || "";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";

  const where = { ngoId: gate.ngoId };
  if (type) where.type = type;
  if (projectId) where.projectId = projectId;
  if (siteId) where.siteId = siteId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.date.lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (q) {
    where.OR = [
      { sku: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { item: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [rows, names] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: 200,
      include: { item: { select: { name: true } } },
    }),
    nameMaps(prisma, gate.ngoId),
  ]);

  return NextResponse.json({ items: rows.map((row) => publicTransaction(row, names)) });
}
