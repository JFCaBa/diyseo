import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { WidgetInstallCard } from "@/components/widget-install-card";
import { exportFingerprint, hasChangesSinceExport } from "@/lib/install-methods/export-status";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireSitePage } from "@/lib/workspace-context";

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
  const t = await getT();
  await requireSitePage(siteId);
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

  const updatedSinceExportCount = site.staticExportedAt
    ? await prisma.article.count({
        where: { siteProjectId: siteId, status: "PUBLISHED", updatedAt: { gt: site.staticExportedAt } }
      })
    : 0;
  const changedSinceExport = hasChangesSinceExport({
    exportedAt: site.staticExportedAt,
    exportedCount: site.staticExportedCount,
    publishedCount: articleCounts.published,
    updatedSinceCount: updatedSinceExportCount,
    exportedFingerprint: site.staticExportedFingerprint,
    currentFingerprint: exportFingerprint(site)
  });

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
      title: t("dashboard.step1Title"),
      description: t("dashboard.step1Description"),
      completed: articleCounts.total > 0,
      ctaLabel: t("dashboard.step1Cta"),
      ctaHref: `/${siteId}/articles`
    },
    {
      title: t("dashboard.step2Title"),
      description: t("dashboard.step2Description"),
      completed: articleCounts.published > 0,
      ctaLabel: t("dashboard.step2Cta"),
      ctaHref: `/${siteId}/articles`
    },
    {
      title: t("dashboard.step3Title"),
      description: t("dashboard.step3Description"),
      completed: Boolean(site.widgetInstalledAt),
      ctaLabel: t("dashboard.step3Cta"),
      ctaHref: "#install-widget"
    }
  ];

  const completedOnboardingSteps = onboardingSteps.filter((step) => step.completed).length;
  const nextStep = onboardingSteps.find((step) => !step.completed) ?? onboardingSteps[onboardingSteps.length - 1];

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description", { name: site.name })}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/brand-dna`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              {t("dashboard.editBrandDna")}
            </Link>
            <Link
              href={`/${siteId}/articles`}
              className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {t("dashboard.generateArticle")}
            </Link>
          </div>
        }
      />

      <section className="rounded-[2rem] border border-accent/20 bg-[linear-gradient(135deg,rgba(15,118,110,0.16),rgba(255,255,255,0.94)_42%,rgba(180,83,9,0.08))] p-6 shadow-panel">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("dashboard.onboarding")}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{t("dashboard.launchTitle")}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {t("dashboard.launchBody")}
            </p>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("dashboard.completed")}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {completedOnboardingSteps}/{onboardingSteps.length}
            </p>
            <p className="mt-1 text-sm text-slate-600">{t("dashboard.currentFocus", { step: nextStep.title })}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {onboardingSteps.map((step, index) => (
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
                  <p className="font-semibold text-ink">{`${index + 1}. ${step.title}`}</p>
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
          <p className="text-sm text-slate-500">{t("dashboard.publishedArticles")}</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{articleCounts.published}</p>
          <p className="mt-2 text-sm text-slate-600">{t(articleCounts.draft === 1 ? "dashboard.draftsInProgressOne" : "dashboard.draftsInProgressOther", { count: articleCounts.draft })}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <p className="text-sm text-slate-500">{t("dashboard.brandCoverage")}</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{brandCompletion}%</p>
          <p className="mt-2 text-sm text-slate-600">{t("dashboard.fieldsFilled", { count: completedBrandFields })}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <p className="text-sm text-slate-500">{t("dashboard.keywords")}</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{keywordCounts.total}</p>
          <p className="mt-2 text-sm text-slate-600">{t(keywordCounts.used === 1 ? "dashboard.assignedOne" : "dashboard.assignedOther", { count: keywordCounts.used })}</p>
        </div>
        <div className="rounded-3xl border border-accent/30 bg-accent/10 p-6 shadow-panel">
          <p className="text-sm text-slate-500">{t("dashboard.nextBestStep")}</p>
          <p className="mt-3 text-xl font-semibold text-ink">{nextStep.title}</p>
          <Link href={nextStep.ctaHref} className="mt-3 inline-flex text-sm font-semibold text-accent hover:underline">
            {nextStep.ctaLabel}
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">{t("dashboard.publishingOverview")}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {t("dashboard.publishingOverviewBody")}
              </p>
            </div>
            <Link href={`/${siteId}/analytics`} className="text-sm font-semibold text-accent hover:underline">
              {t("dashboard.viewAnalytics")}
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <Link
              href={`/${siteId}/articles`}
              className="rounded-2xl border border-line px-4 py-4 transition hover:border-accent hover:bg-mist"
            >
              <p className="text-sm text-slate-500">{t("dashboard.articles")}</p>
              <p className="mt-2 font-semibold text-ink">{t(articleCounts.total === 1 ? "dashboard.totalArticlesOne" : "dashboard.totalArticlesOther", { count: articleCounts.total })}</p>
            </Link>
            <Link
              href={`/${siteId}/calendar`}
              className="rounded-2xl border border-line px-4 py-4 transition hover:border-accent hover:bg-mist"
            >
              <p className="text-sm text-slate-500">{t("dashboard.calendar")}</p>
              <p className="mt-2 font-semibold text-ink">{t("dashboard.calendarBody")}</p>
            </Link>
            <Link
              href={`/${siteId}/keywords`}
              className="rounded-2xl border border-line px-4 py-4 transition hover:border-accent hover:bg-mist"
            >
              <p className="text-sm text-slate-500">{t("dashboard.keywords")}</p>
              <p className="mt-2 font-semibold text-ink">{t("dashboard.keywordsBody")}</p>
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">{t("dashboard.recentContent")}</h2>
              <p className="mt-1 text-sm text-slate-600">{t("dashboard.recentBody")}</p>
            </div>
            <Link href={`/${siteId}/articles`} className="text-sm font-semibold text-accent hover:underline">
              {t("dashboard.openArticles")}
            </Link>
          </div>

          {recentArticles.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-slate-600">
              {t("dashboard.noContent")}
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
                      {article.status === "PUBLISHED" ? t("dashboard.publishedArticle") : t("dashboard.draftArticle")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-accent">{t("dashboard.edit")}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">{t("dashboard.installWidget")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("dashboard.installWidgetBody")}
            </p>
          </div>
          <Link href="#install-widget" className="inline-flex text-sm font-semibold text-accent hover:underline">
            {t("dashboard.jumpToSnippet")}
          </Link>
        </div>
      </div>

      <WidgetInstallCard
        id="install-widget"
        baseUrl={appBaseUrl.replace(/\/$/, "")}
        siteId={siteId}
        siteDomain={site.domain}
        initialTheme={site.widgetTheme === "dark" ? "dark" : "light"}
        widgetInstalledAt={site.widgetInstalledAt ? site.widgetInstalledAt.toISOString() : null}
        proxyVerifiedAt={site.proxyVerifiedAt ? site.proxyVerifiedAt.toISOString() : null}
        staticExportedAt={site.staticExportedAt ? site.staticExportedAt.toISOString() : null}
        staticExportedCount={site.staticExportedCount}
        changedSinceExport={changedSinceExport}
      />
    </section>
  );
}
