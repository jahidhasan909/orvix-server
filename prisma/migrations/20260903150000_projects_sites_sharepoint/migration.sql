-- AlterTable
ALTER TABLE "Ngo" ADD COLUMN "sharePointSiteUrl" TEXT;
ALTER TABLE "Ngo" ADD COLUMN "sharePointLibrary" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "description" TEXT;
ALTER TABLE "Project" ADD COLUMN "startDate" DATE;
ALTER TABLE "Project" ADD COLUMN "endDate" DATE;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN "description" TEXT;
ALTER TABLE "Site" ADD COLUMN "startDate" DATE;
ALTER TABLE "Site" ADD COLUMN "endDate" DATE;
