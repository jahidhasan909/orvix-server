import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";
import { ROLES } from "#lib/navigation.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function publicMe(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    designation: user.designation || "",
    status: user.status,
    joiningDate: user.joiningDate || null,
    employeeId: user.employeeId || "",
  };
}

async function requireSelf() {
  const platform = await requirePlatformAdmin();
  if (!platform.error) {
    return { userId: platform.userId, ngoId: null, role: ROLES.PLATFORM_ADMIN };
  }
  return requireNgoSession([ROLES.NGO_ADMIN, ROLES.WORKER]);
}

export async function GET() {
  const gate = await requireSelf();
  if (gate.error) return jsonError(gate.error, gate.status);
  const user = await prisma.user.findFirst({
    where: gate.ngoId
      ? { id: gate.userId, ngoId: gate.ngoId }
      : { id: gate.userId, role: ROLES.PLATFORM_ADMIN },
    select: { id: true, name: true, email: true, phone: true, designation: true, status: true, joiningDate: true, employeeId: true },
  });
  if (!user) return jsonError("Account not found.", 404);
  return NextResponse.json({ item: publicMe(user) });
}

export async function PATCH(request) {
  const gate = await requireSelf();
  if (gate.error) return jsonError(gate.error, gate.status);
  const body = await request.json().catch(() => null);
  const name = asString(body?.name);
  const phone = asString(body?.phone);
  if (!name) return jsonError("Name is required.");

  const user = await prisma.user.update({
    where: { id: gate.userId },
    data: { name, phone: phone || null },
    select: { id: true, name: true, email: true, phone: true, designation: true, status: true, joiningDate: true, employeeId: true },
  });
  return NextResponse.json({ item: publicMe(user) });
}
