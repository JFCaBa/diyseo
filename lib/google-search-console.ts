import { prisma } from "@/lib/prisma";

export const GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const GOOGLE_SEARCH_CONSOLE_READWRITE_SCOPE = "https://www.googleapis.com/auth/webmasters";

type GoogleTokenRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type SearchConsoleSitesResponse = {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
};

type SearchAnalyticsQueryResponse = {
  rows?: Array<{
    clicks?: number;
    ctr?: number;
    impressions?: number;
    keys?: string[];
    position?: number;
  }>;
  responseAggregationType?: string;
};

export type SearchConsoleProperty = {
  isSuggested: boolean;
  permissionLevel: string;
  siteUrl: string;
};

export type SearchConsoleQueryMetric = {
  clicks: number;
  ctr: number;
  impressions: number;
  position: number;
};

export type SearchConsoleTopQuery = SearchConsoleQueryMetric & {
  query: string;
};

export type SearchConsoleKeywordLookupResult = SearchConsoleTopQuery & {
  endDate: string;
  found: boolean;
  startDate: string;
};

export type SearchConsoleTrendPoint = {
  clicks: number;
  ctr: number;
  date: string;
  impressions: number;
  position: number | null;
};

export type SearchConsoleKeywordTrend = {
  points: SearchConsoleTrendPoint[];
  query: string;
};

export type SearchConsoleKeywordRanking = SearchConsoleTopQuery & {
  previousPosition: number | null;
  positionChange: number | null;
  trend: "down" | "flat" | "new" | "up";
};

export type SearchConsolePerformanceSnapshot = SearchConsoleQueryMetric & {
  debug?: {
    endDate: string;
    previousEndDate: string;
    previousStartDate: string;
    propertyUrl: string;
    queryBodyCurrentSummary: Record<string, unknown>;
    queryBodyCurrentTopQueries: Record<string, unknown>;
    queryBodyCurrentTrends: Record<string, unknown>;
    queryBodyPreviousSummary: Record<string, unknown>;
    queryBodyPreviousTopQueries: Record<string, unknown>;
    rawCurrentSummaryAggregationType: string | null;
    rawCurrentSummaryRowCount: number;
    rawCurrentTopQueriesAggregationType: string | null;
    rawCurrentTopQueriesRowCount: number;
    rawCurrentTrendsAggregationType: string | null;
    rawCurrentTrendsRowCount: number;
    rawPreviousSummaryAggregationType: string | null;
    rawPreviousSummaryRowCount: number;
    rawPreviousTopQueriesAggregationType: string | null;
    rawPreviousTopQueriesRowCount: number;
    rawPreviousTotals: SearchConsoleQueryMetric;
    queryBodySummary: Record<string, unknown>;
    queryBodyTopQueries: Record<string, unknown>;
    rawSummaryAggregationType: string | null;
    rawSummaryRowCount: number;
    rawSummaryTotals: SearchConsoleQueryMetric;
    rawTopQueriesAggregationType: string | null;
    rawTopQueriesRowCount: number;
  };
  endDate: string;
  keywordRankings: SearchConsoleKeywordRanking[];
  keywordTrends: SearchConsoleKeywordTrend[];
  overallTrend: SearchConsoleTrendPoint[];
  positionChange: number | null;
  previous: SearchConsoleQueryMetric;
  previousEndDate: string;
  previousStartDate: string;
  startDate: string;
  topQueries: SearchConsoleTopQuery[];
};

function normalizeMetricRow(row?: {
  clicks?: number;
  ctr?: number;
  impressions?: number;
  position?: number;
}) {
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0
  } satisfies SearchConsoleQueryMetric;
}

