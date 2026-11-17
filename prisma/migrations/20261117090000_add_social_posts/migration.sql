-- CreateEnum
CREATE TYPE "SocialNetwork" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'X', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "SocialPostStatus" AS ENUM ('DRAFT', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "SiteSocialConnection" (
    "id" TEXT NOT NULL,
    "siteProjectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'META',
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "instagramAccountId" TEXT,
    "instagramUsername" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "tokenLast4" TEXT NOT NULL,
    "connectedByUserId" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSocialConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "siteProjectId" TEXT NOT NULL,
    "network" "SocialNetwork" NOT NULL,
    "text" TEXT NOT NULL,
    "status" "SocialPostStatus" NOT NULL DEFAULT 'DRAFT',
    "attemptId" TEXT,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "error" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteSocialConnection_siteProjectId_key" ON "SiteSocialConnection"("siteProjectId");

-- CreateIndex
CREATE INDEX "SocialPost_siteProjectId_idx" ON "SocialPost"("siteProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_articleId_network_key" ON "SocialPost"("articleId", "network");

-- AddForeignKey
ALTER TABLE "SiteSocialConnection" ADD CONSTRAINT "SiteSocialConnection_siteProjectId_fkey" FOREIGN KEY ("siteProjectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_siteProjectId_fkey" FOREIGN KEY ("siteProjectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

