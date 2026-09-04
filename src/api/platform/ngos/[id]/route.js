import { NextResponse } from "#shims/next-server.js";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { requirePlatformAdmin } from "#lib/require-platform-admin.js";
import { NGO_CATEGORIES, expandNgoModules } from "#lib/ngo-catalog.js";
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

async function loadNgo(id) {
  return prisma.ngo.findUnique({
    where: { id },
    include: {
      users: {
        where: { role: ROLES.NGO_ADMIN },
        select: { id: true, name: true, email: true, phone: true, status: true },
        take: 1,
      },
    },
  });
}

export async function GET(_request, { params }) {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const ngo = await loadNgo(id);
  if (!ngo) return jsonError("NGO not found.", 404);

  const [workers, projects, sites, pendingRequests] = await Promise.all([
    prisma.user.count({ where: { ngoId: id, role: ROLES.WORKER } }),
    prisma.project.count({ where: { ngoId: id } }),
    prisma.site.count({ where: { ngoId: id } }),
    prisma.resourceRequest.count({ where: { ngoId: id, status: "pending" } }),
  ]);

  return NextResponse.json({
    item: ngo,
    stats: { workers, projects, sites, pendingRequests, admins: ngo.users.length },
  });
}

export async function PATCH(request, { params }) {
  const gate = await requirePlatformAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const existing = await loadNgo(id);
  if (!existing) return jsonError("NGO not found.", 404);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("Invalid request body.");

  if (body.modulesOnly) {
    const moduleOptionIds = Array.isArray(body.moduleOptionIds)
      ? body.moduleOptionIds.map(asString).filter(Boolean)
      : [];
    const enabledModules = expandNgoModules(moduleOptionIds);
    if (!enabledModules.length) return jsonError("Select at least one module for this NGO.");
    const item = await prisma.ngo.update({
      where: { id },
      data: { enabledModules },
    });
    await writeAudit(prisma, {
      actor: gate.email,
      action: "ngo.modules.update",
      target: item.name,
    });
    return NextResponse.json({ item: await loadNgo(id) });
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
  const moduleOptionIds = Array.isArray(body.moduleOptionIds)
    ? body.moduleOptionIds.map(asString).filter(Boolean)
    : [];

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

  const admin = body.admin && typeof body.admin === "object" ? body.admin : null;
  const currentAdmin = existing.users[0];

  if (admin && currentAdmin) {
    const adminName = asString(admin.fullName);
    const adminEmail = asString(admin.email).toLowerCase();
    const adminPhone = asString(admin.phone);
    const adminPassword = typeof admin.password === "string" ? admin.password : "";
    const adminStatus = asString(admin.status) === "inactive" ? "inactive" : "active";

    if (!adminName) return jsonError("NGO Admin full name is required.");
    if (!adminEmail || !EMAIL_RE.test(adminEmail)) {
      return jsonError("A valid NGO Admin email is required.");
    }
    if (adminPassword && adminPassword.length < 8) {
      return jsonError("NGO Admin password must be at least 8 characters.");
    }

    const emailOwner = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (emailOwner && emailOwner.id !== currentAdmin.id) {
      return jsonError("That NGO Admin email is already in use.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.ngo.update({
        where: { id },
        data: {
          name,
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

      await tx.user.update({
        where: { id: currentAdmin.id },
        data: {
          name: adminName,
          email: adminEmail,
          phone: adminPhone || null,
          status: adminStatus,
        },
      });

      if (adminPassword) {
        await tx.account.updateMany({
          where: { userId: currentAdmin.id, providerId: "credential" },
          data: { password: await hashPassword(adminPassword) },
        });
      }
    });
  } else {
    await prisma.ngo.update({
      where: { id },
      data: {
        name,
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
  }

  const item = await loadNgo(id);
  await writeAudit(prisma, {
    actor: gate.email,
    action: `ngo.${asString(body.status) === "inactive" ? "deactivate" : "update"}`,
    target: item?.name || id,
  });
  return NextResponse.json({ item });
}