function listDatesInclusive(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function createTrendPoint(date: string, metrics?: Partial<SearchConsoleQueryMetric>) {
  return {
    date,
    clicks: metrics?.clicks ?? 0,
    impressions: metrics?.impressions ?? 0,
    ctr: metrics?.ctr ?? 0,
    position: typeof metrics?.position === "number" ? metrics.position : null
  } satisfies SearchConsoleTrendPoint;
}

function buildOverallTrend(
  rows: Array<{
    clicks?: number;
    ctr?: number;
    impressions?: number;
    keys?: string[];
    position?: number;
  }>,
  startDate: string,
  endDate: string
) {
  const byDate = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      positionRowCount: number;
      positionWeight: number;
      weightedPositionTotal: number;
    }
  >();

  for (const row of rows) {
    const date = row.keys?.[0];

    if (!date) {
      continue;
    }

    const impressions = row.impressions ?? 0;
    const bucket = byDate.get(date) ?? {
      clicks: 0,
      impressions: 0,
      positionWeight: 0,
      weightedPositionTotal: 0,
      positionRowCount: 0
    };

    bucket.clicks += row.clicks ?? 0;
    bucket.impressions += impressions;

    if (typeof row.position === "number") {
      if (impressions > 0) {
        bucket.weightedPositionTotal += row.position * impressions;
        bucket.positionWeight += impressions;
      } else {
        bucket.weightedPositionTotal += row.position;
        bucket.positionRowCount += 1;
      }
    }

    byDate.set(date, bucket);
  }

  return listDatesInclusive(startDate, endDate).map((date) => {
    const bucket = byDate.get(date);

    if (!bucket) {
      return createTrendPoint(date);
    }

    const position =
      bucket.positionWeight > 0
        ? bucket.weightedPositionTotal / bucket.positionWeight
        : bucket.positionRowCount > 0
          ? bucket.weightedPositionTotal / bucket.positionRowCount
          : null;

    return createTrendPoint(date, {
      clicks: bucket.clicks,
      impressions: bucket.impressions,
      ctr: bucket.impressions > 0 ? bucket.clicks / bucket.impressions : 0,
      position: position ?? undefined
    });
  });
}

function buildKeywordTrends(
  rows: Array<{
    clicks?: number;
    ctr?: number;
    impressions?: number;
    keys?: string[];
    position?: number;
  }>,
  queries: string[],
  startDate: string,
  endDate: string
) {
  const dateRange = listDatesInclusive(startDate, endDate);
  const rowsByQuery = new Map<string, Map<string, SearchConsoleTrendPoint>>();

  for (const row of rows) {
    const date = row.keys?.[0];
    const query = row.keys?.[1];

    if (!date || !query) {
      continue;
    }

    const byDate = rowsByQuery.get(query) ?? new Map<string, SearchConsoleTrendPoint>();
    byDate.set(
      date,
      createTrendPoint(date, {
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position
      })
    );
    rowsByQuery.set(query, byDate);
  }

  return queries.map((query) => ({
    query,
    points: dateRange.map((date) => rowsByQuery.get(query)?.get(date) ?? createTrendPoint(date))
  }));
}

function getRankingTrend(positionChange: number | null) {
  if (positionChange === null) {
    return "new";
  }

  if (Math.abs(positionChange) < 0.1) {
    return "flat";
  }

  return positionChange < 0 ? "up" : "down";
}

function normalizeHost(value: string) {
  return value.toLowerCase().replace(/^www\./, "");
}

function getSiteHost(domain: string) {
  try {
    return normalizeHost(new URL(domain).hostname);
  } catch {
    return normalizeHost(domain.replace(/^https?:\/\//, "").split("/")[0] ?? "");
  }
}

function getPropertyMatchScore(siteDomain: string, propertyUrl: string) {
  const siteHost = getSiteHost(siteDomain);

  if (!siteHost) {
    return 0;
  }

  if (propertyUrl.startsWith("sc-domain:")) {
    const propertyDomain = normalizeHost(propertyUrl.replace(/^sc-domain:/, ""));

    if (siteHost === propertyDomain) {
      return 3;
    }

    if (siteHost.endsWith(`.${propertyDomain}`)) {
      return 2;
    }

    return 0;
  }

  try {
    const propertyHost = normalizeHost(new URL(propertyUrl).hostname);

    if (siteHost === propertyHost) {
      return 3;
    }

    return 0;
  } catch {
    return 0;
  }
}

function hasSearchConsoleScope(scope: string | null) {
  if (!scope) {
    return false;
  }

  const grantedScopes = scope.split(/\s+/).filter(Boolean);
  return (
    grantedScopes.includes(GOOGLE_SEARCH_CONSOLE_READONLY_SCOPE) || grantedScopes.includes(GOOGLE_SEARCH_CONSOLE_READWRITE_SCOPE)
  );
}

async function refreshGoogleAccessToken(account: {
  id: string;
  refresh_token: string;
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token refresh failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as GoogleTokenRefreshResponse;

  if (!payload.access_token || !payload.expires_in) {
    throw new Error("Google token refresh returned an incomplete response.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + payload.expires_in;

  return prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: payload.access_token,
      expires_at: expiresAt,
      scope: payload.scope ?? undefined,
      token_type: payload.token_type ?? undefined
    },
    select: {
      access_token: true,
      scope: true
    }
  });
}

async function getGoogleSearchConsoleAccess(userId: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google"
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      access_token: true,
      refresh_token: true,
      expires_at: true,
      scope: true
    }
  });

  if (!account || !hasSearchConsoleScope(account.scope)) {
    return null;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const isExpired = Boolean(account.expires_at && account.expires_at <= nowInSeconds + 60);

  if (isExpired && account.refresh_token) {
    const refreshed = await refreshGoogleAccessToken({
      id: account.id,
      refresh_token: account.refresh_token
    });

    return hasSearchConsoleScope(refreshed.scope ?? account.scope)
      ? { accessToken: refreshed.access_token, scope: refreshed.scope ?? account.scope }
      : null;
  }

  if (!account.access_token) {
    return null;
  }

  return {
    accessToken: account.access_token,
    scope: account.scope
  };
}

