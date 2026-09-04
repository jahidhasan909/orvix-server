import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";
import { writeAudit } from "#lib/audit.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function publicSettings(row) {
  return {
    orgName: row.orgName || "ORVIX",
    supportEmail: row.supportEmail || "",
    sessionDays: row.sessionDays ?? 7,
    mfaRequiredForAdmins: Boolean(row.mfaRequiredForAdmins),
  };
}

async function loadSettings() {
  return prisma.platformSettings.upsert({
    where: { id: "platform" },
    create: { id: "platform" },
    update: {},
  });
}

export async function GET() {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);
  const item = await loadSettings();
  return NextResponse.json({ item: publicSettings(item) });
}

export async function PATCH(request) {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => ({}));
  const orgName = asString(body?.orgName) || "ORVIX";
  const supportEmail = asString(body?.supportEmail);
  const sessionDays = Number(body?.sessionDays);
  const mfaRequiredForAdmins = body?.mfaRequiredForAdmins === true || body?.mfaRequiredForAdmins === "true";

  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
    return jsonError("Support email is invalid.");
  }
  if (!Number.isInteger(sessionDays) || sessionDays < 1 || sessionDays > 90) {
    return jsonError("Session days must be between 1 and 90.");
  }

  const item = await prisma.platformSettings.upsert({
    where: { id: "platform" },
    create: {
      id: "platform",
      orgName,
      supportEmail: supportEmail || null,
      sessionDays,
      mfaRequiredForAdmins,
    },
    update: {
      orgName,
      supportEmail: supportEmail || null,
      sessionDays,
      mfaRequiredForAdmins,
    },
  });

  await writeAudit(prisma, {
    actor: gate.email,
    action: "platform_settings.update",
    target: "platform",
  });

  return NextResponse.json({ item: publicSettings(item) });
}
