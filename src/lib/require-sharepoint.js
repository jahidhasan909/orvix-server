import { prisma } from "#lib/prisma.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";

export async function requireSharePoint() {
  const gate = await requireNgoAdmin();
  if (gate.error) return gate;

  const ngo = await prisma.ngo.findUnique({
    where: { id: gate.ngoId },
    select: {
      id: true,
      name: true,
      sharePointEnabled: true,
      sharePointSiteUrl: true,
      sharePointLibrary: true,
    },
  });

  if (!ngo?.sharePointEnabled) {
    return { error: "SharePoint is not enabled for this NGO.", status: 403 };
  }

  return { ...gate, ngo };
}
