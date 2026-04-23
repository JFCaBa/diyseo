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

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildMiniBars(total: number, filled: number) {
  return Array.from({ length: total }, (_, index) => index < filled);
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const parsedParams = AnalyticsRouteParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    notFound();
  }

  const { siteId } = parsedParams.data;
  const [site, articleMetrics, keywordMetrics, recentActivity, topKeywords] = await Promise.all([
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
      take: 4,
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true
      }
    }),
    prisma.keyword.findMany({
      where: { siteProjectId: siteId },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 6,
      select: {
        id: true,
        term: true,
        status: true,
        updatedAt: true,
        _count: {
          select: {
            articles: true
          }
        }
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

  const visitors = Math.max(180, articleCounts.published * 640 + articleCounts.draft * 120 + keywordCounts.used * 55);
  const impressions = Math.max(900, visitors * 7 + keywordCounts.total * 45);
  const clickRate = clamp((articleCounts.published * 1.3 + keywordCounts.used * 0.55 + 1.8) / 1.6, 1.8, 9.8);
  const averagePosition = clamp(29 - articleCounts.published * 2.2 - keywordCounts.used * 1.1, 4.2, 28.5);
  const impactScore = clamp(articleCounts.published * 18 + keywordCounts.used * 11 + articleCounts.draft * 4 + 12, 12, 99);
  const visibilityLift = clamp(articleCounts.published * 6 + keywordCounts.total * 1.8 + 8, 8, 84);
  const publishingVelocity = clamp(articleCounts.total * 9 + keywordCounts.used * 5 + 14, 14, 96);
  const keywordCoverage = keywordCounts.total > 0 ? Math.round((keywordCounts.used / keywordCounts.total) * 100) : 0;
  const periodLabel = "Last 30 days";

  const keywordRows =
    topKeywords.length > 0
      ? topKeywords.map((keyword, index) => {
          const estimatedImpressions = Math.max(120, 240 + (topKeywords.length - index) * 155 + keyword._count.articles * 60);
          const estimatedClicks = Math.max(8, Math.round(estimatedImpressions * (clickRate / 100) * (1 - index * 0.08)));
          const estimatedPosition = clamp(averagePosition - index * 1.4 + (keyword.status === "USED" ? -1.8 : 1.2), 3.8, 28.9);

          return {
            id: keyword.id,
            term: keyword.term,
            status: keyword.status,
            articlesCount: keyword._count.articles,
            impressions: estimatedImpressions,
            clicks: estimatedClicks,
            position: estimatedPosition,
            updatedAt: keyword.updatedAt
          };
        })
      : [
          {
            id: "placeholder-1",
            term: "content strategy",
            status: "NEW",
            articlesCount: 0,
            impressions: 420,
            clicks: 19,
            position: 18.4,
            updatedAt: new Date()
          },
          {
            id: "placeholder-2",
            term: "seo growth plan",
            status: "USED",
            articlesCount: 1,
            impressions: 388,
            clicks: 17,
            position: 16.7,
            updatedAt: new Date()
          },
          {
            id: "placeholder-3",
            term: "brand content ops",
            status: "NEW",
            articlesCount: 0,
            impressions: 316,
            clicks: 12,
            position: 19.9,
            updatedAt: new Date()
          }
        ];

  const visitorBars = buildMiniBars(12, Math.max(3, Math.min(11, Math.round(visitors / 500))));
  const impactBars = buildMiniBars(10, Math.max(2, Math.round(impactScore / 10)));
  const impressionBars = buildMiniBars(8, Math.max(2, Math.min(8, Math.round(impressions / 1800))));
  const ctrBars = buildMiniBars(8, Math.max(2, Math.min(8, Math.round(clickRate))));
  const positionBars = buildMiniBars(8, Math.max(2, 8 - Math.round((averagePosition - 3) / 4)));

  return (
    <section className="space-y-8">
      <PageHeader
        title="Analytics"
        description={`A clean performance snapshot for ${site.name}, mixing live publishing data with lightweight search-style demo metrics until deeper tracking lands.`}
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

      <div className="relative overflow-hidden rounded-[2rem] border border-accent/20 bg-[linear-gradient(135deg,rgba(15,118,110,0.18),rgba(255,255,255,0.92)_45%,rgba(180,83,9,0.08))] p-6 shadow-panel">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Growth Snapshot</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Organic momentum is building across your content engine.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Published content, keyword usage, and editorial activity are being translated into a presentation layer that feels like a real SaaS dashboard now, while deeper traffic instrumentation catches up.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{periodLabel}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">+{visibilityLift}%</p>
              <p className="mt-1 text-xs text-slate-600">Visibility lift</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Keyword Coverage</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{keywordCoverage}%</p>
              <p className="mt-1 text-xs text-slate-600">Tracked keywords in use</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publishing Velocity</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{publishingVelocity}</p>
              <p className="mt-1 text-xs text-slate-600">Composite content score</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Impact</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{impactScore}/100</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                A blended score based on live publishing activity, keyword adoption, and content inventory. It is derived for dashboard presentation, not from external analytics providers.
              </p>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Derived signal</span>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-mist px-4 py-4">
              <p className="text-sm text-slate-500">Published articles</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{articleCounts.published}</p>
            </div>
            <div className="rounded-2xl bg-mist px-4 py-4">
              <p className="text-sm text-slate-500">Tracked keywords</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{keywordCounts.total}</p>
            </div>
            <div className="rounded-2xl bg-mist px-4 py-4">
              <p className="text-sm text-slate-500">Keywords assigned</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{keywordCounts.used}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex items-end justify-between">
                <p className="text-sm font-medium text-ink">Impact progression</p>
                <p className="text-xs text-slate-500">Seeded visual</p>
              </div>
              <div className="mt-4 flex h-40 items-end gap-2 rounded-3xl bg-[linear-gradient(180deg,rgba(15,118,110,0.08),rgba(255,255,255,0))] px-4 pb-4 pt-10">
                {impactBars.map((active, index) => (
                  <div
                    key={`impact-${index}`}
                    className={`flex-1 rounded-t-2xl ${active ? "bg-accent" : "bg-slate-200"}`}
                    style={{ height: `${28 + index * 7}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-line px-4 py-4">
                <p className="text-sm text-slate-500">Draft inventory</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{articleCounts.draft}</p>
                <p className="mt-1 text-xs text-slate-500">Lower this by editing and publishing more drafts.</p>
              </div>
              <div className="rounded-2xl border border-line px-4 py-4">
                <p className="text-sm text-slate-500">Topline takeaway</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {articleCounts.published > 0
                    ? "The site has enough published inventory to present credible search-style growth metrics."
                    : "The dashboard is using seeded analytics because publishing volume is still low."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-line bg-[#0f172a] p-6 text-white shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">Visitors</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight">{formatCompactNumber(visitors)}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Estimated session volume based on live content activity and keyword coverage. This is a demo analytic until visitor tracking is implemented.
              </p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">Seeded analytics</span>
          </div>

          <div className="mt-8 flex h-52 items-end gap-2 rounded-[1.5rem] bg-white/5 px-4 pb-4 pt-10">
            {visitorBars.map((active, index) => (
              <div
                key={`visitors-${index}`}
                className={`flex-1 rounded-t-[1rem] ${active ? "bg-emerald-400" : "bg-white/10"}`}
                style={{ height: `${22 + ((index % 6) + 2) * 9}%` }}
              />
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/6 px-4 py-4">
              <p className="text-sm text-slate-300">Published share</p>
              <p className="mt-2 text-2xl font-semibold">
                {articleCounts.total > 0 ? Math.round((articleCounts.published / articleCounts.total) * 100) : 0}%
              </p>
            </div>
            <div className="rounded-2xl bg-white/6 px-4 py-4">
              <p className="text-sm text-slate-300">Active keywords</p>
              <p className="mt-2 text-2xl font-semibold">{keywordCounts.used}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-line bg-white/90 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Impressions</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{formatCompactNumber(impressions)}</p>
            </div>
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-slate-600">{periodLabel}</span>
          </div>
          <div className="mt-5 flex h-20 items-end gap-2">
            {impressionBars.map((active, index) => (
              <div
                key={`impression-${index}`}
                className={`flex-1 rounded-t-xl ${active ? "bg-amber-500" : "bg-slate-200"}`}
                style={{ height: `${35 + index * 8}%` }}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">Derived from publishing activity and keyword inventory.</p>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-white/90 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Click Rate</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{formatPercent(clickRate)}</p>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">Demo</span>
          </div>
          <div className="mt-5 flex h-20 items-end gap-2">
            {ctrBars.map((active, index) => (
              <div
                key={`ctr-${index}`}
                className={`flex-1 rounded-t-xl ${active ? "bg-accent" : "bg-slate-200"}`}
                style={{ height: `${30 + ((index % 4) + 2) * 10}%` }}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">Presented as a seeded search-performance metric until real clicks exist.</p>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-white/90 p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Avg. Position</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{averagePosition.toFixed(1)}</p>
            </div>
            <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-slate-600">Lower is better</span>
          </div>
          <div className="mt-5 flex h-20 items-end gap-2">
            {positionBars.map((active, index) => (
              <div
                key={`position-${index}`}
                className={`flex-1 rounded-t-xl ${active ? "bg-slate-900" : "bg-slate-200"}`}
                style={{ height: `${25 + (8 - index) * 8}%` }}
              />
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">Estimated from inventory quality and keyword adoption.</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Top Keywords</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Best opportunities right now</h2>
              <p className="mt-2 text-sm text-slate-600">
                Terms come from real site keywords. Impression, click, and position columns are seeded presentation values until search console style data exists.
              </p>
            </div>
            <Link href={`/${siteId}/keywords`} className="text-sm font-semibold text-accent hover:underline">
              Manage keywords
            </Link>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-line">
            <div className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.9fr] gap-3 bg-mist px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <p>Keyword</p>
              <p>Impressions</p>
              <p>Clicks</p>
              <p>Position</p>
              <p>Status</p>
            </div>
            <div className="divide-y divide-line">
              {keywordRows.map((keyword) => (
                <div
                  key={keyword.id}
                  className="grid grid-cols-[1.6fr_0.8fr_0.8fr_0.8fr_0.9fr] gap-3 px-4 py-4 text-sm text-slate-700"
                >
                  <div>
                    <p className="font-semibold text-ink">{keyword.term}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {keyword.articlesCount > 0 ? `${keyword.articlesCount} linked article` : "Not linked yet"} • Updated{" "}
                      {formatUpdatedAt(keyword.updatedAt)}
                    </p>
                  </div>
                  <p>{formatCompactNumber(keyword.impressions)}</p>
                  <p>{formatCompactNumber(keyword.clicks)}</p>
                  <p>{keyword.position.toFixed(1)}</p>
                  <div>
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
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Recent Activity</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Editorial movement</h2>
            <p className="mt-2 text-sm text-slate-600">The most recent article updates feeding this dashboard.</p>
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
        </div>
      </div>
    </section>
  );
}
