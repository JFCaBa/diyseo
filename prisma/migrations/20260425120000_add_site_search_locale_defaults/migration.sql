-- AlterTable
ALTER TABLE "SiteProject"
ADD COLUMN "defaultSearchCountry" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN "defaultSearchLanguage" TEXT NOT NULL DEFAULT 'es';
