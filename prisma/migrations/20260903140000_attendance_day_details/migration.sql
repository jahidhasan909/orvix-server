-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN "checkInAt" TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN "checkOutAt" TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN "reason" TEXT;
