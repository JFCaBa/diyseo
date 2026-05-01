import { generateArticleCoverImage } from "@/lib/ai/image-generator";
import { prisma } from "@/lib/prisma";
import { saveArticleCoverImageLocally } from "@/lib/storage/local";

export async function generateAndSaveArticleCoverImage(input: {
  siteId: string;
  articleId: string;
  titleOverride?: string | null;
  excerptOverride?: string | null;
}) {
  const article = await prisma.article.findFirst({
    where: { id: input.articleId, siteProjectId: input.siteId },
    select: {
      id: true,
      title: true,
      excerpt: true,
      siteProject: {
        select: {
          id: true,
          name: true,
          domain: true,
          brandProfile: {
            select: {
              contentLanguage: true,
              businessType: true,
              brandVoiceTone: true,
              targetAudience: true,
              serviceArea: true,
              topicsToAvoid: true,
              keyThemes: true,
              customImageInstructions: true,
              imageStyle: true
            }
          }
        }
      }
    }
  });

  if (!article) {
    throw new Error("Article not found.");
  }

  if (!article.siteProject.brandProfile) {
    throw new Error("Brand profile is missing for this site.");
  }

  const image = await generateArticleCoverImage({
    article: {
      id: article.id,
      title: input.titleOverride || article.title,
      excerpt: input.excerptOverride ?? article.excerpt
    },
    site: {
      id: article.siteProject.id,
      name: article.siteProject.name,
      domain: article.siteProject.domain
    },
    brandProfile: article.siteProject.brandProfile
  });

  const saved = await saveArticleCoverImageLocally({
    siteId: article.siteProject.id,
    articleId: article.id,
    image
  });

  await prisma.article.update({
    where: { id: article.id },
    data: { coverImageUrl: saved.publicUrl }
  });

  return { coverImageUrl: saved.publicUrl };
}
