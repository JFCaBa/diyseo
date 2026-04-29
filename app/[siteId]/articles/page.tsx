import { ArticleDeleteButton } from "@/components/article-delete-button";
import { ArticleGenerationForm } from "@/components/article-generation-form";
import { ArticleKeywordAssignment } from "@/components/article-keyword-assignment";
import { ArticleStatusToggle } from "@/components/article-status-toggle";
import { PageHeader } from "@/components/page-header";
import { getCoverImageProxyPath } from "@/lib/cover-image-url";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ArticlesPageProps = {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<{ page?: string }>;
};

const PAGE_SIZE = 10;

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? "1", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export default async function ArticlesPage({ params, searchParams }: ArticlesPageProps) {
  const { siteId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedPage = parsePage(resolvedSearchParams?.page);
  const totalArticles = await prisma.article.count({
    where: { siteProjectId: siteId }
  });
  const totalPages = Math.max(1, Math.ceil(totalArticles / PAGE_SIZE));
  const safeCurrentPage = Math.min(requestedPage, totalPages);
  const skip = (safeCurrentPage - 1) * PAGE_SIZE;

  const [articles, keywords, articleMetrics] = await Promise.all([
    prisma.article.findMany({
      where: { siteProjectId: siteId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImageUrl: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        keywordId: true,
        keyword: {
          select: {
            term: true
          }
        }
      },
      skip,
      take: PAGE_SIZE
    }),
    prisma.keyword.findMany({
      where: { siteProjectId: siteId },
      orderBy: [{ term: "asc" }],
      select: {
        id: true,
        term: true
      }
    }),
    prisma.article.groupBy({
      by: ["status"],
      where: { siteProjectId: siteId },
      _count: { id: true }
    })
  ]);

  const articleCounts = articleMetrics.reduce(
    (acc, metric) => {
      acc.total += metric._count.id;
      if (metric.status === "PUBLISHED") {
        acc.published = metric._count.id;
      }
      if (metric.status === "DRAFT") {
        acc.draft = metric._count.id;
      }
      return acc;
    },
    { total: 0, published: 0, draft: 0 }
  );

  const previousPageHref = safeCurrentPage > 1 ? `/${siteId}/articles?page=${safeCurrentPage - 1}` : null;
  const nextPageHref = safeCurrentPage < totalPages ? `/${siteId}/articles?page=${safeCurrentPage + 1}` : null;

  return (
    <section className="space-y-8">
      <PageHeader
        title="Articles"
        description="Create, generate, edit, schedule, and publish articles without leaving the content workspace."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/calendar`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              Open Calendar
            </Link>
            <Link
              href={`/${siteId}/articles/new`}
              className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              New Article
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">Total Articles</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{articleCounts.total}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">Published</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{articleCounts.published}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">Available Keywords</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{keywords.length}</p>
        </div>
      </div>

      <ArticleGenerationForm siteId={siteId} />

      <div className="rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Articles</h2>
            <p className="mt-1 text-sm text-slate-600">
              Published articles appear on the public blog automatically. Drafts stay private until you publish them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm text-slate-500">
              Page {safeCurrentPage} of {totalPages}
            </p>
            <Link href={`/${siteId}/keywords`} className="text-sm font-semibold text-accent hover:underline">
              Manage keywords
            </Link>
          </div>
        </div>
        {articles.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6">
            <p className="text-sm text-slate-600">
              No articles yet. Generate your first article from Brand DNA to kick off the workflow, then publish it when
              it is ready.
            </p>
            <Link
              href={`/${siteId}/articles#generate-article`}
              className="mt-4 inline-flex text-sm font-semibold text-accent hover:underline"
            >
              Generate your first article
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {articles.map((article) => (
              <div key={article.id} className="rounded-2xl border border-line bg-white px-4 py-4">
                <div className="grid gap-4 lg:grid-cols-[110px_minmax(0,1fr)_auto] lg:items-start">
                  <div className="lg:w-[110px]">
                    {article.coverImageUrl ? (
                      <img
                        src={getCoverImageProxyPath(article.coverImageUrl)}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-24 w-full rounded-2xl border border-line object-cover"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-line bg-mist/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-ink">{article.title}</p>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            article.status === "PUBLISHED"
                              ? "bg-accent/10 text-accent"
                              : "border border-dashed border-line bg-white text-slate-600"
                          }`}
                        >
                          {article.status === "PUBLISHED" ? "Published" : "Draft"}
                        </span>
                        {article.keyword ? (
                          <span className="inline-flex rounded-full bg-mist px-3 py-1 text-xs font-semibold text-accent">
                            {article.keyword.term}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-slate-500">{article.slug}</p>
                      <p className="line-clamp-2 text-sm leading-6 text-slate-600">
                        {article.excerpt?.trim() ? article.excerpt : "No excerpt yet. Open the article to add summary copy."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <p>Created {new Date(article.createdAt).toLocaleDateString()}</p>
                      {article.publishedAt ? <p>Published {new Date(article.publishedAt).toLocaleDateString()}</p> : null}
                    </div>

                    <div className="rounded-2xl bg-mist/60 px-3 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Keyword assignment</p>
                      <ArticleKeywordAssignment
                        articleId={article.id}
                        currentKeywordId={article.keywordId}
                        siteId={siteId}
                        keywords={keywords}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 lg:items-end">
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Link
                        href={`/${siteId}/articles/${article.id}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                      >
                        Edit
                      </Link>
                      {article.status === "PUBLISHED" ? (
                        <Link
                          href={`/${siteId}/preview?slug=${encodeURIComponent(article.slug)}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                        >
                          View Public
                        </Link>
                      ) : null}
                      <ArticleDeleteButton articleId={article.id} articleTitle={article.title} siteId={siteId} />
                    </div>
                    <ArticleStatusToggle articleId={article.id} siteId={siteId} status={article.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {articles.length > 0 ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              Page {safeCurrentPage} of {totalPages}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {previousPageHref ? (
                <Link
                  href={previousPageHref}
                  className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                >
                  Previous
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-slate-300">
                  Previous
                </span>
              )}
              {nextPageHref ? (
                <Link
                  href={nextPageHref}
                  className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                >
                  Next
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-slate-300">
                  Next
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
