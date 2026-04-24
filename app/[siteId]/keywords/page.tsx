import Link from "next/link";

import { CreateKeywordForm } from "@/components/create-keyword-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type KeywordsPageProps = {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<{ page?: string }>;
};

const PAGE_SIZE = 20;

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? "1", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

export default async function KeywordsPage({ params, searchParams }: KeywordsPageProps) {
  const { siteId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedPage = parsePage(resolvedSearchParams?.page);
  const totalKeywords = await prisma.keyword.count({
    where: { siteProjectId: siteId }
  });
  const totalPages = Math.max(1, Math.ceil(totalKeywords / PAGE_SIZE));
  const safeCurrentPage = Math.min(requestedPage, totalPages);
  const skip = (safeCurrentPage - 1) * PAGE_SIZE;

  const keywords = await prisma.keyword.findMany({
    where: { siteProjectId: siteId },
    orderBy: [{ createdAt: "desc" }],
    skip,
    take: PAGE_SIZE,
    select: {
      id: true,
      term: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          articles: true
        }
      },
      articles: {
        orderBy: [{ updatedAt: "desc" }],
        take: 1,
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  const keywordCounts = keywords.reduce(
    (acc, keyword) => {
      acc.total += 1;
      if (keyword.status === "USED") {
        acc.used += 1;
      } else {
        acc.new += 1;
      }
      return acc;
    },
    { total: 0, used: 0, new: 0 }
  );
  const previousPageHref = safeCurrentPage > 1 ? `/${siteId}/keywords?page=${safeCurrentPage - 1}` : null;
  const nextPageHref = safeCurrentPage < totalPages ? `/${siteId}/keywords?page=${safeCurrentPage + 1}` : null;

  return (
    <section className="space-y-8">
      <PageHeader
        title="Keywords"
        description="Track the topics you want to target and attach them to articles as they move through the workflow."
        action={
          <Link
            href={`/${siteId}/articles`}
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Open Articles
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">Total Keywords</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{totalKeywords}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">New</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{keywordCounts.new}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">Used</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{keywordCounts.used}</p>
        </div>
      </div>

      <CreateKeywordForm siteId={siteId} />

      <div className="rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Keywords</h2>
            <p className="mt-1 text-sm text-slate-600">
              Add keywords here, then assign them from the Articles screen while editing or reviewing drafts.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Page {safeCurrentPage} of {totalPages}
          </p>
        </div>
        {keywords.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6">
            <p className="text-sm text-slate-600">
              No keywords yet. You can add them manually here, or generate an article first and let AI suggest site
              keywords for you to review and assign one by one.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link href={`/${siteId}/articles`} className="text-sm font-semibold text-accent hover:underline">
                Generate your first article
              </Link>
              <span className="text-sm text-slate-500">AI-generated keywords will appear after article generation.</span>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {keywords.map((keyword) => (
              <div key={keyword.id} className="rounded-2xl border border-line bg-white px-4 py-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_auto] md:items-center">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink">{keyword.term}</p>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          keyword.status === "USED"
                            ? "bg-accent/10 text-accent"
                            : "border border-dashed border-line bg-white text-slate-600"
                        }`}
                      >
                        {keyword.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <p>Created {new Date(keyword.createdAt).toLocaleDateString()}</p>
                      <p>
                        {keyword._count.articles > 0
                          ? `${keyword._count.articles} linked ${keyword._count.articles === 1 ? "article" : "articles"}`
                          : "Not linked yet"}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">
                      {keyword.articles[0]?.title ? `Latest linked article: ${keyword.articles[0].title}` : "Assign this keyword from the Articles screen."}
                    </p>
                  </div>
                  <div className="flex items-center justify-start md:justify-end">
                    <Link
                      href={`/${siteId}/articles`}
                      className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                    >
                      Open Articles
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {keywords.length > 0 ? (
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
