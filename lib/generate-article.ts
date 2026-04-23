import { prisma } from "@/lib/prisma";
import { getAIGenerationService } from "@/lib/ai";
import { GenerateArticleRequestSchema } from "@/lib/validations";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 100);
}

async function createUniqueSlug(siteProjectId: string, title: string) {
  const baseSlug = slugify(title) || "generated-article";
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.article.findUnique({
      where: {
        siteProjectId_slug: {
          siteProjectId,
          slug
        }
      },
      select: { id: true }
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function normalizeKeywordTerm(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export async function generateArticleForSite(siteId: string, input: unknown) {
  const request = GenerateArticleRequestSchema.parse(input);

  const site = await prisma.siteProject.findUnique({
    where: { id: siteId },
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
  });

  if (!site) {
    throw new Error("Site not found.");
  }

  if (!site.brandProfile) {
    throw new Error("Brand profile is missing for this site.");
  }

  const generator = getAIGenerationService();
  const generated = await generator.generateArticle({
    keyword: request.keyword,
    site: { name: site.name, domain: site.domain },
    brandProfile: site.brandProfile
  });

  const slug = await createUniqueSlug(site.id, generated.title);
  const keywordTerms = Array.from(new Set(generated.keywords.map((keyword) => normalizeKeywordTerm(keyword)))).slice(0, 7);

  return prisma.$transaction(async (tx) => {
    const article = await tx.article.create({
      data: {
        siteProjectId: site.id,
        title: generated.title,
        slug,
        excerpt: generated.excerpt,
        contentHtml: generated.contentHtml,
        seoTitle: generated.seoTitle,
        seoDescription: generated.seoDescription,
        status: "DRAFT"
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        seoTitle: true,
        seoDescription: true,
        status: true
      }
    });

    await tx.keyword.createMany({
      data: keywordTerms.map((term) => ({
        siteProjectId: site.id,
        term,
        status: "NEW" as const
      })),
      skipDuplicates: true
    });

    const keywords = await tx.keyword.findMany({
      where: {
        siteProjectId: site.id,
        term: {
          in: keywordTerms
        }
      },
      orderBy: {
        term: "asc"
      },
      select: {
        id: true,
        term: true,
        status: true
      }
    });

    return {
      article,
      keywords
    };
  });
}
