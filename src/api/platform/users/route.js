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

export async function GET() {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const items = await prisma.user.findMany({
    where: { role: ROLES.PLATFORM_ADMIN },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
  });
  return NextResponse.json({ items: items.map(publicAdmin) });
}

export async function POST(request) {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => ({}));
  const name = asString(body?.name);
  const email = asString(body?.email).toLowerCase();
  const phone = asString(body?.phone);
  const password = typeof body?.password === "string" ? body.password : "";
  const status = asString(body?.status) === "inactive" ? "inactive" : "active";

  if (!name) return jsonError("Name is required.");
  if (!email || !EMAIL_RE.test(email)) return jsonError("A valid email is required.");
  if (password.length < 8) return jsonError("Password must be at least 8 characters.");

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) return jsonError("That email is already in use.");

  const userId = crypto.randomUUID().replaceAll("-", "");
  const accountId = crypto.randomUUID().replaceAll("-", "");
  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: false,
        role: ROLES.PLATFORM_ADMIN,
        ngoId: null,
        phone: phone || null,
        status,
      },
    });
    await tx.account.create({
      data: {
        id: accountId,
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
        issuer: "local:credential",
      },
    });
    return created;
  });

  await writeAudit(prisma, {
    actor: gate.email,
    action: "platform_admin.create",
    target: user.email,
  });

  return NextResponse.json({ item: publicAdmin(user) }, { status: 201 });
}
