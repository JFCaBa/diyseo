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
import { AnalyticsRouteParamsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<{
    gscDebug?: string;
    keyword?: string;
    serpCountry?: string;
    serpDeep?: string;
    serpKeyword?: string;
    serpLanguage?: string;
    serpLocale?: string;
  }>;
};

function formatPropertyDomain(propertyUrl: string | null | undefined) {
  if (!propertyUrl) {
    return "No property selected";
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

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPosition(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

  return value.toFixed(1);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatCheckedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default async function AnalyticsPage({ params, searchParams }: AnalyticsPageProps) {
  const parsedParams = AnalyticsRouteParamsSchema.safeParse(await params);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (!parsedParams.success) {
    notFound();
  }

  const { siteId } = parsedParams.data;
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
        workspace: {
          select: {
            ownerId: true
          }
        }
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

  if (site.workspace.ownerId !== session.user.id) {
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
    searchConsolePropertiesError = error instanceof Error ? error.message : "Unable to load Search Console properties.";
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
      const message = error instanceof Error ? error.message : "Unable to load Search Console performance data.";
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
      liveSerpCheckError = error instanceof Error ? error.message : "Unable to run live SERP check.";
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
  const shouldShowPropertySelection = hasSearchConsoleAccess && !selectedProperty;
  const propertyDisplayDomain = formatPropertyDomain(selectedProperty?.siteUrl ?? storedPropertyUrl);

  return (
    <section className="space-y-8">
      <PageHeader
        title="Analytics"
        description={`Track verified SEO performance for ${site.name} using live Google Search Console data.`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/keywords`}
              className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open Keywords
            </Link>
          </div>
        }
      />

      <section className="rounded-3xl border border-line bg-white/90 px-5 py-4 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`inline-flex rounded-full px-3 py-1 font-semibold ${
                searchConsoleState === "connected-with-data" || searchConsoleState === "connected-no-data"
                  ? "bg-accent/10 text-accent"
                  : searchConsoleState === "error" || searchConsoleState === "reconnect-required"
                    ? "bg-amber-100 text-amber-800"
                    : "border border-dashed border-line bg-white text-slate-600"
              }`}
            >
              {searchConsoleState === "connected-with-data" || searchConsoleState === "connected-no-data"
                ? "Connected"
                : "Not connected"}
            </span>
            <span className="text-slate-500">Property</span>
            <span className="font-semibold text-ink">{propertyDisplayDomain}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {searchConsolePropertiesError ? <p className="text-red-600">Property load failed. {searchConsolePropertiesError}</p> : null}
            {searchConsolePerformanceError ? (
              <p className="text-red-600">Performance load failed. {searchConsolePerformanceError}</p>
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
                  Connect Google Search Console
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Keyword Lookup</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Search a keyword position in Search Console</h2>
            <p className="mt-2 text-sm text-slate-600">
              Runs an exact-query lookup against the connected property for the last 28 days.
            </p>
          </div>

          <form method="GET" className="w-full max-w-2xl">
            {gscDebugEnabled ? <input type="hidden" name="gscDebug" value="1" /> : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                name="keyword"
                defaultValue={searchedKeyword}
                placeholder="Search keyword position..."
                className="min-w-0 flex-1 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-accent"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        {searchedKeyword ? (
          <div className="mt-5 rounded-[1.5rem] border border-line bg-mist/60 p-5">
            {searchConsoleKeywordLookupError ? (
              <p className="text-sm text-red-600">Keyword lookup failed. {searchConsoleKeywordLookupError}</p>
            ) : searchConsoleKeywordLookup?.found ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Lookup Result</p>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  <div className="rounded-2xl border border-line bg-white px-4 py-4 md:col-span-2">
                    <p className="text-sm text-slate-500">Keyword</p>
                    <p className="mt-2 break-words text-xl font-semibold text-ink">{searchConsoleKeywordLookup.query}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Average position</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{formatPosition(searchConsoleKeywordLookup.position)}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Clicks</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{formatCompactNumber(searchConsoleKeywordLookup.clicks)}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Impressions</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{formatCompactNumber(searchConsoleKeywordLookup.impressions)}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">CTR</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{formatPercent(searchConsoleKeywordLookup.ctr)}</p>
                  </div>
                  <div className="flex items-center rounded-2xl border border-line bg-white px-4 py-4 text-sm text-slate-600">
                    {searchConsoleKeywordLookup.startDate} to {searchConsoleKeywordLookup.endDate}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-700">
                No Search Console data found for this keyword in the last 28 days.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Live SERP Check</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Check current Google organic position</h2>
            <p className="mt-2 text-sm text-slate-600">
              Manual first-page Google check via Serper for the site domain. This does not replace Search Console metrics.
            </p>
          </div>

          <form method="GET" className="w-full max-w-2xl">
            {gscDebugEnabled ? <input type="hidden" name="gscDebug" value="1" /> : null}
            {searchedKeyword ? <input type="hidden" name="keyword" value={searchedKeyword} /> : null}
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px_auto]">
              <input
                type="search"
                name="serpKeyword"
                defaultValue={serpKeyword}
                placeholder="Search keyword position..."
                className="min-w-0 flex-1 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-accent"
              />
              <select
                name="serpLocale"
                defaultValue={selectedSerpLocale}
                className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
              >
                {SEARCH_LOCALE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - gl={option.country}, hl={option.language}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Check Google position
              </button>
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="serpDeep"
                value="1"
                defaultChecked={serpDeepCheckEnabled}
                className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              />
              Deep check (up to top 50)
            </label>
          </form>
        </div>

        {serpKeyword ? (
          <div className="mt-5 rounded-[1.5rem] border border-line bg-mist/60 p-5">
            {liveSerpCheckError ? (
              <p className="text-sm text-red-600">
                {liveSerpCheckError === "SERPER_API_KEY is not configured."
                  ? "Live SERP check is not configured. Add SERPER_API_KEY to enable this feature."
                  : `Live SERP check failed. ${liveSerpCheckError}`}
              </p>
            ) : liveSerpCheck ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Live SERP Result</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Keyword</p>
                    <p className="mt-2 break-words text-lg font-semibold text-ink">{liveSerpCheck.keyword}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Checked domain</p>
                    <p className="mt-2 break-words text-lg font-semibold text-ink">{liveSerpCheck.checkedDomain}</p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Checked in</p>
                    <p className="mt-2 text-lg font-semibold text-ink">
                      {liveSerpCheck.countryLabel} ({liveSerpCheck.countryCode})
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {liveSerpCheck.languageLabel} ({liveSerpCheck.languageCode})
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Position</p>
                    <p className="mt-2 text-lg font-semibold text-ink">
                      {liveSerpCheck.position
                        ? liveSerpCheck.pageNumber
                          ? `Found on page ${liveSerpCheck.pageNumber} (#${liveSerpCheck.position})`
                          : `#${liveSerpCheck.position}`
                        : liveSerpCheck.deepCheckEnabled
                          ? "Not found in top 50 results"
                          : "Not found in first 10 results"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 xl:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Ranking URL</p>
                    <p className="mt-2 break-all text-sm font-semibold text-ink">
                      {liveSerpCheck.rankingUrl ?? "Not found in first 10 results"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line bg-white px-4 py-4">
                    <p className="text-sm text-slate-500">Checked timestamp</p>
                    <p className="mt-2 text-sm font-semibold text-ink">{formatCheckedAt(liveSerpCheck.checkedAt)}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Checked in: {liveSerpCheck.countryLabel} ({liveSerpCheck.countryCode})
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-line bg-white px-4 py-4">
                  <p className="text-sm text-slate-500">Top 10 result domains</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {liveSerpCheck.topDomains.length === 0 ? (
                      <p className="text-sm text-slate-600">No organic result domains were returned.</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">SEO Performance</p>
            <div className="mt-4">
              <EmptyState
                title={
                  searchConsoleState === "reconnect-required"
                    ? "Reconnect Search Console to restore rankings."
                    : searchConsoleState === "error"
                      ? "Live Search Console ranking data could not be loaded."
                      : searchConsoleState === "connected-no-data"
                        ? "No keyword ranking data yet."
                        : "Connect Search Console to unlock keyword tracking."
                }
                description={
                  searchConsoleState === "reconnect-required"
                    ? "A property was previously selected for this site, but the current Google account no longer has valid access."
                    : searchConsoleState === "error"
                      ? "The connected property is valid, but the live Search Console request failed before keyword rankings could be rendered."
                      : searchConsoleState === "connected-no-data"
                        ? "Google Search Console returned no query rows for the current 28-day range, so SEO Performance stays empty instead of showing placeholders."
                        : "This section renders only real Google Search Console query data from searchAnalytics.query. No estimates or mock ranking rows are shown."
                }
              />
            </div>
          </section>
        )}
      </div>

      {shouldShowPropertySelection ? (
        <section className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Property Selection</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Choose the Search Console property for this site.</h2>
              <p className="mt-2 text-sm text-slate-600">
                We fetch properties from `sites.list` for the signed-in Google account and suggest matches based on this
                site&apos;s domain. Saving a property enables real GSC analytics for this site.
              </p>
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
              No Search Console properties were returned for this Google account.
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-3xl border border-line bg-white/80 p-5 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Internal Product Data</p>
            <p className="mt-2 text-sm text-slate-600">
              Supporting site inventory from DIYSEO records. This is secondary to SEO data and does not use Google Search Console.
            </p>
          </div>
          <Link
            href={`/${siteId}/articles`}
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Open Articles
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
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">GSC Debug</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Live query diagnostics</h2>
          <p className="mt-2 text-sm text-slate-700">
            This block is temporary debug output for Search Console troubleshooting. It reflects the exact property and
            request bodies currently being used.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm">
              <p className="font-semibold text-ink">Stored property</p>
              <p className="mt-1 break-all text-slate-700">{storedPropertyUrl ?? "None"}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm">
              <p className="font-semibold text-ink">Selected property used for query</p>
              <p className="mt-1 break-all text-slate-700">{selectedProperty?.siteUrl ?? "None"}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm">
              <p className="font-semibold text-ink">Date range</p>
              <p className="mt-1 text-slate-700">
                {searchConsolePerformance?.startDate ?? "n/a"} to {searchConsolePerformance?.endDate ?? "n/a"}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white px-4 py-4 text-sm">
              <p className="font-semibold text-ink">Raw response rows</p>
              <p className="mt-1 text-slate-700">
                Summary: {searchConsolePerformance?.debug?.rawSummaryRowCount ?? 0}, Top queries:{" "}
                {searchConsolePerformance?.debug?.rawTopQueriesRowCount ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-white p-4">
              <p className="text-sm font-semibold text-ink">Exact summary query body</p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-sand/70 p-3 text-xs text-slate-800">
                <code>{JSON.stringify(searchConsolePerformance?.debug?.queryBodySummary ?? null, null, 2)}</code>
              </pre>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-white p-4">
              <p className="text-sm font-semibold text-ink">Exact top queries query body</p>
              <pre className="mt-3 overflow-x-auto rounded-xl bg-sand/70 p-3 text-xs text-slate-800">
                <code>{JSON.stringify(searchConsolePerformance?.debug?.queryBodyTopQueries ?? null, null, 2)}</code>
              </pre>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-white p-4">
            <p className="text-sm font-semibold text-ink">Raw response summary</p>
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
