import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { WidgetInstallCard } from "@/components/widget-install-card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  params: Promise<{ siteId: string }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { siteId } = await params;
  const [site, articleMetrics, keywordMetrics, recentArticles] = await Promise.all([
    prisma.siteProject.findUnique({
      where: { id: siteId },
      include: { brandProfile: true }
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
      orderBy: [{ updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        title: true,
        status: true
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

  const brandProfileValues = [
    site.brandProfile?.contentLanguage,
    site.brandProfile?.businessType,
    site.brandProfile?.brandVoiceTone,
    site.brandProfile?.targetAudience,
    site.brandProfile?.serviceArea,
    site.brandProfile?.topicsToAvoid,
    site.brandProfile?.keyThemes,
    site.brandProfile?.customImageInstructions,
    site.brandProfile?.imageStyle
  ];
  const completedBrandFields = brandProfileValues.filter((value) => value && value.trim().length > 0).length;
  const brandCompletion = Math.round((completedBrandFields / brandProfileValues.length) * 100);

  const nextStepHref =
    completedBrandFields < 4
      ? `/${siteId}/brand-dna`
      : articleCounts.total === 0
        ? `/${siteId}/articles`
        : keywordCounts.total === 0
          ? `/${siteId}/keywords`
          : `/${siteId}/calendar`;
  const nextStepLabel =
    completedBrandFields < 4
      ? "Finish Brand DNA"
      : articleCounts.total === 0
        ? "Create your first article"
        : keywordCounts.total === 0
          ? "Add keywords"
          : "Review the calendar";
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  return (
    <section className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Manage ${site.name} from one place: keep Brand DNA current, move articles from draft to published, and maintain a consistent publishing cadence.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/brand-dna`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              Edit Brand DNA
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <p className="text-sm text-slate-500">Published Articles</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{articleCounts.published}</p>
          <p className="mt-2 text-sm text-slate-600">{articleCounts.draft} drafts still in progress.</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <p className="text-sm text-slate-500">Brand DNA Coverage</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{brandCompletion}%</p>
          <p className="mt-2 text-sm text-slate-600">{completedBrandFields} of 9 fields are filled in.</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <p className="text-sm text-slate-500">Keywords</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{keywordCounts.total}</p>
          <p className="mt-2 text-sm text-slate-600">{keywordCounts.used} already assigned to articles.</p>
        </div>
        <div className="rounded-3xl border border-accent/30 bg-accent/10 p-6 shadow-panel">
          <p className="text-sm text-slate-500">Next Best Step</p>
          <p className="mt-3 text-xl font-semibold text-ink">{nextStepLabel}</p>
          <Link href={nextStepHref} className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline">
            Continue
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Publishing Overview</h2>
              <p className="mt-1 text-sm text-slate-600">
                Move between writing, scheduling, and analytics without losing context.
              </p>
            </div>
            <Link href={`/${siteId}/analytics`} className="text-sm font-semibold text-accent hover:underline">
              View analytics
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Link
              href={`/${siteId}/articles`}
              className="rounded-2xl border border-line px-4 py-4 transition hover:border-accent hover:bg-mist"
            >
              <p className="text-sm text-slate-500">Articles</p>
              <p className="mt-2 font-semibold text-ink">{articleCounts.total} total articles</p>
            </Link>
            <Link
              href={`/${siteId}/calendar`}
              className="rounded-2xl border border-line px-4 py-4 transition hover:border-accent hover:bg-mist"
            >
              <p className="text-sm text-slate-500">Calendar</p>
              <p className="mt-2 font-semibold text-ink">Schedule and reschedule by month</p>
            </Link>
            <Link
              href={`/${siteId}/keywords`}
              className="rounded-2xl border border-line px-4 py-4 transition hover:border-accent hover:bg-mist"
            >
              <p className="text-sm text-slate-500">Keywords</p>
              <p className="mt-2 font-semibold text-ink">Track topics and attach them to content</p>
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Recent Content</h2>
              <p className="mt-1 text-sm text-slate-600">Pick up where you left off.</p>
            </div>
            <Link href={`/${siteId}/articles`} className="text-sm font-semibold text-accent hover:underline">
              Open articles
            </Link>
          </div>

          {recentArticles.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-slate-600">
              No content yet. Start with Brand DNA, then create or generate your first article.
            </p>
          ) : (
            <div className="mt-6 grid gap-3">
              {recentArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/${siteId}/articles/${article.id}`}
                  className="flex items-center justify-between rounded-2xl border border-line px-4 py-4 transition hover:border-accent hover:bg-mist"
                >
                  <div>
                    <p className="font-semibold text-ink">{article.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {article.status === "PUBLISHED" ? "Published article" : "Draft article"}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-accent">Edit</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <WidgetInstallCard baseUrl={appBaseUrl.replace(/\/$/, "")} siteId={siteId} />
    </section>
  );
}
