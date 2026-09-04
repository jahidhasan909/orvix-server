import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireSharePoint } from "#lib/require-sharepoint.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function publicSharePoint(ngo) {
  return {
    enabled: true,
    ngoName: ngo.name,
    siteUrl: ngo.sharePointSiteUrl || "",
    library: ngo.sharePointLibrary || "",
  };
}

export async function GET() {
  const gate = await requireSharePoint();
  if (gate.error) return jsonError(gate.error, gate.status);
  return NextResponse.json({ item: publicSharePoint(gate.ngo) });
}

export async function PATCH(request) {
  const gate = await requireSharePoint();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid request body.");

  const siteUrl = asString(body.siteUrl);
  const library = asString(body.library);

  const ngo = await prisma.ngo.update({
    where: { id: gate.ngoId },
    data: {
      sharePointSiteUrl: siteUrl || null,
      sharePointLibrary: library || null,
    },
    select: {
      name: true,
      sharePointEnabled: true,
      sharePointSiteUrl: true,
      sharePointLibrary: true,
    },
  });

  return NextResponse.json({ item: publicSharePoint(ngo) });
}
