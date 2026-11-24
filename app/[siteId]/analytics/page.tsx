import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SeoPerformanceSection } from "@/components/seo-performance-section";
import { SearchConsolePropertyPicker } from "@/components/search-console-property-picker";
import { auth, signIn } from "@/lib/auth";
import {
  GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE,
  getSearchConsoleKeywordLookupForUser,
  getSearchConsolePerformanceForUser,
  listSearchConsolePropertiesForUser
} from "@/lib/google-search-console";
import { prisma } from "@/lib/prisma";
import {
  getSearchLocaleByValue,
  getSearchLocaleValue,
  normalizeSearchCountry,
  normalizeSearchLanguage,
  SEARCH_LOCALE_OPTIONS
} from "@/lib/search-locale";
import { runLiveSerpCheck } from "@/lib/serper";
import { getLocalizeMessage, getT, getUiLocale } from "@/lib/i18n/server";
import { formatDate, formatNumber, type T } from "@/lib/i18n/translate";
import type { UiLocale } from "@/lib/i18n/locale";
import { AnalyticsRouteParamsSchema } from "@/lib/validations";
import { requireSitePage } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<{
    changeProperty?: string;
    gscDebug?: string;
    keyword?: string;
    serpCountry?: string;
    serpDeep?: string;
    serpKeyword?: string;
    serpLanguage?: string;
    serpLocale?: string;
  }>;
};

function formatPropertyDomain(propertyUrl: string | null | undefined, t: T) {
  if (!propertyUrl) {
    return t("analytics.noPropertySelected");
  }

  if (propertyUrl.startsWith("sc-domain:")) {
    return propertyUrl.replace(/^sc-domain:/, "");
  }

  try {
    return new URL(propertyUrl).hostname;
  } catch {
    return propertyUrl;
  }
}

const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false } as const;

function formatPercent(value: number, locale: UiLocale) {
  return `${formatNumber(value * 100, locale, ONE_DECIMAL)}%`;
}

function formatPosition(value: number, locale: UiLocale) {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

  return formatNumber(value, locale, ONE_DECIMAL);
}

function formatCompactNumber(value: number, locale: UiLocale) {
  return formatNumber(value, locale, {
    notation: "compact",
    maximumFractionDigits: 1
  });
}

function formatCount(value: number, locale: UiLocale) {
  return formatNumber(value, locale, { useGrouping: false });
}

