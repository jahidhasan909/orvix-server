import { resolveAbsencePolicy } from "#lib/absence-policy.js";
import { dateKey, utcDate } from "#lib/payroll.js";

export function minutesPresent(checkInAt, checkOutAt) {
  if (!checkInAt || !checkOutAt) return null;
  const minutes = Math.round((new Date(checkOutAt) - new Date(checkInAt)) / 60000);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
}

export function durationLabel(minutes) {
  if (minutes == null) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

export function displayStatus(outcome) {
  if (outcome === "present") return "Present";
  if (outcome === "paid_leave" || outcome === "unpaid_leave") return "Leave";
  if (outcome === "holiday") return "Holiday";
  return "Absent";
}

function leaveCovers(leave, dayKey) {
  const day = utcDate(dayKey);
  const start = utcDate(leave.startsOn || leave.startDate);
  const end = utcDate(leave.endsOn || leave.endDate || leave.startsOn);
  if (!day || !start || !end) return false;
  return day >= start && day <= end;
}

function publicLeave(leave, record) {
  if (leave) {
    return {
      type: leave.type || "Leave",
      paid: leave.paid !== false,
      from: dateKey(leave.startsOn || leave.startDate),
      to: dateKey(leave.endsOn || leave.endDate || leave.startsOn),
      days: leave.days ?? null,
    };
  }
  if (record?.status === "leave") {
    return {
      type: "Leave",
      paid: record.leavePaid !== false,
      from: dateKey(record.date),
      to: dateKey(record.date),
      days: 1,
    };
  }
  return null;
}

export function decorateAttendanceDays(days = [], records = [], leaves = []) {
  const byDate = new Map((records ?? []).map((record) => [dateKey(record.date), record]));

  return (days ?? []).map((day) => {
    const record = byDate.get(day.date);
    const leave = (leaves ?? []).find((item) => leaveCovers(item, day.date));
    const status = displayStatus(day.outcome);
    const policy = status === "Absent" ? resolveAbsencePolicy(record?.reason) : null;
    const reason = policy?.label || record?.reason?.trim() || "";

    return {
      date: day.date,
      outcome: day.outcome,
      status,
      paid: day.outcome === "paid_absence" || day.outcome === "paid_leave",
      recorded: Boolean(day.recorded),
      checkInAt: record?.checkInAt ?? null,
      checkOutAt: record?.checkOutAt ?? null,
      minutesPresent: minutesPresent(record?.checkInAt, record?.checkOutAt),
      reason: status === "Absent" ? record?.reason?.trim() || reason || (day.recorded ? "" : "No attendance recorded") : "",
      leave: status === "Leave" ? publicLeave(leave, record) : null,
    };
  });
}

export function monthCursor(value = new Date()) {
  const date = utcDate(value) ?? utcDate(new Date());
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return {
    year: start.getUTCFullYear(),
    month: start.getUTCMonth(),
    from: dateKey(start),
    to: dateKey(end),
  };
}

export function shiftMonth(from, delta) {
  const date = utcDate(from) ?? utcDate(new Date());
  return monthCursor(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)));
}
