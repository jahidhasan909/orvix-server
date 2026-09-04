import { isPaidAbsence } from "#lib/absence-policy.js";

export const SALARY_TYPES = {
  MONTHLY: "monthly",
  DAILY: "daily",
};

export const SALARY_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

export const ATTENDANCE_STATUS = {
  PRESENT: "present",
  ABSENT: "absent",
  LEAVE: "leave",
  HOLIDAY: "holiday",
  LATE: "late",
};

export const DAY_OUTCOME = {
  PRESENT: "present",
  ABSENT: "absent",
  PAID_ABSENCE: "paid_absence",
  PAID_LEAVE: "paid_leave",
  UNPAID_LEAVE: "unpaid_leave",
  HOLIDAY: "holiday",
};

export const DEFAULT_WORKING_DAYS_PER_MONTH = 30;

export function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function utcDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const utcMidnight =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0;
    if (utcMidnight) {
      return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    }
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  const raw = String(value || "").trim();
  if (!raw) return null;
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly && !raw.includes("T")) {
    return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return utcDate(parsed);
}

export function dateKey(value) {
  const date = utcDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

export function eachUtcDate(from, to) {
  const start = utcDate(from);
  const end = utcDate(to);
  if (!start || !end || start > end) return [];
  const days = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86400000)) {
    days.push(new Date(cursor));
  }
  return days;
}

export function monthBounds(date = new Date()) {
  const current = utcDate(date) ?? new Date();
  const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1));
  const end = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
  return { start, end };
}

export function parseSalaryInput(input) {
  const source = input && typeof input === "object" ? input : {};
  const basicSalary = Number(source.basicSalary);
  const salaryType = source.salaryType === SALARY_TYPES.DAILY ? SALARY_TYPES.DAILY : SALARY_TYPES.MONTHLY;
  const status = source.status === SALARY_STATUSES.INACTIVE ? SALARY_STATUSES.INACTIVE : SALARY_STATUSES.ACTIVE;

  if (!Number.isFinite(basicSalary) || basicSalary < 0) {
    return { error: "Basic salary must be a number of 0 or more." };
  }

  return {
    data: {
      basicSalary: money(basicSalary),
      salaryType,
      status,
    },
  };
}

export function publicSalary(salary) {
  if (!salary) return null;
  return {
    id: salary.id,
    basicSalary: money(salary.basicSalary),
    salaryType: salary.salaryType,
    status: salary.status,
  };
}

export function dailyRate(salary, workingDaysPerMonth = DEFAULT_WORKING_DAYS_PER_MONTH) {
  const basic = money(salary?.basicSalary);
  if (!Number.isFinite(basic)) return 0;
  if (salary.salaryType === SALARY_TYPES.DAILY) return basic;
  const days = workingDaysPerMonth > 0 ? workingDaysPerMonth : DEFAULT_WORKING_DAYS_PER_MONTH;
  return money(basic / days);
}

function leaveCovers(leave, day) {
  if (String(leave.status || "").toLowerCase() !== "approved") return false;
  const start = utcDate(leave.startsOn || leave.startDate);
  const end = utcDate(leave.endsOn || leave.endDate || leave.startsOn);
  if (!start || !end) return false;
  return day >= start && day <= end;
}

function outcomeForDay(day, record, leaves = [], reasons) {
  const status = String(record?.status || "").toLowerCase();
  if (status === ATTENDANCE_STATUS.HOLIDAY) return DAY_OUTCOME.HOLIDAY;
  if (status === ATTENDANCE_STATUS.PRESENT || status === ATTENDANCE_STATUS.LATE) return DAY_OUTCOME.PRESENT;
  if (status === ATTENDANCE_STATUS.ABSENT) {
    return isPaidAbsence(record, reasons) ? DAY_OUTCOME.PAID_ABSENCE : DAY_OUTCOME.ABSENT;
  }
  if (status === ATTENDANCE_STATUS.LEAVE) {
    return record.leavePaid === false ? DAY_OUTCOME.UNPAID_LEAVE : DAY_OUTCOME.PAID_LEAVE;
  }

  const leave = leaves.find((item) => leaveCovers(item, day));
  if (leave) return leave.paid === false ? DAY_OUTCOME.UNPAID_LEAVE : DAY_OUTCOME.PAID_LEAVE;
  return DAY_OUTCOME.ABSENT;
}

