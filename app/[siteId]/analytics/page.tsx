import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SeoPerformanceSection } from "@/components/seo-performance-section";
import { SearchConsolePropertyPicker } from "@/components/search-console-property-picker";
import { auth, signIn } from "@/lib/auth";
import {
  GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE,
  getSearchConsolePerformanceForUser,
  listSearchConsolePropertiesForUser
} from "@/lib/google-search-console";
import { prisma } from "@/lib/prisma";
import { AnalyticsRouteParamsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<{ gscDebug?: string }>;
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

export default async function AnalyticsPage({ params, searchParams }: AnalyticsPageProps) {
  const parsedParams = AnalyticsRouteParamsSchema.safeParse(await params);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (!parsedParams.success) {
    notFound();
  }

  const { siteId } = parsedParams.data;
  const gscDebugEnabled = resolvedSearchParams?.gscDebug === "1";
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  const [site, articleMetrics, keywordMetrics, recentActivity] = await Promise.all([
    prisma.siteProject.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        domain: true,
        searchConsolePropertyUrl: true,
        searchConsoleConnectedAt: true,
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

  if (site.workspace.ownerId !== session.user.id) {
    notFound();
  }

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

  if (selectedProperty?.siteUrl) {
    try {
      searchConsolePerformance = await getSearchConsolePerformanceForUser(session.user.id, selectedProperty.siteUrl);
    } catch (error) {
      searchConsolePerformanceError =
        error instanceof Error ? error.message : "Unable to load Search Console performance data.";
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

  return (
    <section className="space-y-8">
      <PageHeader
        title="Analytics"
        description={`Track real internal product metrics for ${site.name} and, when connected, verified Google Search Console data.`}
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
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {searchConsoleState === "connected-with-data"
                ? "Google Search Console is connected and returning live search data."
                : searchConsoleState === "connected-no-data"
                  ? "Google Search Console is connected, but there is no search data yet for this range."
                  : searchConsoleState === "reconnect-required"
                    ? "Reconnect Google Search Console to restore live analytics."
                    : searchConsoleState === "error"
                      ? "Google Search Console is connected, but the live fetch failed."
                      : "Connect Google Search Console to unlock real SEO performance data."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Internal cards below always reflect real product data from DIYSEO. Search performance cards only render
              verified Google Search Console data after a successful property connection and live query fetch.
            </p>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4 lg:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Integration Status</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {searchConsoleState === "connected-with-data"
                ? "Connected with data"
                : searchConsoleState === "connected-no-data"
                  ? "Connected, no data yet"
                  : searchConsoleState === "reconnect-required"
                    ? "Reconnect required"
                    : searchConsoleState === "error"
                      ? "Fetch error"
                      : hasSearchConsoleAccess
                        ? "Access granted"
                        : "Not connected"}
            </p>

            {selectedProperty ? (
              <>
                <p className="mt-2 text-sm text-slate-600">Selected property</p>
                <p className="mt-1 break-all text-sm font-semibold text-ink">{selectedProperty.siteUrl}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Connected {site.searchConsoleConnectedAt ? formatUpdatedAt(site.searchConsoleConnectedAt) : "recently"}
                </p>
                <p className="mt-2 text-xs text-slate-500">Live GSC requests run on page load.</p>
              </>
            ) : storedPropertyUrl ? (
              <>
                <p className="mt-2 text-sm text-slate-600">Previously selected property</p>
                <p className="mt-1 break-all text-sm font-semibold text-ink">{storedPropertyUrl}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Google Search Console access needs to be refreshed before this property can be used again.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                Search metrics stay hidden until this site has an authorized Search Console property.
              </p>
            )}

            {searchConsolePropertiesError ? (
              <p className="mt-3 text-sm text-red-600">Property load failed. {searchConsolePropertiesError}</p>
            ) : null}
            {searchConsolePerformanceError ? (
              <p className="mt-3 text-sm text-red-600">Performance load failed. {searchConsolePerformanceError}</p>
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
                  className="mt-4 inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Connect Google Search Console
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      {hasSearchConsoleAccess ? (
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {internalMetrics.map((metric) => (
          <div key={metric.label} className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{metric.value}</p>
            <p className="mt-2 text-sm text-slate-600">{metric.detail}</p>
          </div>
        ))}
      </div>

      <section className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Internal Product Data</p>
        <p className="mt-2 text-sm text-slate-600">
          These counts come directly from DIYSEO records for articles, keywords, and publishing activity. They do not
          depend on Google Search Console.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
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
