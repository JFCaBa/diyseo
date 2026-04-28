import { prisma } from "@/lib/prisma";
import { getRequestedTranslationLanguage } from "@/lib/translations";

export const publicArticleSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImageUrl: true,
  contentHtml: true,
  contentMarkdown: true,
  seoTitle: true,
  seoDescription: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  siteProjectId: true,
  siteProject: {
    select: {
      name: true,
      widgetTheme: true
    }
  }
} as const;

export async function getPublishedArticles(siteId: string) {
  return prisma.article.findMany({
    where: {
      siteProjectId: siteId,
      status: "PUBLISHED"
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: publicArticleSelect
  });
}

export async function getPublishedArticleBySlug(siteId: string, slug: string) {
  return prisma.article.findFirst({
    where: {
      siteProjectId: siteId,
      slug,
      status: "PUBLISHED"
    },
    select: publicArticleSelect
  });
}

export async function getPublishedArticleBySlugWithTranslation(siteId: string, slug: string, language?: string | null) {
  const requestedLanguage = getRequestedTranslationLanguage(language);

  return prisma.article.findFirst({
    where: {
      siteProjectId: siteId,
      slug,
      status: "PUBLISHED"
    },
    select: {
      ...publicArticleSelect,
      translations: requestedLanguage
        ? {
            where: {
              language: requestedLanguage
            },
            take: 1,
            select: {
              language: true,
              title: true,
              excerpt: true,
              contentMarkdown: true,
              seoTitle: true,
              seoDescription: true
            }
          }
        : false
    }
  });
}

export async function getPublicSite(siteId: string) {
  return prisma.siteProject.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      domain: true,
      widgetTheme: true
    }
  });
}

export async function getSiteByHost(host: string) {
  const sites = await prisma.siteProject.findMany({
    where: { domain: { contains: host } },
    select: { id: true, name: true, domain: true, widgetTheme: true }
  });

  return sites.find((site) => {
    try {
      return new URL(site.domain).host.toLowerCase() === host.toLowerCase();
    } catch {
      return false;
    }
  }) ?? null;
}

export async function getAdjacentPublishedArticles(siteId: string, currentArticle: { publishedAt: Date | null; createdAt: Date }) {
  const publishedAt = currentArticle.publishedAt ?? currentArticle.createdAt;

  const [previousArticle, nextArticle] = await Promise.all([
    prisma.article.findFirst({
      where: {
        siteProjectId: siteId,
        status: "PUBLISHED",
        OR: [
          { publishedAt: { lt: publishedAt } },
          {
            publishedAt,
            createdAt: { lt: currentArticle.createdAt }
          }
        ]
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        title: true,
        slug: true
      }
    }),
    prisma.article.findFirst({
      where: {
        siteProjectId: siteId,
        status: "PUBLISHED",
        OR: [
          { publishedAt: { gt: publishedAt } },
          {
            publishedAt,
            createdAt: { gt: currentArticle.createdAt }
          }
        ]
      },
      orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
      select: {
        title: true,
        slug: true
      }
    })
  ]);

  return { previousArticle, nextArticle };
}
