import { prisma } from "@/lib/prisma";

export const publicArticleSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  contentHtml: true,
  seoTitle: true,
  seoDescription: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  siteProjectId: true,
  siteProject: {
    select: {
      name: true
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

export async function getPublicSite(siteId: string) {
  return prisma.siteProject.findUnique({
    where: { id: siteId },
    select: {
      id: true,
      name: true,
      domain: true
    }
  });
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
