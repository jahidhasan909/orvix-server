import { headers } from "#shims/next-headers.js";
import { NextResponse } from "#shims/next-server.js";
import { auth } from "#lib/auth.js";
import { asString } from "#lib/worker-payload.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";
import { ROLES } from "#lib/navigation.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const platform = await requirePlatformAdmin();
  const gate = platform.error ? await requireNgoSession([ROLES.NGO_ADMIN, ROLES.WORKER]) : platform;
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  const currentPassword = asString(body?.currentPassword);
  const newPassword = asString(body?.newPassword);
  if (!currentPassword || !newPassword) return jsonError("Current and new passwords are required.");
  if (newPassword.length < 8) return jsonError("New password must be at least 8 characters.");

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: await headers(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error?.message || "Could not change the password.", 400);
  }
}
