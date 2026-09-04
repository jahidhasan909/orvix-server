import { NextResponse } from "#shims/next-server.js";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "#lib/prisma.js";
import { asString } from "#lib/worker-payload.js";
import { ROLES } from "#lib/navigation.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";
import { writeAudit } from "#lib/audit.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function publicAdmin(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    status: user.status,
    createdAt: user.createdAt,
  };
}

export async function PATCH(request, { params }) {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const existing = await prisma.user.findFirst({
    where: { id, role: ROLES.PLATFORM_ADMIN },
  });
  if (!existing) return jsonError("Platform admin not found.", 404);

  const body = await request.json().catch(() => ({}));
  const name = asString(body?.name);
  const email = asString(body?.email).toLowerCase();
  const phone = asString(body?.phone);
  const password = typeof body?.password === "string" ? body.password : "";
  const status = asString(body?.status) === "inactive" ? "inactive" : "active";

  if (!name) return jsonError("Name is required.");
  if (!email || !EMAIL_RE.test(email)) return jsonError("A valid email is required.");
  if (password && password.length < 8) return jsonError("Password must be at least 8 characters.");

  if (status === "inactive") {
    const activeCount = await prisma.user.count({
      where: { role: ROLES.PLATFORM_ADMIN, status: "active", NOT: { id } },
    });
    if (activeCount < 1) return jsonError("At least one active Platform Admin is required.");
  }

  const emailOwner = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (emailOwner && emailOwner.id !== existing.id) return jsonError("That email is already in use.");

  const user = await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      phone: phone || null,
      status,
      role: ROLES.PLATFORM_ADMIN,
      ngoId: null,
    },
  });

  if (password) {
    await prisma.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: await hashPassword(password) },
    });
  }

  await writeAudit(prisma, {
    actor: gate.email,
    action: "platform_admin.update",
    target: user.email,
  });

  return NextResponse.json({ item: publicAdmin(user) });
}
