CREATE TABLE "SitePublishingApiKey" (
    "id" TEXT NOT NULL,
    "siteProjectId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePublishingApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SitePublishingApiKey_keyHash_key" ON "SitePublishingApiKey"("keyHash");
CREATE INDEX "SitePublishingApiKey_siteProjectId_revokedAt_idx" ON "SitePublishingApiKey"("siteProjectId", "revokedAt");

ALTER TABLE "SitePublishingApiKey"
ADD CONSTRAINT "SitePublishingApiKey_siteProjectId_fkey" FOREIGN KEY ("siteProjectId") REFERENCES "SiteProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