export async function listSearchConsolePropertiesForUser(userId: string, siteDomain: string) {
  const access = await getGoogleSearchConsoleAccess(userId);

  if (!access?.accessToken) {
    return null;
  }

  const response = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: {
      Authorization: `Bearer ${access.accessToken}`
    },
    cache: "no-store"
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Search Console sites.list failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as SearchConsoleSitesResponse;

  return (payload.siteEntry ?? [])
    .filter((entry): entry is { siteUrl: string; permissionLevel?: string } => Boolean(entry.siteUrl))
    .map((entry) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel ?? "siteRestrictedUser",
      isSuggested: getPropertyMatchScore(siteDomain, entry.siteUrl) > 0,
      matchScore: getPropertyMatchScore(siteDomain, entry.siteUrl)
    }))
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }

      return left.siteUrl.localeCompare(right.siteUrl);
    })
    .map(({ matchScore: _matchScore, ...property }) => property satisfies SearchConsoleProperty);
}

function formatUtcDateOffset(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function runSearchAnalyticsQuery(
  accessToken: string,
  propertyUrl: string,
  body: Record<string, unknown>
) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    }
  );

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Search Console searchAnalytics.query failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as SearchAnalyticsQueryResponse;
}

export async function getSearchConsolePerformanceForUser(userId: string, propertyUrl: string) {
  const access = await getGoogleSearchConsoleAccess(userId);

  if (!access?.accessToken) {
    return null;
  }

  const startDate = formatUtcDateOffset(28);
  const endDate = formatUtcDateOffset(1);
  const previousStartDate = formatUtcDateOffset(56);
  const previousEndDate = formatUtcDateOffset(29);

  const queryBodyCurrentSummary = {
    startDate,
    endDate,
    rowLimit: 1
  } satisfies Record<string, unknown>;

  const queryBodyPreviousSummary = {
    startDate: previousStartDate,
    endDate: previousEndDate,
    rowLimit: 1
  } satisfies Record<string, unknown>;

  const queryBodyCurrentTopQueries = {
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: 25
  } satisfies Record<string, unknown>;

  const queryBodyPreviousTopQueries = {
    startDate: previousStartDate,
    endDate: previousEndDate,
    dimensions: ["query"],
    rowLimit: 25
  } satisfies Record<string, unknown>;

  const queryBodyCurrentTrends = {
    startDate,
    endDate,
    dimensions: ["date", "query"],
    rowLimit: 2500
  } satisfies Record<string, unknown>;

  const [currentSummary, previousSummary, currentTopQueries, previousTopQueries, currentTrends] = await Promise.all([
    runSearchAnalyticsQuery(access.accessToken, propertyUrl, queryBodyCurrentSummary),
    runSearchAnalyticsQuery(access.accessToken, propertyUrl, queryBodyPreviousSummary),
    runSearchAnalyticsQuery(access.accessToken, propertyUrl, queryBodyCurrentTopQueries),
    runSearchAnalyticsQuery(access.accessToken, propertyUrl, queryBodyPreviousTopQueries),
    runSearchAnalyticsQuery(access.accessToken, propertyUrl, queryBodyCurrentTrends)
  ]);

  if (!currentSummary || !previousSummary || !currentTopQueries || !previousTopQueries || !currentTrends) {
    return null;
  }

  const currentMetrics = normalizeMetricRow(currentSummary.rows?.[0]);
  const previousMetrics = normalizeMetricRow(previousSummary.rows?.[0]);
  const previousPositionsByQuery = new Map<string, number>();

  for (const row of previousTopQueries.rows ?? []) {
    const query = row.keys?.[0];

    if (!query) {
      continue;
    }

    previousPositionsByQuery.set(query, row.position ?? 0);
  }

  const keywordRankings =
    currentTopQueries.rows?.map((row) => {
      const query = row.keys?.[0] ?? "Unknown query";
      const previousPosition = previousPositionsByQuery.get(query) ?? null;
      const positionChange = previousPosition === null ? null : (row.position ?? 0) - previousPosition;

      return {
        query,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
        previousPosition,
        positionChange,
        trend: getRankingTrend(positionChange)
      } satisfies SearchConsoleKeywordRanking;
    }) ?? [];

  const keywordTrends = buildKeywordTrends(
    currentTrends.rows ?? [],
    keywordRankings.map((ranking) => ranking.query),
    startDate,
    endDate
  );
  const overallTrend = buildOverallTrend(currentTrends.rows ?? [], startDate, endDate);
  const debug = {
    propertyUrl,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    queryBodySummary: queryBodyCurrentSummary,
    queryBodyTopQueries: queryBodyCurrentTopQueries,
    queryBodyCurrentSummary,
    queryBodyPreviousSummary,
    queryBodyCurrentTopQueries,
    queryBodyPreviousTopQueries,
    queryBodyCurrentTrends,
    rawSummaryAggregationType: currentSummary.responseAggregationType ?? null,
    rawSummaryRowCount: currentSummary.rows?.length ?? 0,
    rawSummaryTotals: currentMetrics,
    rawTopQueriesAggregationType: currentTopQueries.responseAggregationType ?? null,
    rawTopQueriesRowCount: currentTopQueries.rows?.length ?? 0,
    rawCurrentSummaryAggregationType: currentSummary.responseAggregationType ?? null,
    rawCurrentSummaryRowCount: currentSummary.rows?.length ?? 0,
    rawCurrentTopQueriesAggregationType: currentTopQueries.responseAggregationType ?? null,
    rawCurrentTopQueriesRowCount: currentTopQueries.rows?.length ?? 0,
    rawCurrentTrendsAggregationType: currentTrends.responseAggregationType ?? null,
    rawCurrentTrendsRowCount: currentTrends.rows?.length ?? 0,
    rawPreviousSummaryAggregationType: previousSummary.responseAggregationType ?? null,
    rawPreviousSummaryRowCount: previousSummary.rows?.length ?? 0,
    rawPreviousTopQueriesAggregationType: previousTopQueries.responseAggregationType ?? null,
    rawPreviousTopQueriesRowCount: previousTopQueries.rows?.length ?? 0,
    rawPreviousTotals: previousMetrics
  };

  return {
    clicks: currentMetrics.clicks,
    impressions: currentMetrics.impressions,
    ctr: currentMetrics.ctr,
    position: currentMetrics.position,
    previous: previousMetrics,
    positionChange:
      currentMetrics.position > 0 && previousMetrics.position > 0 ? currentMetrics.position - previousMetrics.position : null,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    debug,
    topQueries: keywordRankings.map(({ previousPosition: _previousPosition, positionChange: _positionChange, trend: _trend, ...row }) => row),
    keywordRankings,
    keywordTrends,
    overallTrend
  } satisfies SearchConsolePerformanceSnapshot;
}

