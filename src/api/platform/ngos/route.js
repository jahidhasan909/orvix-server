import { NextResponse } from "#shims/next-server.js";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";
import {
  DEFAULT_NGO_MODULE_OPTION_IDS,
  NGO_CATEGORIES,
  expandNgoModules,
  makeNgoCode,
} from "#lib/ngo-catalog.js";
import { writeAudit } from "#lib/audit.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return fallback;
}

export async function GET() {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const items = await prisma.ngo.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        where: { role: ROLES.NGO_ADMIN },
        select: { id: true, name: true, email: true, status: true },
        take: 3,
      },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json({ items });
}

export async function POST(request) {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.");
  }

  const name = asString(body.name);
  const category = asString(body.category);
  const categoryOther = asString(body.categoryOther);
  const description = asString(body.description);
  const logoUrl = asString(body.logoUrl);
  const registrationNo = asString(body.registrationNo);
  const contactEmail = asString(body.contactEmail).toLowerCase();
  const contactPhone = asString(body.contactPhone);
  const address = asString(body.address);
  const status = asString(body.status) === "inactive" ? "inactive" : "active";
  const mfaEnabled = asBool(body.mfaEnabled, false);
  const sharePointEnabled = asBool(body.sharePointEnabled, false);
  const moduleOptionIds = Array.isArray(body.moduleOptionIds) && body.moduleOptionIds.length
    ? body.moduleOptionIds.map(asString).filter(Boolean)
    : DEFAULT_NGO_MODULE_OPTION_IDS;

  const admin = body.admin && typeof body.admin === "object" ? body.admin : {};
  const adminName = asString(admin.fullName);
  const adminEmail = asString(admin.email).toLowerCase();
  const adminPhone = asString(admin.phone);
  const adminPassword = typeof admin.password === "string" ? admin.password : "";
  const adminStatus = asString(admin.status) === "inactive" ? "inactive" : "active";

  if (!name) return jsonError("NGO name is required.");
  if (!NGO_CATEGORIES.some((item) => item.id === category)) {
    return jsonError("Select a valid NGO category.");
  }
  if (category === "other" && !categoryOther) {
    return jsonError("Specify the category name when Other is selected.");
  }
  if (!description) return jsonError("NGO description is required.");
  if (!contactEmail || !EMAIL_RE.test(contactEmail)) {
    return jsonError("A valid contact email is required.");
  }
  if (!contactPhone) return jsonError("Contact phone is required.");
  if (!address) return jsonError("Address is required.");

  const enabledModules = expandNgoModules(moduleOptionIds);
  if (!enabledModules.length) {
    return jsonError("Select at least one module for this NGO.");
  }

  if (!adminName) return jsonError("NGO Admin full name is required.");
  if (!adminEmail || !EMAIL_RE.test(adminEmail)) {
    return jsonError("A valid NGO Admin email is required.");
  }
  if (adminPassword.length < 8) {
    return jsonError("NGO Admin password must be at least 8 characters.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    return jsonError("That NGO Admin email is already in use.");
  }

  const adminId = crypto.randomUUID().replaceAll("-", "");
  const accountId = crypto.randomUUID().replaceAll("-", "");
  const passwordHash = await hashPassword(adminPassword);

  try {
    const ngo = await prisma.$transaction(async (tx) => {
      const created = await tx.ngo.create({
        data: {
          name,
          code: makeNgoCode(name),
          category,
          categoryOther: category === "other" ? categoryOther : null,
          description,
          logoUrl: logoUrl || null,
          registrationNo: registrationNo || null,
          contactEmail,
          contactPhone,
          address,
          status,
          enabledModules,
          mfaEnabled,
          sharePointEnabled,
        },
      });

      await tx.user.create({
        data: {
          id: adminId,
          name: adminName,
          email: adminEmail,
          emailVerified: false,
          role: ROLES.NGO_ADMIN,
          ngoId: created.id,
          phone: adminPhone || null,
          status: adminStatus,
        },
      });

      await tx.account.create({
        data: {
          id: accountId,
          accountId: adminId,
          providerId: "credential",
          userId: adminId,
          password: passwordHash,
          issuer: "local:credential",
        },
      });

      return created;
    });

    await writeAudit(prisma, {
      actor: gate.email,
      action: "ngo.create",
      target: ngo.name,
    });

    return NextResponse.json({
      item: {
        id: ngo.id,
        name: ngo.name,
        code: ngo.code,
        status: ngo.status,
        enabledModules: ngo.enabledModules,
        admin: {
          id: adminId,
          name: adminName,
          email: adminEmail,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return jsonError("Could not create the NGO. Please try again.", 500);
  }
}