export function calculateAttendancePay(salary, records = [], options = {}) {
  const workingDaysPerMonth = options.workingDaysPerMonth ?? DEFAULT_WORKING_DAYS_PER_MONTH;
  const from = utcDate(options.from);
  const to = utcDate(options.to);
  const today = utcDate(options.now ?? new Date());
  const joiningDate = utcDate(options.joiningDate);
  const leaves = Array.isArray(options.leaves) ? options.leaves : [];
  const reasons = options.absenceReasons;
  const byDate = new Map((records ?? []).map((record) => [dateKey(record.date), record]));

  const empty = {
    workingDays: 0,
    presentDays: 0,
    absentDays: 0,
    paidAbsenceDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    totalSalary: money(salary?.basicSalary ?? 0),
    totalDeduction: 0,
    payableSalary: 0,
    dailyRate: 0,
    days: [],
    skipped: true,
  };

  if (!from || !to || !today) return { ...empty, reason: "Invalid salary period." };

  const lastExpected = to < today ? to : today;
  const days = [];

  for (const day of eachUtcDate(from, to)) {
    if (joiningDate && day < joiningDate) continue;
    if (day > lastExpected) continue;
    const record = byDate.get(dateKey(day));
    const outcome = outcomeForDay(day, record, leaves, reasons);
    if (outcome === DAY_OUTCOME.HOLIDAY) continue;
    days.push({
      date: dateKey(day),
      outcome,
      recorded: Boolean(record),
    });
  }

  if (!salary || salary.status !== SALARY_STATUSES.ACTIVE) {
    return { ...empty, days, reason: "Salary is inactive or not configured." };
  }

  const presentDays = days.filter((day) => day.outcome === DAY_OUTCOME.PRESENT).length;
  const paidLeaveDays = days.filter((day) => day.outcome === DAY_OUTCOME.PAID_LEAVE).length;
  const unpaidLeaveDays = days.filter((day) => day.outcome === DAY_OUTCOME.UNPAID_LEAVE).length;
  const paidAbsenceDays = days.filter((day) => day.outcome === DAY_OUTCOME.PAID_ABSENCE).length;
  const absentDays = days.filter((day) => day.outcome === DAY_OUTCOME.ABSENT).length;
  const unpaidDays = absentDays + unpaidLeaveDays;
  const paidDays = presentDays + paidLeaveDays + paidAbsenceDays;
  const monthDays = eachUtcDate(from, to).length || workingDaysPerMonth;
  const joinStart = joiningDate && joiningDate > from ? joiningDate : from;
  const employedDays = eachUtcDate(joinStart, to).length;
  const rate = dailyRate(salary, monthDays);
  const totalSalary =
    salary.salaryType === SALARY_TYPES.DAILY
      ? money(rate * paidDays)
      : money(rate * employedDays);

  if (salary.salaryType === SALARY_TYPES.DAILY) {
    return {
      workingDays: days.length,
      presentDays,
      absentDays,
      paidAbsenceDays,
      paidLeaveDays,
      unpaidLeaveDays,
      totalSalary,
      dailyRate: rate,
      totalDeduction: 0,
      payableSalary: totalSalary,
      salaryType: SALARY_TYPES.DAILY,
      days,
      skipped: false,
    };
  }

  const totalDeduction = money(rate * unpaidDays);
  return {
    workingDays: days.length,
    presentDays,
    absentDays,
    paidAbsenceDays,
    paidLeaveDays,
    unpaidLeaveDays,
    totalSalary,
    dailyRate: rate,
    workingDaysPerMonth: monthDays,
    employedDays,
    totalDeduction,
    payableSalary: money(Math.max(0, totalSalary - totalDeduction)),
    salaryType: SALARY_TYPES.MONTHLY,
    days,
    skipped: false,
  };
}

export function publicSalaryPeriod(period) {
  if (!period) return null;
  return {
    id: period.id,
    from: dateKey(period.periodStart),
    to: dateKey(period.periodEnd),
    workingDays: period.workingDays,
    presentDays: period.presentDays,
    absentDays: period.absentDays,
    paidLeaveDays: period.paidLeaveDays,
    unpaidLeaveDays: period.unpaidLeaveDays,
    totalSalary: money(period.totalSalary),
    totalDeduction: money(period.totalDeduction),
    payableSalary: money(period.payableSalary),
    dailyRate: money(period.dailyRate),
  };
}
