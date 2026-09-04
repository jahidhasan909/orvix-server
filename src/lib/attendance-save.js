import { ATTENDANCE_STATUS, dateKey, utcDate } from "#lib/payroll.js";

export function presentPunch(existing, requested) {
  const now = new Date();
  const status = String(existing?.status || "").toLowerCase();
  const checkedIn = status === ATTENDANCE_STATUS.PRESENT && Boolean(existing?.checkInAt);
  const closed = checkedIn && Boolean(existing?.checkOutAt);
  const wantOut = requested === "check-out";

  if (status === ATTENDANCE_STATUS.LEAVE || status === ATTENDANCE_STATUS.HOLIDAY) {
    return { error: "This date is already marked as leave or holiday." };
  }
  if (closed) {
    return { error: "Attendance for this date is already completed." };
  }
  if (wantOut && !checkedIn) {
    return { error: "Check in before you check out." };
  }
  if (!wantOut && checkedIn) {
    return { error: "Already checked in for this date." };
  }
  if (wantOut) {
    const checkOutAt = now < new Date(existing.checkInAt) ? new Date(existing.checkInAt) : now;
    return {
      checkInAt: existing.checkInAt,
      checkOutAt,
      action: "check-out",
    };
  }
  return {
    checkInAt: now,
    checkOutAt: null,
    action: "check-in",
  };
}

export function absenceReasonLabel(policy, note) {
  const detail = typeof note === "string" ? note.trim() : "";
  if (!detail) return policy.label;
  return `${policy.label}: ${detail}`;
}

export function dayRange(value) {
  const start = utcDate(value);
  if (!start) return null;
  return { start, end: new Date(start.getTime() + 86400000) };
}

export async function upsertWorkerAttendance(prisma, { ngoId, userId, workerName, date, data }) {
  const range = dayRange(date);
  if (!range) throw new Error("Invalid attendance date.");

  const existing = await prisma.attendanceRecord.findMany({
    where: {
      ngoId,
      userId,
      date: { gte: range.start, lt: range.end },
    },
    orderBy: { createdAt: "asc" },
  });

  const payload = {
    ngoId,
    userId,
    worker: workerName,
    date: range.start,
    ...data,
  };

  if (!existing.length) {
    return prisma.attendanceRecord.create({ data: payload });
  }

  const [keep, ...duplicates] = existing;
  const record = await prisma.attendanceRecord.update({
    where: { id: keep.id },
    data: payload,
  });

  if (duplicates.length) {
    await prisma.attendanceRecord.deleteMany({
      where: { id: { in: duplicates.map((item) => item.id) } },
    });
  }

  return record;
}

export function publicAttendanceRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    userId: record.userId,
    date: dateKey(record.date),
    status: record.status,
    reason: record.reason || "",
    leavePaid: Boolean(record.leavePaid),
    checkInAt: record.checkInAt,
    checkOutAt: record.checkOutAt,
  };
}
