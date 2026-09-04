import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const q = asString(new URL(request.url).searchParams.get("q")).toLowerCase();
  const items = await prisma.auditLog.findMany({
    orderBy: { at: "desc" },
    take: 100,
  });

  const filtered = q
    ? items.filter((row) =>
        [row.actor, row.action, row.target].some((value) => String(value || "").toLowerCase().includes(q))
      )
    : items;

  return NextResponse.json({
    items: filtered.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      target: row.target || "",
      at: row.at,
    })),
  });
}
