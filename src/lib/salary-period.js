import { calculateAttendancePay, monthBounds, publicSalaryPeriod, utcDate } from "#lib/payroll.js";

export async function buildWorkerSalaryPeriod(prisma, { ngoId, worker, from, to }) {
  const bounds = monthBounds();
  const periodStart = utcDate(from) ?? bounds.start;
  const periodEnd = utcDate(to) ?? bounds.end;

  const [records, leaves] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: {
        ngoId,
        userId: worker.id,
        date: { gte: periodStart, lte: periodEnd },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.leaveRequest.findMany({
      where: {
        ngoId,
        userId: worker.id,
        status: "approved",
      },
    }),
  ]);

  const calculation = calculateAttendancePay(worker.salary, records, {
    from: periodStart,
    to: periodEnd,
    joiningDate: worker.joiningDate,
    leaves,
  });

  const snapshot = calculation.skipped
    ? null
    : await prisma.salaryPeriod.upsert({
        where: {
          userId_periodStart_periodEnd: {
            userId: worker.id,
            periodStart,
            periodEnd,
          },
        },
        create: {
          userId: worker.id,
          ngoId,
          periodStart,
          periodEnd,
          workingDays: calculation.workingDays,
          presentDays: calculation.presentDays,
          absentDays: calculation.absentDays,
          paidLeaveDays: calculation.paidLeaveDays,
          unpaidLeaveDays: calculation.unpaidLeaveDays,
          totalSalary: calculation.totalSalary,
          totalDeduction: calculation.totalDeduction,
          payableSalary: calculation.payableSalary,
          dailyRate: calculation.dailyRate,
        },
        update: {
          workingDays: calculation.workingDays,
          presentDays: calculation.presentDays,
          absentDays: calculation.absentDays,
          paidLeaveDays: calculation.paidLeaveDays,
          unpaidLeaveDays: calculation.unpaidLeaveDays,
          totalSalary: calculation.totalSalary,
          totalDeduction: calculation.totalDeduction,
          payableSalary: calculation.payableSalary,
          dailyRate: calculation.dailyRate,
        },
      });

  return {
    period: {
      from: periodStart.toISOString().slice(0, 10),
      to: periodEnd.toISOString().slice(0, 10),
    },
    attendance: records,
    leaves,
    calculation,
    record: publicSalaryPeriod(snapshot),
  };
}
