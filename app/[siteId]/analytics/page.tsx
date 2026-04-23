import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { AnalyticsRouteParamsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  params: Promise<{ siteId: string }>;
};

function formatUpdatedAt(date: Date) {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const parsedParams = AnalyticsRouteParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    notFound();
  }

  const { siteId } = parsedParams.data;
  const [site, articleMetrics, keywordMetrics, recentActivity] = await Promise.all([
    prisma.siteProject.findUnique({
      where: { id: siteId },
      select: { id: true, name: true }
    }),
    prisma.article.groupBy({
      by: ["status"],
      where: { siteProjectId: siteId },
      _count: { id: true }
    }),
    prisma.keyword.groupBy({
      by: ["status"],
      where: { siteProjectId: siteId },
      _count: { id: true }
    }),
    prisma.article.findMany({
      where: { siteProjectId: siteId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true
      }
    })
  ]);

  if (!site) {
    notFound();
  }

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

  const keywordCounts = keywordMetrics.reduce(
    (acc, metric) => {
      acc.total += metric._count.id;
      if (metric.status === "USED") {
        acc.used = metric._count.id;
      }
      return acc;
    },
    { total: 0, used: 0 }
  );

  const internalMetrics = [
    { label: "Total Articles", value: articleCounts.total.toString(), detail: "All drafts and published articles" },
    { label: "Published Articles", value: articleCounts.published.toString(), detail: "Live on the public blog" },
    { label: "Draft Articles", value: articleCounts.draft.toString(), detail: "Still being edited or reviewed" },
    { label: "Total Keywords", value: keywordCounts.total.toString(), detail: "Tracked keyword records for this site" },
    { label: "Used Keywords", value: keywordCounts.used.toString(), detail: "Keywords currently attached to articles" }
  ];

  return (
    <section className="space-y-8">
      <PageHeader
        title="Analytics"
        description={`Track real internal publishing metrics for ${site.name} and prepare the workspace for later Search Console integration.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/articles`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              Open Articles
            </Link>
            <Link
              href={`/${siteId}/keywords`}
              className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open Keywords
            </Link>
          </div>
        }
      />

      <section className="rounded-[2rem] border border-accent/20 bg-[linear-gradient(135deg,rgba(15,118,110,0.16),rgba(255,255,255,0.96)_45%,rgba(180,83,9,0.08))] p-6 shadow-panel">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Search Console</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Connect Google Search Console to unlock real SEO performance data.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Impressions, clicks, click-through rate, average position, and top queries should only be shown once a
              real Search Console connection exists. This page now stays honest and shows internal publishing metrics
              until that integration is available.
            </p>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4 lg:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Integration Status</p>
            <p className="mt-2 text-2xl font-semibold text-ink">Not connected</p>
            <p className="mt-2 text-sm text-slate-600">
              Future integration should populate impressions, clicks, CTR, average position, and top query reporting.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex cursor-not-allowed items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-400"
            >
              Connect Google Search Console
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {internalMetrics.map((metric) => (
          <div key={metric.label} className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{metric.value}</p>
            <p className="mt-2 text-sm text-slate-600">{metric.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">What Will Unlock Later</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Search analytics will appear here once connected.</h2>
              <p className="mt-2 text-sm text-slate-600">
                The future Search Console integration should provide verified search performance instead of placeholders.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-dashed border-line bg-mist/70 px-4 py-4">
              <p className="font-semibold text-ink">Impressions</p>
              <p className="mt-1 text-sm text-slate-600">Requires Search Console property data.</p>
            </div>
            <div className="rounded-2xl border border-dashed border-line bg-mist/70 px-4 py-4">
              <p className="font-semibold text-ink">Clicks</p>
              <p className="mt-1 text-sm text-slate-600">Requires Search Console property data.</p>
            </div>
            <div className="rounded-2xl border border-dashed border-line bg-mist/70 px-4 py-4">
              <p className="font-semibold text-ink">CTR</p>
              <p className="mt-1 text-sm text-slate-600">Derived from real impressions and clicks.</p>
            </div>
            <div className="rounded-2xl border border-dashed border-line bg-mist/70 px-4 py-4">
              <p className="font-semibold text-ink">Average position</p>
              <p className="mt-1 text-sm text-slate-600">Requires query-level search ranking data.</p>
            </div>
            <div className="rounded-2xl border border-dashed border-line bg-mist/70 px-4 py-4 md:col-span-2">
              <p className="font-semibold text-ink">Top queries</p>
              <p className="mt-1 text-sm text-slate-600">
                Once connected, this section should show real top search queries instead of estimated keywords.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Recent Activity</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Editorial movement</h2>
            <p className="mt-2 text-sm text-slate-600">The most recent article updates for this site.</p>
          </div>

          {recentActivity.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-slate-600">
              No article activity yet.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {recentActivity.map((article) => (
                <Link
                  key={article.id}
                  href={`/${siteId}/articles/${article.id}`}
                  className="block rounded-2xl border border-line px-4 py-4 transition hover:border-accent hover:bg-mist"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-ink">{article.title}</p>
                      <p className="mt-1 text-sm text-slate-600">Updated {formatUpdatedAt(article.updatedAt)}</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        article.status === "PUBLISHED"
                          ? "bg-accent/10 text-accent"
                          : "border border-dashed border-line bg-white text-slate-600"
                      }`}
                    >
                      {article.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
