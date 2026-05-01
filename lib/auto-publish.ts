import type { ArticleStatus, KeywordStatus } from "@prisma/client";

import { generateKeywordSuggestionsForSite, saveGeneratedArticleForSite } from "@/lib/generate-article";
import { generateAndSaveArticleCoverImage } from "@/lib/generate-cover-image";
import { prisma } from "@/lib/prisma";

type KeywordCandidate = {
  id: string;
  term: string;
  status: KeywordStatus;
  createdAt: Date;
  _count: {
    articles: number;
  };
};

function sortKeywordCandidates(candidates: KeywordCandidate[]) {
  return [...candidates].sort((left, right) => {
    if (left._count.articles === 0 && right._count.articles > 0) {
      return -1;
    }

    if (left._count.articles > 0 && right._count.articles === 0) {
      return 1;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

async function getNewKeywordCandidates(siteId: string) {
  const keywords = await prisma.keyword.findMany({
    where: {
      siteProjectId: siteId,
      status: "NEW"
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true,
      term: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          articles: true
        }
      }
    }
  });

  return sortKeywordCandidates(keywords)[0] ?? null;
}

async function getFallbackKeywordCandidate(siteId: string, terms: string[]) {
  const keywords = await prisma.keyword.findMany({
    where: {
      siteProjectId: siteId,
      term: {
        in: terms
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true,
      term: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          articles: true
        }
      }
    }
  });

  return sortKeywordCandidates(keywords)[0] ?? null;
}

function resolveAutomatedArticleStatus(autoPublishEnabled: boolean, requireReview: boolean): ArticleStatus {
  if (autoPublishEnabled && !requireReview) {
    return "PUBLISHED";
  }

  return "DRAFT";
}

export async function generateNextAutoArticleForSite(siteId: string) {
  const site = await prisma.siteProject.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      autoPublishEnabled: true,
      requireReview: true
    }
  });

  if (!site) {
    throw new Error("Site not found.");
  }

  let selectedKeyword = await getNewKeywordCandidates(site.id);

  if (!selectedKeyword) {
    const suggestedKeywords = await generateKeywordSuggestionsForSite(site.id);

    selectedKeyword = await getFallbackKeywordCandidate(
      site.id,
      suggestedKeywords.map((keyword) => keyword.term)
    );
  }

  if (!selectedKeyword) {
    throw new Error("No keyword available for the next auto article.");
  }

  const status = resolveAutomatedArticleStatus(site.autoPublishEnabled, site.requireReview);

  const result = await saveGeneratedArticleForSite(site.id, {
    keyword: selectedKeyword.term,
    assignKeywordId: selectedKeyword.id,
    status,
    publishedAt: status === "PUBLISHED" ? new Date() : null,
    generationSource: "AUTO"
  });

  try {
    await generateAndSaveArticleCoverImage({
      siteId: site.id,
      articleId: result.article.id
    });
  } catch (error) {
    console.error(
      `Auto-publish: cover image generation failed for article ${result.article.id}:`,
      error instanceof Error ? error.message : error
    );
  }

  return {
    ...result,
    selectedKeyword: {
      id: selectedKeyword.id,
      term: selectedKeyword.term
    }
  };
}

export const AUTO_PUBLISH_MAX_ARTICLES_PER_RUN = 5;

function getStartOfCurrentUtcWeek(referenceDate = new Date()) {
  const date = new Date(referenceDate);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function runAutoPublishScheduler(maxArticlesPerRun = AUTO_PUBLISH_MAX_ARTICLES_PER_RUN) {
  const weekStart = getStartOfCurrentUtcWeek();
  const sites = await prisma.siteProject.findMany({
    where: {
      autoPublishEnabled: true
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true,
      name: true,
      articlesPerWeek: true
    }
  });

  const weeklyAutoCounts = await prisma.article.groupBy({
    by: ["siteProjectId"],
    where: {
      generationSource: "AUTO",
      createdAt: {
        gte: weekStart
      }
    },
    _count: {
      id: true
    }
  });

  const weeklyAutoCountBySiteId = new Map(weeklyAutoCounts.map((entry) => [entry.siteProjectId, entry._count.id]));
  const generated: Array<{
    siteId: string;
    siteName: string;
    articleId: string;
    title: string;
    slug: string;
    status: "DRAFT" | "PUBLISHED";
  }> = [];
  const skipped: Array<{
    siteId: string;
    siteName: string;
    reason: string;
  }> = [];
  const errors: Array<{
    siteId: string;
    siteName: string;
    error: string;
  }> = [];

  let remainingCapacity = maxArticlesPerRun;

  for (const site of sites) {
    if (remainingCapacity <= 0) {
      break;
    }

    const alreadyGeneratedThisWeek = weeklyAutoCountBySiteId.get(site.id) ?? 0;
    const missingArticles = Math.max(site.articlesPerWeek - alreadyGeneratedThisWeek, 0);

    if (missingArticles === 0) {
      skipped.push({
        siteId: site.id,
        siteName: site.name,
        reason: "Weekly target already met."
      });
      continue;
    }

    const runsForSite = Math.min(missingArticles, remainingCapacity);

    for (let index = 0; index < runsForSite; index += 1) {
      try {
        const result = await generateNextAutoArticleForSite(site.id);
        generated.push({
          siteId: site.id,
          siteName: site.name,
          articleId: result.article.id,
          title: result.article.title,
          slug: result.article.slug,
          status: result.article.status
        });
        remainingCapacity -= 1;

        if (remainingCapacity <= 0) {
          break;
        }
      } catch (error) {
        errors.push({
          siteId: site.id,
          siteName: site.name,
          error: error instanceof Error ? error.message : "Auto-publish generation failed."
        });
        break;
      }
    }
  }

  return {
    weekStart: weekStart.toISOString(),
    maxArticlesPerRun,
    generatedCount: generated.length,
    generated,
    skipped,
    errors
  };
}
