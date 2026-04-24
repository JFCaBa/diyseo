-- CreateEnum
CREATE TYPE "ArticleGenerationSource" AS ENUM ('MANUAL', 'AUTO');

-- AlterTable
ALTER TABLE "Article"
ADD COLUMN "generationSource" "ArticleGenerationSource" NOT NULL DEFAULT 'MANUAL';
