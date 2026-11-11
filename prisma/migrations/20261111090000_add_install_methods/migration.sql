-- AlterTable
ALTER TABLE "SiteProject" ADD COLUMN     "proxyVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "staticExportedAt" TIMESTAMP(3),
ADD COLUMN     "staticExportedCount" INTEGER,
ADD COLUMN     "staticExportedFingerprint" TEXT;
