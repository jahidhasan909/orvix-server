import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const [projects, sites] = await Promise.all([
    prisma.project.findMany({
      where: { ngoId: gate.ngoId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
    prisma.site.findMany({
      where: { ngoId: gate.ngoId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, location: true, projectId: true, status: true },
    }),
  ]);

  return NextResponse.json({ projects, sites });
}
