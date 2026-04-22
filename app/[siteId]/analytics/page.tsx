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

const metricCardStyles = [
  "border-line bg-white/90",
  "border-accent/30 bg-accent/10",
  "border-dashed border-line bg-mist/80",
  "border-line bg-white/90",
  "border-line bg-mist/90"
];

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

  const metricCards = [
    { label: "Total Articles", value: articleCounts.total.toString() },
    { label: "Published Articles", value: articleCounts.published.toString() },
    { label: "Draft Articles", value: articleCounts.draft.toString() },
    { label: "Keywords Total", value: keywordCounts.total.toString() },
    { label: "Keywords Used", value: keywordCounts.used.toString() }
  ];

  return (
    <section className="space-y-8">
      <PageHeader
        title="Analytics"
        description={`Track publishing volume, draft inventory, keyword usage, and recent article activity for ${site.name}.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/articles`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              Open Articles
            </Link>
            <Link
              href={`/${siteId}/calendar`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              View Calendar
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metricCards.map((card, index) => (
          <div key={card.label} className={`rounded-3xl border p-6 shadow-panel ${metricCardStyles[index]}`}>
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Recent Activity</h2>
            <p className="mt-1 text-sm text-slate-600">The five most recently updated articles for this site.</p>
          </div>
        </div>

        {recentActivity.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-slate-600">
            No article activity yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-3">
            {recentActivity.map((article) => (
              <Link
                key={article.id}
                href={`/${siteId}/articles/${article.id}`}
                className="flex flex-col gap-2 rounded-2xl border border-line px-4 py-4 transition hover:border-accent hover:bg-mist md:flex-row md:items-center md:justify-between"
              >
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