function formatCheckedAt(value: string, locale: UiLocale) {
  return formatDate(value, locale, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

const LOCALE_LABEL_KEYS = {
  "es-es": "settings.searchLocale.esEs",
  "us-en": "settings.searchLocale.usEn",
  "uk-en": "settings.searchLocale.ukEn",
  "fr-fr": "settings.searchLocale.frFr",
  "de-de": "settings.searchLocale.deDe",
  "it-it": "settings.searchLocale.itIt",
  "pt-pt": "settings.searchLocale.ptPt"
} as const;

/** "Country / Language" label of a search locale option in the active UI language. */
function searchLocaleLabel(t: T, value: keyof typeof LOCALE_LABEL_KEYS) {
  return t(LOCALE_LABEL_KEYS[value]);
}

/** Country and language names in the UI language for the codes of a live SERP result; falls back to the lib labels. */
function serpPlaceLabels(
  t: T,
  check: { countryCode: string; languageCode: string; countryLabel: string; languageLabel: string }
) {
  const country = SEARCH_LOCALE_OPTIONS.find((option) => option.country === check.countryCode);
  const language = SEARCH_LOCALE_OPTIONS.find((option) => option.language === check.languageCode);
  return {
    country: country ? searchLocaleLabel(t, country.value).split(" / ")[0] : check.countryLabel,
    language: language ? searchLocaleLabel(t, language.value).split(" / ")[1] : check.languageLabel
  };
}

export default async function AnalyticsPage({ params, searchParams }: AnalyticsPageProps) {
  const t = await getT();
  const locale = await getUiLocale();
  const localizeMessage = await getLocalizeMessage();
  const parsedParams = AnalyticsRouteParamsSchema.safeParse(await params);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (!parsedParams.success) {
    notFound();
  }

  const { siteId } = parsedParams.data;
  await requireSitePage(siteId);
  const changePropertyRequested = resolvedSearchParams?.changeProperty === "1";
  const gscDebugEnabled = resolvedSearchParams?.gscDebug === "1";
  const searchedKeyword = resolvedSearchParams?.keyword?.trim() ?? "";
  const serpKeyword = resolvedSearchParams?.serpKeyword?.trim() ?? "";
  const serpDeepCheckEnabled = resolvedSearchParams?.serpDeep === "1";
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  const [site, articleMetrics, keywordMetrics] = await Promise.all([
    prisma.siteProject.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        domain: true,
        searchConsolePropertyUrl: true,
        searchConsoleConnectedAt: true,
        defaultSearchCountry: true,
        defaultSearchLanguage: true,
        workspaceId: true
      }
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
    })
  ]);

  if (!site) {
    notFound();
  }

  if (!session.user.workspaceId || site.workspaceId !== session.user.workspaceId) {
    notFound();
  }

  const requestedSerpLocale = resolvedSearchParams?.serpLocale;
  const fallbackSerpLocale = getSearchLocaleValue(site.defaultSearchCountry, site.defaultSearchLanguage);
  const resolvedSerpLocale = getSearchLocaleByValue(requestedSerpLocale ?? fallbackSerpLocale);
  const selectedSerpCountry = normalizeSearchCountry(resolvedSerpLocale.country);
  const selectedSerpLanguage = normalizeSearchLanguage(resolvedSerpLocale.language);
  const selectedSerpLocale = resolvedSerpLocale.value;

  let searchConsoleProperties: Awaited<ReturnType<typeof listSearchConsolePropertiesForUser>> = null;
  let searchConsolePropertiesError: string | null = null;

  try {
    searchConsoleProperties = await listSearchConsolePropertiesForUser(session.user.id, site.domain);
  } catch (error) {
    searchConsolePropertiesError = error instanceof Error ? error.message : t("analytics.unablePropertyLoad");
  }

  const hasSearchConsoleAccess = Boolean(searchConsoleProperties);
  const storedPropertyUrl = site.searchConsolePropertyUrl;
  const selectedProperty = searchConsoleProperties?.find((property) => property.siteUrl === storedPropertyUrl) ?? null;

  let searchConsolePerformance: Awaited<ReturnType<typeof getSearchConsolePerformanceForUser>> = null;
  let searchConsolePerformanceError: string | null = null;
  let searchConsoleKeywordLookup: Awaited<ReturnType<typeof getSearchConsoleKeywordLookupForUser>> = null;
  let searchConsoleKeywordLookupError: string | null = null;
  let liveSerpCheck: Awaited<ReturnType<typeof runLiveSerpCheck>> = null;
  let liveSerpCheckError: string | null = null;

  if (selectedProperty?.siteUrl) {
    try {
      [searchConsolePerformance, searchConsoleKeywordLookup] = await Promise.all([
        getSearchConsolePerformanceForUser(session.user.id, selectedProperty.siteUrl),
        searchedKeyword
          ? getSearchConsoleKeywordLookupForUser(session.user.id, selectedProperty.siteUrl, searchedKeyword)
          : Promise.resolve(null)
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("analytics.unablePerformanceLoad");
      searchConsolePerformanceError = message;
      if (searchedKeyword) {
        searchConsoleKeywordLookupError = message;
      }
    }
  }

  if (serpKeyword) {
    try {
      liveSerpCheck = await runLiveSerpCheck(
        serpKeyword,
        site.domain,
        selectedSerpCountry,
        selectedSerpLanguage,
        serpDeepCheckEnabled
      );
    } catch (error) {
      liveSerpCheckError = error instanceof Error ? error.message : t("analytics.unableSerpCheck");
    }
  }

  if (gscDebugEnabled) {
    console.log(
      JSON.stringify(
        {
          type: "gsc-debug",
          siteId,
          siteDomain: site.domain,
          storedPropertyUrl,
          selectedPropertyUrl: selectedProperty?.siteUrl ?? null,
          searchConsoleStateHint: selectedProperty?.siteUrl ? "query-attempted" : "no-selected-property",
          debug: searchConsolePerformance?.debug ?? null,
          keywordLookup: searchConsoleKeywordLookup,
          keywordLookupError: searchConsoleKeywordLookupError,
          liveSerpCheck,
          liveSerpCheckError,
          serpDeepCheckEnabled,
          serpCountry: selectedSerpCountry,
          serpLanguage: selectedSerpLanguage,
          performanceError: searchConsolePerformanceError,
          propertiesError: searchConsolePropertiesError
        },
        null,
        2
      )
    );
  }

  const serpPlaces = liveSerpCheck ? serpPlaceLabels(t, liveSerpCheck) : null;

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
    { label: t("analytics.totalArticles"), value: formatCount(articleCounts.total, locale), detail: t("analytics.totalArticlesDetail") },
    { label: t("analytics.publishedArticles"), value: formatCount(articleCounts.published, locale), detail: t("analytics.publishedArticlesDetail") },
    { label: t("analytics.draftArticles"), value: formatCount(articleCounts.draft, locale), detail: t("analytics.draftArticlesDetail") },
    { label: t("analytics.totalKeywords"), value: formatCount(keywordCounts.total, locale), detail: t("analytics.totalKeywordsDetail") },
    { label: t("analytics.usedKeywords"), value: formatCount(keywordCounts.used, locale), detail: t("analytics.usedKeywordsDetail") }
  ];

  const hasSearchConsoleData = Boolean(
    searchConsolePerformance &&
      (searchConsolePerformance.clicks > 0 ||
        searchConsolePerformance.impressions > 0 ||
        searchConsolePerformance.topQueries.length > 0 ||
        searchConsolePerformance.overallTrend.some((point) => point.position !== null))
  );

  const searchConsoleState = selectedProperty
    ? searchConsolePerformanceError
      ? "error"
      : hasSearchConsoleData
        ? "connected-with-data"
        : searchConsolePerformance
          ? "connected-no-data"
          : "error"
    : storedPropertyUrl
      ? "reconnect-required"
      : "not-connected";
  const compactSearchConsoleStatus =
    searchConsoleState === "reconnect-required"
      ? t("analytics.statusReconnect")
      : searchConsoleState === "connected-with-data" || searchConsoleState === "connected-no-data"
        ? t("analytics.statusConnected")
        : t("analytics.statusNotConnected");
  const shouldShowPropertySelection =
    hasSearchConsoleAccess && (!selectedProperty || searchConsoleState === "reconnect-required" || changePropertyRequested);
  const propertyDisplayDomain = formatPropertyDomain(selectedProperty?.siteUrl ?? storedPropertyUrl, t);
  const searchConsoleDateRange = searchConsolePerformance
    ? t("analytics.dateRange", { start: searchConsolePerformance.startDate, end: searchConsolePerformance.endDate })
    : t("analytics.last28Days");

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("analytics.title")}
        description={t("analytics.description", { site: site.name })}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/keywords`}
              className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {t("analytics.openKeywords")}
            </Link>
          </div>
        }
      />

      <div>
        {searchConsolePerformance && hasSearchConsoleData ? (
          <SeoPerformanceSection
            startDate={searchConsolePerformance.startDate}
            endDate={searchConsolePerformance.endDate}
            previousStartDate={searchConsolePerformance.previousStartDate}
            previousEndDate={searchConsolePerformance.previousEndDate}
            position={searchConsolePerformance.position}
            previousPosition={searchConsolePerformance.previous.position}
            positionChange={searchConsolePerformance.positionChange}
            keywordRankings={searchConsolePerformance.keywordRankings}
            keywordTrends={searchConsolePerformance.keywordTrends}
            overallTrend={searchConsolePerformance.overallTrend}
          />
        ) : (
          <section className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("analytics.seoEyebrow")}</p>
            <div className="mt-4">
              <EmptyState
                title={
                  searchConsoleState === "reconnect-required"
                    ? t("analytics.emptyReconnectTitle")
                    : searchConsoleState === "error"
                      ? t("analytics.emptyErrorTitle")
                      : searchConsoleState === "connected-no-data"
                        ? t("analytics.emptyNoDataTitle")
                        : t("analytics.emptyConnectTitle")
                }
                description={
                  searchConsoleState === "reconnect-required"
                    ? t("analytics.emptyReconnectDescription")
                    : searchConsoleState === "error"
                      ? t("analytics.emptyErrorDescription")
                      : searchConsoleState === "connected-no-data"
                        ? t("analytics.emptyNoDataDescription")
                        : t("analytics.emptyConnectDescription")
                }
              />
            </div>
          </section>
        )}
      </div>

      <section className="rounded-3xl border border-line bg-white/90 px-5 py-4 shadow-panel">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`inline-flex rounded-full px-3 py-1 font-semibold ${
                searchConsoleState === "connected-with-data" || searchConsoleState === "connected-no-data"
                  ? "bg-accent/10 text-accent"
                  : searchConsoleState === "reconnect-required"
                    ? "bg-amber-100 text-amber-800"
                  : "border border-dashed border-line bg-white text-slate-600"
              }`}
            >
              {compactSearchConsoleStatus}
            </span>
            <span className="text-slate-500">{t("analytics.property")}</span>
            <span className="font-semibold text-ink">{propertyDisplayDomain}</span>
            <span className="text-slate-500">{t("analytics.range")}</span>
            <span className="font-semibold text-ink">{searchConsoleDateRange}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {searchConsolePropertiesError ? <p className="text-red-600">{t("analytics.propertyLoadFailed", { error: localizeMessage(searchConsolePropertiesError) })}</p> : null}
            {searchConsolePerformanceError ? (
              <p className="text-red-600">{t("analytics.performanceLoadFailed", { error: localizeMessage(searchConsolePerformanceError) })}</p>
            ) : null}

            {!hasSearchConsoleAccess ? (
              <form
                action={async () => {
                  "use server";
                  await signIn(
                    "google",
                    { redirectTo: `/${siteId}/analytics` },
                    {
                      scope: `openid email profile ${GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE}`,
                      access_type: "offline",
                      prompt: "consent",
                      include_granted_scopes: "true"
                    }
                  );
                }}
              >
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {t("analytics.connectGoogle")}
                </button>
              </form>
            ) : selectedProperty ? (
              <Link
                href={`/${siteId}/analytics?changeProperty=1`}
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-2.5 font-semibold text-ink transition hover:bg-mist"
              >
                {t("analytics.changeProperty")}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("analytics.lookupEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t("analytics.lookupTitle")}</h2>
          </div>

          <form method="GET" className="w-full max-w-2xl">
            {gscDebugEnabled ? <input type="hidden" name="gscDebug" value="1" /> : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                name="keyword"
                defaultValue={searchedKeyword}
                placeholder={t("analytics.searchPlaceholder")}
                className="min-w-0 flex-1 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-accent"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {t("analytics.search")}
              </button>
            </div>
          </form>
        </div>

        {searchedKeyword ? (
          <div className="mt-5 rounded-[1.5rem] border border-line bg-mist/60 p-5">
            {searchConsoleKeywordLookupError ? (
              <p className="text-sm text-red-600">{t("analytics.lookupFailed", { error: localizeMessage(searchConsoleKeywordLookupError) })}</p>
            ) : searchConsoleKeywordLookup?.found ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t("analytics.lookupResult")}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  <div className="rounded-2xl border border-line bg-white px-4 py-4 md:col-span-2">
                    <p className="text-sm text-slate-500">{t("analytics.keyword")}</p>
                    <p className="mt-2 break-words text-xl font-semibold text-ink">{searchConsoleKeywordLookup.query}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.averagePosition")}</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{formatPosition(searchConsoleKeywordLookup.position, locale)}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.clicks")}</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{formatCompactNumber(searchConsoleKeywordLookup.clicks, locale)}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.impressions")}</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{formatCompactNumber(searchConsoleKeywordLookup.impressions, locale)}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.ctr")}</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{formatPercent(searchConsoleKeywordLookup.ctr, locale)}</p>
                  </div>
                  <div className="flex items-center rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-600">
                    {t("analytics.dateRange", { start: searchConsoleKeywordLookup.startDate, end: searchConsoleKeywordLookup.endDate })}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-700">
                {t("analytics.lookupNone")}
              </p>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("analytics.serpEyebrow")}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t("analytics.serpTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{t("analytics.serpDescription")}</p>
          </div>

          <form method="GET" className="w-full max-w-2xl">
            {gscDebugEnabled ? <input type="hidden" name="gscDebug" value="1" /> : null}
            {searchedKeyword ? <input type="hidden" name="keyword" value={searchedKeyword} /> : null}
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="search"
                name="serpKeyword"
                defaultValue={serpKeyword}
                placeholder={t("analytics.searchPlaceholder")}
                className="min-w-0 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-accent md:min-w-[300px] md:flex-1"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 md:shrink-0"
              >
                Google
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <select
                name="serpLocale"
                defaultValue={selectedSerpLocale}
                className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent md:w-[320px] md:shrink-0"
              >
                {SEARCH_LOCALE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t("analytics.serpLocaleOption", {
                    label: searchLocaleLabel(t, option.value),
                    country: option.country,
                    language: option.language
                  })}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  name="serpDeep"
                  value="1"
                  defaultChecked={serpDeepCheckEnabled}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                />
                {t("analytics.deepCheck")}
              </label>
            </div>
          </form>
        </div>

        {serpKeyword ? (
          <div className="mt-5 rounded-[1.5rem] border border-line bg-mist/60 p-5">
            {liveSerpCheckError ? (
              <p className="text-sm text-red-600">
                {liveSerpCheckError === "SERPER_API_KEY is not configured."
                  ? t("analytics.serpNotConfigured")
                  : t("analytics.serpFailed", { error: localizeMessage(liveSerpCheckError) })}
              </p>
            ) : liveSerpCheck ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t("analytics.serpResult")}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.keyword")}</p>
                    <p className="mt-2 break-words text-lg font-semibold text-ink">{liveSerpCheck.keyword}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.checkedDomain")}</p>
                    <p className="mt-2 break-words text-lg font-semibold text-ink">{liveSerpCheck.checkedDomain}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.checkedIn")}</p>
                    <p className="mt-2 text-lg font-semibold text-ink">
                      {serpPlaces?.country} ({liveSerpCheck.countryCode})
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {serpPlaces?.language} ({liveSerpCheck.languageCode})
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.position")}</p>
                    <p className="mt-2 text-lg font-semibold text-ink">
                      {liveSerpCheck.position
                        ? liveSerpCheck.pageNumber
                          ? t("analytics.foundOnPage", { page: liveSerpCheck.pageNumber, position: liveSerpCheck.position })
                          : `#${liveSerpCheck.position}`
                        : liveSerpCheck.deepCheckEnabled
                          ? t("analytics.notFoundTop50")
                          : t("analytics.notFoundTop10")}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.rankingUrl")}</p>
                    <p className="mt-2 break-all text-sm font-semibold text-ink">
                      {liveSerpCheck.rankingUrl ?? t("analytics.notFoundTop10")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">{t("analytics.checkedTimestamp")}</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatCheckedAt(liveSerpCheck.checkedAt, locale)}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {t("analytics.checkedInLine", { country: serpPlaces?.country ?? "", code: liveSerpCheck.countryCode })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-line bg-white px-4 py-4">
                  <p className="text-sm text-slate-500">{t("analytics.topDomains")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {liveSerpCheck.topDomains.length === 0 ? (
                      <p className="text-sm text-slate-600">{t("analytics.noDomains")}</p>
                    ) : (
                      liveSerpCheck.topDomains.map((domain, index) => (
                        <span
                          key={`${domain}-${index}`}
                          className="inline-flex rounded-full border border-line bg-mist px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          {index + 1}. {domain}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {shouldShowPropertySelection ? (
        <section className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("analytics.propertySelectionEyebrow")}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t("analytics.propertySelectionTitle")}</h2>
              <p className="mt-2 text-sm text-slate-600">{t("analytics.propertySelectionDescription")}</p>
            </div>
          </div>

          {searchConsoleProperties && searchConsoleProperties.length > 0 ? (
            <div className="mt-6">
              <SearchConsolePropertyPicker
                siteId={siteId}
                properties={searchConsoleProperties}
                selectedPropertyUrl={site.searchConsolePropertyUrl}
              />
            </div>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-slate-600">
              {t("analytics.noProperties")}
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-3xl border border-line bg-white/80 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t("analytics.internalEyebrow")}</p>
            <p className="mt-2 text-sm text-slate-600">
              {t("analytics.internalDescription")}
            </p>
          </div>
          <Link
            href={`/${siteId}/articles`}
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            {t("analytics.openArticles")}
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {internalMetrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-line bg-mist/50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{metric.value}</p>
              <p className="mt-1 text-xs text-slate-600">{metric.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {gscDebugEnabled ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">{t("analytics.debugEyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t("analytics.debugTitle")}</h2>
          <p className="mt-2 text-sm text-slate-700">
            {t("analytics.debugDescription")}
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm">
              <p className="font-semibold text-ink">{t("analytics.storedProperty")}</p>
              <p className="mt-1 break-all text-slate-700">{storedPropertyUrl ?? t("analytics.none")}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm">
              <p className="font-semibold text-ink">{t("analytics.selectedProperty")}</p>
              <p className="mt-1 break-all text-slate-700">{selectedProperty?.siteUrl ?? t("analytics.none")}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm">
              <p className="font-semibold text-ink">{t("analytics.dateRangeLabel")}</p>
              <p className="mt-1 text-slate-700">
                {t("analytics.dateRange", {
                  start: searchConsolePerformance?.startDate ?? t("analytics.notAvailable"),
                  end: searchConsolePerformance?.endDate ?? t("analytics.notAvailable")
                })}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm">
              <p className="font-semibold text-ink">{t("analytics.rawRows")}</p>
              <p className="mt-1 text-slate-700">
                {t("analytics.rawRowsSummary", {
                  summary: searchConsolePerformance?.debug?.rawSummaryRowCount ?? 0,
                  top: searchConsolePerformance?.debug?.rawTopQueriesRowCount ?? 0
                })}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-white p-4">
              <p className="text-sm font-semibold text-ink">{t("analytics.summaryQueryBody")}</p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-sand/70 p-3 text-xs text-slate-800">
                <code>{JSON.stringify(searchConsolePerformance?.debug?.queryBodySummary ?? null, null, 2)}</code>
              </pre>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white p-4">
              <p className="text-sm font-semibold text-ink">{t("analytics.topQueriesQueryBody")}</p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-sand/70 p-3 text-xs text-slate-800">
                <code>{JSON.stringify(searchConsolePerformance?.debug?.queryBodyTopQueries ?? null, null, 2)}</code>
              </pre>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-4">
            <p className="text-sm font-semibold text-ink">{t("analytics.rawResponseSummary")}</p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-sand/70 p-3 text-xs text-slate-800">
              <code>
                {JSON.stringify(
                  {
                    rawSummaryAggregationType: searchConsolePerformance?.debug?.rawSummaryAggregationType ?? null,
                    rawSummaryTotals: searchConsolePerformance?.debug?.rawSummaryTotals ?? null,
                    rawTopQueriesAggregationType: searchConsolePerformance?.debug?.rawTopQueriesAggregationType ?? null,
                    performanceError: searchConsolePerformanceError,
                    propertiesError: searchConsolePropertiesError
                  },
                  null,
                  2
                )}
              </code>
            </pre>
          </div>
        </section>
      ) : null}
    </section>
  );
}