export async function getSearchConsoleKeywordLookupForUser(userId: string, propertyUrl: string, keyword: string) {
  const access = await getGoogleSearchConsoleAccess(userId);

  if (!access?.accessToken) {
    return null;
  }

  const normalizedKeyword = keyword.trim();

  if (!normalizedKeyword) {
    return null;
  }

  const startDate = formatUtcDateOffset(28);
  const endDate = formatUtcDateOffset(1);

  const queryBody = {
    startDate,
    endDate,
    dimensions: ["query"],
    dimensionFilterGroups: [
      {
        filters: [
          {
            dimension: "query",
            expression: normalizedKeyword,
            operator: "equals"
          }
        ]
      }
    ],
    rowLimit: 1
  } satisfies Record<string, unknown>;

  const response = await runSearchAnalyticsQuery(access.accessToken, propertyUrl, queryBody);

  if (!response) {
    return null;
  }

  const row = response.rows?.find((result) => (result.keys?.[0] ?? "").toLowerCase() === normalizedKeyword.toLowerCase()) ?? response.rows?.[0];

  if (!row) {
    return {
      query: normalizedKeyword,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
      found: false,
      startDate,
      endDate
    } satisfies SearchConsoleKeywordLookupResult;
  }

  return {
    query: row.keys?.[0] ?? normalizedKeyword,
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
    found: true,
    startDate,
    endDate
  } satisfies SearchConsoleKeywordLookupResult;
}
