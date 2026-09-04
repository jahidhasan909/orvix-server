import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { ROLES } from "#lib/navigation.js";
import { requireNgoAdmin } from "#lib/require-ngo-admin.js";
import { monthBounds, publicSalary, utcDate } from "#lib/payroll.js";
import { buildWorkerSalaryPeriod } from "#lib/salary-period.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request, { params }) {
  const gate = await requireNgoAdmin();
  if (gate.error) return jsonError(gate.error, gate.status);

  const { id } = await params;
  const worker = await prisma.user.findFirst({
    where: { id, ngoId: gate.ngoId, role: ROLES.WORKER },
    include: { salary: true },
  });
  if (!worker) return jsonError("Worker not found.", 404);

  const bounds = monthBounds();
  const from = utcDate(request.nextUrl.searchParams.get("from")) ?? bounds.start;
  const to = utcDate(request.nextUrl.searchParams.get("to")) ?? bounds.end;
  const result = await buildWorkerSalaryPeriod(prisma, {
    ngoId: gate.ngoId,
    worker,
    from,
    to,
  });

  return NextResponse.json({
    workerId: worker.id,
    salary: publicSalary(worker.salary),
    ...result,
  });
}
