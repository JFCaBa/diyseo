import Link from "next/link";

import { CreateKeywordForm } from "@/components/create-keyword-form";
import { PageHeader } from "@/components/page-header";
import { getT, getUiLocale } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { requireSitePage } from "@/lib/workspace-context";

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
  await requireSitePage(siteId);
  const t = await getT();
  const locale = await getUiLocale();
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
        title={t("keywords.title")}
        description={t("keywords.description")}
        action={
          <Link
            href={`/${siteId}/articles`}
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            {t("keywords.openArticles")}
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">{t("keywords.totalKeywords")}</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{totalKeywords}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">{t("keywords.statusNew")}</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{keywordCounts.new}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">{t("keywords.statusUsed")}</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{keywordCounts.used}</p>
        </div>
      </div>

      <CreateKeywordForm siteId={siteId} />

      <div className="rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">{t("keywords.listTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("keywords.listDescription")}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {t("keywords.pageOf", { page: safeCurrentPage, total: totalPages })}
          </p>
        </div>
        {keywords.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6">
            <p className="text-sm text-slate-600">
              {t("keywords.emptyBody")}
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link href={`/${siteId}/articles`} className="text-sm font-semibold text-accent hover:underline">
                {t("keywords.generateFirst")}
              </Link>
              <span className="text-sm text-slate-500">{t("keywords.emptyHint")}</span>
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
                        {keyword.status === "USED" ? t("keywords.badgeUsed") : t("keywords.badgeNew")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      <p>{t("keywords.created", { date: formatDate(keyword.createdAt, locale, {}) })}</p>
                      <p>
                        {keyword._count.articles > 0
                          ? t(keyword._count.articles === 1 ? "keywords.linkedOne" : "keywords.linkedOther", { count: keyword._count.articles })
                          : t("keywords.notLinked")}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">
                      {keyword.articles[0]?.title ? t("keywords.latestLinked", { title: keyword.articles[0].title }) : t("keywords.assignHint")}
                    </p>
                  </div>
                  <div className="flex items-center justify-start md:justify-end">
                    <Link
                      href={`/${siteId}/articles`}
                      className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                    >
                      {t("keywords.openArticles")}
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
              {t("keywords.pageOf", { page: safeCurrentPage, total: totalPages })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {previousPageHref ? (
                <Link
                  href={previousPageHref}
                  className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                >
                  {t("keywords.previous")}
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-slate-300">
                  {t("keywords.previous")}
                </span>
              )}
              {nextPageHref ? (
                <Link
                  href={nextPageHref}
                  className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
                >
                  {t("keywords.next")}
                </Link>
              ) : (
                <span className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-slate-300">
                  {t("keywords.next")}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
