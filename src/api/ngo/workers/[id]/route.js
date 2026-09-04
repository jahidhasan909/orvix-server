import { NextResponse } from "#shims/next-server.js";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import { parseWorkerBody, publicWorker } from "#lib/worker-payload.js";
import { scopedAssignmentIds } from "#lib/project-site.js";

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


async function ownWorker(ngoId, id) {
  return prisma.user.findFirst({
    where: { id, ngoId, role: ROLES.WORKER },
    include: { salary: true },
  });
}

export async function GET(_request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const worker = await ownWorker(gate.ngoId, id);
  if (!worker) return jsonError("Worker not found.", 404);

  return NextResponse.json({ item: publicWorker(worker, await ngoAssignments(gate.ngoId)) });
}

export async function PATCH(request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const existing = await ownWorker(gate.ngoId, id);
  if (!existing) return jsonError("Worker not found.", 404);

  const parsed = parseWorkerBody(await request.json().catch(() => null));
  if (parsed.error) return jsonError(parsed.error);

  const { password, salary, ...fields } = parsed.data;
  const scoped = await scopedAssignmentIds(prisma, gate.ngoId, fields.assignedProjectIds, fields.assignedSiteIds);
  if (scoped.error) return jsonError(scoped.error);

  const [emailTaken, employeeTaken] = await Promise.all([
    prisma.user.findFirst({
      where: { email: fields.email, NOT: { id } },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: { ngoId: gate.ngoId, employeeId: fields.employeeId, NOT: { id } },
      select: { id: true },
    }),
  ]);

  if (emailTaken) return jsonError("That email is already in use.");
  if (employeeTaken) return jsonError("That employee ID is already in use for this NGO.");

  try {
    const worker = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          ...fields,
          assignedProjectIds: scoped.assignedProjectIds,
          assignedSiteIds: scoped.assignedSiteIds,
        },
      });

      await tx.workerSalary.upsert({
        where: { userId: id },
        create: {
          userId: id,
          ngoId: gate.ngoId,
          ...salary,
        },
        update: salary,
      });

      if (password) {
        const passwordHash = await hashPassword(password);
        const account = await tx.account.findFirst({
          where: { userId: id, providerId: "credential" },
        });
        if (account) {
          await tx.account.update({
            where: { id: account.id },
            data: { password: passwordHash },
          });
        } else {
          await tx.account.create({
            data: {
              id: crypto.randomUUID().replaceAll("-", ""),
              accountId: id,
              providerId: "credential",
              userId: id,
              password: passwordHash,
              issuer: "local:credential",
            },
          });
        }
      }

      return tx.user.findUnique({
        where: { id },
        include: { salary: true },
      });
    });

    return NextResponse.json({ item: publicWorker(worker, await ngoAssignments(gate.ngoId)) });
  } catch (error) {
    console.error(error);
    return jsonError("Could not update the worker. Please try again.", 500);
  }
}
