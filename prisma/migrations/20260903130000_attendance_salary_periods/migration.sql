-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "leavePaid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN "paid" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LeaveRequest" ADD COLUMN "startsOn" DATE;
ALTER TABLE "LeaveRequest" ADD COLUMN "endsOn" DATE;

-- CreateTable
CREATE TABLE "SalaryPeriod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ngoId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "workingDays" INTEGER NOT NULL,
    "presentDays" INTEGER NOT NULL,
    "absentDays" INTEGER NOT NULL,
    "paidLeaveDays" INTEGER NOT NULL,
    "unpaidLeaveDays" INTEGER NOT NULL,
    "totalSalary" DECIMAL(12,2) NOT NULL,
    "totalDeduction" DECIMAL(12,2) NOT NULL,
    "payableSalary" DECIMAL(12,2) NOT NULL,
    "dailyRate" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalaryPeriod_userId_periodStart_periodEnd_key" ON "SalaryPeriod"("userId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SalaryPeriod_ngoId_idx" ON "SalaryPeriod"("ngoId");

-- AddForeignKey
ALTER TABLE "SalaryPeriod" ADD CONSTRAINT "SalaryPeriod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryPeriod" ADD CONSTRAINT "SalaryPeriod_ngoId_fkey" FOREIGN KEY ("ngoId") REFERENCES "Ngo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
