import { ArticleGenerationForm } from "@/components/article-generation-form";
import { ArticleKeywordAssignment } from "@/components/article-keyword-assignment";
import { ArticleStatusToggle } from "@/components/article-status-toggle";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

type ArticlesPageProps = {
  params: Promise<{ siteId: string }>;
};

export default async function ArticlesPage({ params }: ArticlesPageProps) {
  const { siteId } = await params;
  const [articles, keywords, articleMetrics] = await Promise.all([
    prisma.article.findMany({
      where: { siteProjectId: siteId },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
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
      take: 20
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
            <h2 className="text-lg font-semibold text-ink">Recent Articles</h2>
            <p className="mt-1 text-sm text-slate-600">
              Published articles appear on the public blog automatically. Drafts stay private until you publish them.
            </p>
          </div>
          <Link href={`/${siteId}/keywords`} className="text-sm font-semibold text-accent hover:underline">
            Manage keywords
          </Link>
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
              <div key={article.id} className="rounded-2xl border border-line px-4 py-4">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    {article.coverImageUrl ? (
                      <img
                        src={article.coverImageUrl}
                        alt=""
                        className="mb-3 h-32 w-full rounded-2xl border border-line object-cover md:max-w-sm"
                      />
                    ) : null}
                    <p className="font-semibold text-ink">{article.title}</p>
                    <p className="text-sm text-slate-600">{article.slug}</p>
                    {article.keyword ? (
                      <p className="mt-2 inline-flex rounded-full bg-mist px-3 py-1 text-xs font-semibold text-accent">
                        {article.keyword.term}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <div className="text-sm text-slate-600">
                      <p>{article.status === "PUBLISHED" ? "Published" : "Draft"}</p>
                      <p>Created {new Date(article.createdAt).toLocaleDateString()}</p>
                      {article.publishedAt ? <p>Published {new Date(article.publishedAt).toLocaleDateString()}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/${siteId}/articles/${article.id}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                      >
                        Edit
                      </Link>
                      {article.status === "PUBLISHED" ? (
                        <Link
                          href={`/blog/${siteId}/${article.slug}`}
                          className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                        >
                          View Public
                        </Link>
                      ) : null}
                    </div>
                    <ArticleKeywordAssignment
                      articleId={article.id}
                      currentKeywordId={article.keywordId}
                      siteId={siteId}
                      keywords={keywords}
                    />
                    <ArticleStatusToggle articleId={article.id} siteId={siteId} status={article.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
