import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { WidgetInstallCard } from "@/components/widget-install-card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  params: Promise<{ siteId: string }>;
};

type OnboardingStep = {
  completed: boolean;
  ctaHref: string;
  ctaLabel: string;
  description: string;
  title: string;
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
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  const onboardingSteps: OnboardingStep[] = [
    {
      title: "1. Generate your first article",
      description: "Create a draft from Brand DNA so the site has content to edit and publish.",
      completed: articleCounts.total > 0,
      ctaLabel: "Generate article",
      ctaHref: `/${siteId}/articles`
    },
    {
      title: "2. Publish it",
      description: "Move at least one draft live so the public blog and widget have something to show.",
      completed: articleCounts.published > 0,
      ctaLabel: "View articles",
      ctaHref: `/${siteId}/articles`
    },
    {
      title: "3. Embed on your website",
      description: "Copy the widget snippet and place it on your site once an article is published.",
      completed: Boolean(site.widgetInstalledAt),
      ctaLabel: "Install widget",
      ctaHref: "#install-widget"
    }
  ];

  const completedOnboardingSteps = onboardingSteps.filter((step) => step.completed).length;
  const nextStep = onboardingSteps.find((step) => !step.completed) ?? onboardingSteps[onboardingSteps.length - 1];

  return (
    <section className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Manage ${site.name} from one place: keep Brand DNA current, move articles from draft to published, and make installation obvious for first-time users.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/brand-dna`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              Edit Brand DNA
            </Link>
            <Link
              href={`/${siteId}/articles`}
              className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Generate article
            </Link>
          </div>
        }
      />

      <section className="rounded-[2rem] border border-accent/20 bg-[linear-gradient(135deg,rgba(15,118,110,0.16),rgba(255,255,255,0.94)_42%,rgba(180,83,9,0.08))] p-6 shadow-panel">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Onboarding</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Launch your first content loop</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Start with a generated article, publish one piece, then install the widget. The rest of the workflow can
              stay manual and lightweight for now.
            </p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {completedOnboardingSteps}/{onboardingSteps.length}
            </p>
            <p className="mt-1 text-sm text-slate-600">Current focus: {nextStep.title.replace(/^\d+\.\s*/, "")}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {onboardingSteps.map((step) => (
            <div key={step.title} className="rounded-3xl border border-white/70 bg-white/85 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                      step.completed ? "bg-accent text-white" : "border border-line bg-white text-slate-500"
                    }`}
                  >
                    {step.completed ? "✓" : ""}
                  </span>
                  <p className="font-semibold text-ink">{step.title}</p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{step.description}</p>
              <Link href={step.ctaHref} className="mt-4 inline-flex text-sm font-semibold text-accent hover:underline">
                {step.ctaLabel}
              </Link>
            </div>
          ))}
        </div>
      </section>

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
          <p className="mt-3 text-xl font-semibold text-ink">{nextStep.title.replace(/^\d+\.\s*/, "")}</p>
          <Link href={nextStep.ctaHref} className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline">
            {nextStep.ctaLabel}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Publishing Overview</h2>
              <p className="mt-1 text-sm text-slate-600">
                Move between writing, scheduling, publishing, and installation without losing context.
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
              No content yet. Start with Brand DNA, then generate your first article from the Articles screen.
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

      <div className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Install Widget</h2>
            <p className="mt-1 text-sm text-slate-600">
              The embed snippet is ready now. Copy it once you have at least one published article.
            </p>
          </div>
          <Link href="#install-widget" className="inline-flex text-sm font-semibold text-accent hover:underline">
            Jump to snippet
          </Link>
        </div>
      </div>

      <WidgetInstallCard
        id="install-widget"
        baseUrl={appBaseUrl.replace(/\/$/, "")}
        siteId={siteId}
        initialTheme={site.widgetTheme === "dark" ? "dark" : "light"}
        widgetInstalledAt={site.widgetInstalledAt ? site.widgetInstalledAt.toISOString() : null}
      />
    </section>
  );
}
