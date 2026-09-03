-- CreateTable
CREATE TABLE "WorkerSalary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ngoId" TEXT NOT NULL,
    "basicSalary" DECIMAL(12,2) NOT NULL,
    "salaryType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerSalary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerSalary_userId_key" ON "WorkerSalary"("userId");

-- CreateIndex
CREATE INDEX "WorkerSalary_ngoId_idx" ON "WorkerSalary"("ngoId");

-- CreateIndex
CREATE INDEX "WorkerSalary_status_idx" ON "WorkerSalary"("status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_userId_date_idx" ON "AttendanceRecord"("userId", "date");

-- AddForeignKey
ALTER TABLE "WorkerSalary" ADD CONSTRAINT "WorkerSalary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerSalary" ADD CONSTRAINT "WorkerSalary_ngoId_fkey" FOREIGN KEY ("ngoId") REFERENCES "Ngo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
