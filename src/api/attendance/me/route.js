import { NextResponse } from "#shims/next-server.js";
import { prisma } from "#lib/prisma.js";
import { ABSENCE_REASONS, resolveAbsencePolicy } from "#lib/absence-policy.js";
import { decorateAttendanceDays } from "#lib/attendance-day.js";
import { absenceReasonLabel, presentPunch, publicAttendanceRecord, upsertWorkerAttendance } from "#lib/attendance-save.js";
import { ATTENDANCE_STATUS, dateKey, monthBounds, utcDate } from "#lib/payroll.js";
import { requireNgoSession } from "#lib/require-ngo-session.js";
import { ROLES } from "#lib/navigation.js";
import { buildWorkerSalaryPeriod } from "#lib/salary-period.js";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function payloadFrom(result, dayKey) {
  return {
    date: dayKey,
    reasons: ABSENCE_REASONS,
    period: result.period,
    calculation: {
      ...result.calculation,
      days: decorateAttendanceDays(result.calculation.days, result.attendance, result.leaves),
    },
    record: result.record,
  };
}

export async function GET(request) {
  const gate = await requireNgoSession([ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);

  const bounds = monthBounds();
  const from = utcDate(request.nextUrl.searchParams.get("from")) ?? bounds.start;
  const to = utcDate(request.nextUrl.searchParams.get("to")) ?? bounds.end;

  const worker = await prisma.user.findFirst({
    where: { id: gate.userId, ngoId: gate.ngoId, role: ROLES.WORKER },
    include: { salary: true },
  });
  if (!worker) return jsonError("Worker not found.", 404);

  const result = await buildWorkerSalaryPeriod(prisma, {
    ngoId: gate.ngoId,
    worker,
    from,
    to,
  });

  return NextResponse.json({
    joiningDate: dateKey(worker.joiningDate),
    ...payloadFrom(result, dateKey(new Date())),
  });
}

export async function POST(request) {
  const gate = await requireNgoSession([ROLES.WORKER]);
  if (gate.error) return jsonError(gate.error, gate.status);

  const body = await request.json().catch(() => ({}));
  const today = utcDate(new Date());
  const date = utcDate(body?.date) ?? today;
  const status = String(body?.status || ATTENDANCE_STATUS.PRESENT).toLowerCase();

  if (!date) return jsonError("A valid date is required.");
  if (date > today) return jsonError("You cannot mark attendance for a future date.");
  if (status !== ATTENDANCE_STATUS.PRESENT && status !== ATTENDANCE_STATUS.ABSENT) {
    return jsonError("Workers can only mark present or absent.");
  }

  const reasonInput = typeof body?.reason === "string" ? body.reason.trim() : "";
  const noteInput = typeof body?.note === "string" ? body.note.trim() : "";
  if (status === ATTENDANCE_STATUS.ABSENT && !reasonInput) {
    return jsonError("Please select an absent reason.");
  }

  const policy = resolveAbsencePolicy(reasonInput);
  const worker = await prisma.user.findFirst({
    where: { id: gate.userId, ngoId: gate.ngoId, role: ROLES.WORKER },
    include: { salary: true },
  });
  if (!worker) return jsonError("Worker not found.", 404);

  const joiningKey = dateKey(worker.joiningDate);
  if (joiningKey && dateKey(date) < joiningKey) {
    return jsonError("You cannot mark attendance before your joining date.");
  }

  const existing = await prisma.attendanceRecord.findFirst({
    where: {
      ngoId: gate.ngoId,
      userId: worker.id,
      date: { gte: date, lt: new Date(date.getTime() + 86400000) },
    },
  });

  let punch = null;
  if (status === ATTENDANCE_STATUS.PRESENT) {
    punch = presentPunch(existing, body?.action === "check-out" ? "check-out" : "check-in");
    if (punch.error) return jsonError(punch.error);
  }

  const record = await upsertWorkerAttendance(prisma, {
    ngoId: gate.ngoId,
    userId: worker.id,
    workerName: worker.name,
    date,
    data: {
      status,
      leavePaid: status === ATTENDANCE_STATUS.ABSENT ? policy.paid : false,
      checkInAt: punch?.checkInAt ?? null,
      checkOutAt: punch?.checkOutAt ?? null,
      reason: status === ATTENDANCE_STATUS.ABSENT ? absenceReasonLabel(policy, noteInput) : null,
    },
  });

  const bounds = monthBounds(date);
  const result = await buildWorkerSalaryPeriod(prisma, {
    ngoId: gate.ngoId,
    worker,
    from: bounds.start,
    to: bounds.end,
  });

  return NextResponse.json({
    item: publicAttendanceRecord(record),
    action: punch?.action || "absent",
    joiningDate: dateKey(worker.joiningDate),
    ...payloadFrom(result, dateKey(new Date())),
  });
}
