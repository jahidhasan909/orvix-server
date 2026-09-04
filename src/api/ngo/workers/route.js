import { NextResponse } from "#shims/next-server.js";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import { parseWorkerBody, publicWorker } from "#lib/worker-payload.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function ngoAssignments(ngoId) {
  const [projects, sites] = await Promise.all([
    prisma.project.findMany({
      where: { ngoId },
      select: { id: true, name: true },
    }),
    prisma.site.findMany({
      where: { ngoId },
      select: { id: true, name: true },
    }),
  ]);
  return { projects, sites };
}

async function scopedIds(ngoId, projectIds, siteIds) {
  const [projects, sites] = await Promise.all([
    projectIds.length
      ? prisma.project.findMany({
          where: { ngoId, id: { in: projectIds } },
          select: { id: true },
        })
      : [],
    siteIds.length
      ? prisma.site.findMany({
          where: { ngoId, id: { in: siteIds } },
          select: { id: true },
        })
      : [],
  ]);

  if (projects.length !== projectIds.length) {
    return { error: "One or more projects do not belong to this NGO." };
  }
  if (sites.length !== siteIds.length) {
    return { error: "One or more sites do not belong to this NGO." };
  }
  return { assignedProjectIds: projectIds, assignedSiteIds: siteIds };
}

export async function GET() {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const [workers, assignments] = await Promise.all([
    prisma.user.findMany({
      where: { ngoId: gate.ngoId, role: ROLES.WORKER },
      orderBy: { createdAt: "desc" },
      include: { salary: true },
    }),
    ngoAssignments(gate.ngoId),
  ]);

  return NextResponse.json({
    items: workers.map((worker) => publicWorker(worker, assignments)),
  });
}

export async function POST(request) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const parsed = parseWorkerBody(await request.json().catch(() => null), { requirePassword: true });
  if (parsed.error) return jsonError(parsed.error);

  const { password, salary, ...fields } = parsed.data;
  const scoped = await scopedIds(gate.ngoId, fields.assignedProjectIds, fields.assignedSiteIds);
  if (scoped.error) return jsonError(scoped.error);

  const [emailTaken, employeeTaken] = await Promise.all([
    prisma.user.findUnique({ where: { email: fields.email }, select: { id: true } }),
    prisma.user.findFirst({
      where: { ngoId: gate.ngoId, employeeId: fields.employeeId },
      select: { id: true },
    }),
  ]);

  if (emailTaken) return jsonError("That email is already in use.");
  if (employeeTaken) return jsonError("That employee ID is already in use for this NGO.");

  const userId = crypto.randomUUID().replaceAll("-", "");
  const accountId = crypto.randomUUID().replaceAll("-", "");
  const passwordHash = await hashPassword(password);

  try {
    const worker = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: userId,
          role: ROLES.WORKER,
          ngoId: gate.ngoId,
          ...fields,
          assignedProjectIds: scoped.assignedProjectIds,
          assignedSiteIds: scoped.assignedSiteIds,
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

      await tx.workerSalary.create({
        data: {
          userId,
          ngoId: gate.ngoId,
          ...salary,
        },
      });

      return tx.user.findUnique({
        where: { id: created.id },
        include: { salary: true },
      });
    });

    const assignments = await ngoAssignments(gate.ngoId);
    return NextResponse.json({ item: publicWorker(worker, assignments) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return jsonError("Could not create the worker. Please try again.", 500);
  }
}
