import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function publicNgo(ngo) {
  return {
    id: ngo.id,
    name: ngo.name,
    category: ngo.category,
    categoryOther: ngo.categoryOther || "",
    description: ngo.description || "",
    logoUrl: ngo.logoUrl || "",
    registrationNo: ngo.registrationNo || "",
    contactEmail: ngo.contactEmail,
    contactPhone: ngo.contactPhone,
    address: ngo.address,
    country: ngo.country || "",
    status: ngo.status,
    enabledModules: ngo.enabledModules ?? [],
    sharePointEnabled: ngo.sharePointEnabled,
    mfaEnabled: ngo.mfaEnabled,
  };
}

export async function GET() {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);
  const ngo = await prisma.ngo.findUnique({ where: { id: gate.ngoId } });
  if (!ngo) return jsonError("NGO not found.", 404);
  return NextResponse.json({ item: publicNgo(ngo) });
}

export async function PATCH(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const contactEmail = asString(body?.contactEmail);
  const contactPhone = asString(body?.contactPhone);
  const address = asString(body?.address);
  const description = asString(body?.description);
  const logoUrl = asString(body?.logoUrl);
  if (!contactEmail) return jsonError("Contact email is required.");
  if (!contactPhone) return jsonError("Contact phone is required.");
  if (!address) return jsonError("Address is required.");

  const ngo = await prisma.ngo.update({
    where: { id: gate.ngoId },
    data: {
      contactEmail,
      contactPhone,
      address,
      description: description || null,
      logoUrl: logoUrl || null,
    },
  });
  return NextResponse.json({ item: publicNgo(ngo) });
}
