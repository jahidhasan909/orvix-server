import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireInventory } from "#lib/require-inventory.js";
import { ROLES } from "#lib/navigation.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireInventory("issue");
  if (gate.error) return jsonError(gate.error, gate.status);

  const [workers, projects, sites] = await Promise.all([
    prisma.user.findMany({
      where: { ngoId: gate.ngoId, role: ROLES.WORKER },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { ngoId: gate.ngoId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.site.findMany({
      where: { ngoId: gate.ngoId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, projectId: true },
    }),
  ]);

  return NextResponse.json({ workers, projects, sites });
}
