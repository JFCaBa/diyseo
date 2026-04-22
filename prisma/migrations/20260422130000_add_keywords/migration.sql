-- CreateEnum
CREATE TYPE "KeywordStatus" AS ENUM ('NEW', 'USED');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN "keywordId" TEXT;

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "siteProjectId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "status" "KeywordStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_siteProjectId_term_key" ON "Keyword"("siteProjectId", "term");

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_siteProjectId_fkey" FOREIGN KEY ("siteProjectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;
