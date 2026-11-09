import { createUniqueArticleSlug } from "@/lib/article-slug";
import { prisma } from "@/lib/prisma";
import { getAIGenerationService } from "@/lib/ai";
import { commitArticleCredit, releaseArticleCredit, reserveArticleCredit } from "@/lib/quota";
import { renderMarkdownToHtml } from "@/lib/markdown";
import { sanitizeInternalLinks } from "@/lib/internal-links";
import { fetchSitePages, siteOrigin } from "@/lib/site-pages";
import { GenerateArticleRequestSchema } from "@/lib/validations";
import type { ArticleGenerationSource, ArticleStatus } from "@prisma/client";

function normalizeKeywordTerm(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

async function getSiteGenerationContext(siteId: string) {
  const site = await prisma.siteProject.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      domain: true,
      workspaceId: true,
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

  return {
    ...site,
    brandProfile: site.brandProfile
  };
}

export async function generateKeywordSuggestionsForSite(siteId: string) {
  const site = await getSiteGenerationContext(siteId);
  const generator = getAIGenerationService();
  const generated = await generator.generateArticle({
    site: { name: site.name, domain: site.domain },
    brandProfile: site.brandProfile
  });

  const keywordTerms = Array.from(new Set(generated.keywords.map((keyword) => normalizeKeywordTerm(keyword)))).slice(0, 7);

  await prisma.keyword.createMany({
    data: keywordTerms.map((term) => ({
      siteProjectId: site.id,
      term,
      status: "NEW" as const
    })),
    skipDuplicates: true
  });

  return prisma.keyword.findMany({
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
}

type SaveGeneratedArticleInput = {
  keyword?: string;
  status?: ArticleStatus;
  publishedAt?: Date | null;
  assignKeywordId?: string | null;
  generationSource?: ArticleGenerationSource;
};

export async function saveGeneratedArticleForSite(siteId: string, input: SaveGeneratedArticleInput = {}) {
  const site = await getSiteGenerationContext(siteId);
  const usageId = await reserveArticleCredit({ workspaceId: site.workspaceId, siteProjectId: site.id, kind: "ARTICLE" });

  try {
    return await writeGeneratedArticle(site, input, usageId);
  } catch (error) {
    await releaseArticleCredit(usageId);
    throw error;
  }
}

async function writeGeneratedArticle(
  site: Awaited<ReturnType<typeof getSiteGenerationContext>>,
  input: SaveGeneratedArticleInput,
  usageId: string
) {
  const generator = getAIGenerationService();
  const sitePages = await fetchSitePages(site.domain);
  const generated = await generator.generateArticle({
    keyword: input.keyword,
    site: { name: site.name, domain: site.domain },
    sitePages,
    brandProfile: site.brandProfile
  });
  // The model can still invent a path: links to the site that are not real pages become plain text.
  const origin = siteOrigin(site.domain);
  const contentMarkdown = origin
    ? sanitizeInternalLinks(generated.contentMarkdown, origin, sitePages).markdown
    : generated.contentMarkdown;

  const slug = await createUniqueArticleSlug(site.id, generated.title, "generated-article");
  const keywordTerms = Array.from(new Set(generated.keywords.map((keyword) => normalizeKeywordTerm(keyword)))).slice(0, 7);
  const status = input.status ?? "DRAFT";
  const publishedAt = status === "PUBLISHED" ? (input.publishedAt ?? new Date()) : null;
  const generationSource = input.generationSource ?? "MANUAL";

  return prisma.$transaction(async (tx) => {
    await commitArticleCredit(tx, usageId);
    const article = await tx.article.create({
      data: {
        siteProjectId: site.id,
        title: generated.title,
        slug,
        excerpt: generated.excerpt,
        contentHtml: renderMarkdownToHtml(contentMarkdown),
        contentMarkdown,
        seoTitle: generated.seoTitle,
        seoDescription: generated.seoDescription,
        status,
        generationSource,
        publishedAt,
        keywordId: input.assignKeywordId ?? null
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

    if (input.assignKeywordId) {
      await tx.keyword.update({
        where: { id: input.assignKeywordId },
        data: {
          status: "USED"
        }
      });
    }

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

export async function generateArticleForSite(siteId: string, input: unknown) {
  const request = GenerateArticleRequestSchema.parse(input);

  return saveGeneratedArticleForSite(siteId, {
    keyword: request.keyword,
    status: "DRAFT",
    publishedAt: null
  });
}
