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

export type SearchConsolePerformanceSnapshot = SearchConsoleQueryMetric & {
  debug?: {
    endDate: string;
    propertyUrl: string;
    queryBodySummary: Record<string, unknown>;
    queryBodyTopQueries: Record<string, unknown>;
    rawSummaryAggregationType: string | null;
    rawSummaryRowCount: number;
    rawSummaryTotals: SearchConsoleQueryMetric;
    rawTopQueriesAggregationType: string | null;
    rawTopQueriesRowCount: number;
  };
  endDate: string;
  startDate: string;
  topQueries: SearchConsoleTopQuery[];
};

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

  const queryBodySummary = {
    startDate,
    endDate,
    rowLimit: 1
  } satisfies Record<string, unknown>;

  const queryBodyTopQueries = {
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: 10
  } satisfies Record<string, unknown>;

  const [summary, topQueries] = await Promise.all([
    runSearchAnalyticsQuery(access.accessToken, propertyUrl, queryBodySummary),
    runSearchAnalyticsQuery(access.accessToken, propertyUrl, queryBodyTopQueries)
  ]);

  if (!summary || !topQueries) {
    return null;
  }

  const summaryRow = summary.rows?.[0];
  const debug = {
    propertyUrl,
    startDate,
    endDate,
    queryBodySummary,
    queryBodyTopQueries,
    rawSummaryAggregationType: summary.responseAggregationType ?? null,
    rawSummaryRowCount: summary.rows?.length ?? 0,
    rawSummaryTotals: {
      clicks: summaryRow?.clicks ?? 0,
      impressions: summaryRow?.impressions ?? 0,
      ctr: summaryRow?.ctr ?? 0,
      position: summaryRow?.position ?? 0
    },
    rawTopQueriesAggregationType: topQueries.responseAggregationType ?? null,
    rawTopQueriesRowCount: topQueries.rows?.length ?? 0
  };

  return {
    clicks: summaryRow?.clicks ?? 0,
    impressions: summaryRow?.impressions ?? 0,
    ctr: summaryRow?.ctr ?? 0,
    position: summaryRow?.position ?? 0,
    startDate,
    endDate,
    debug,
    topQueries:
      topQueries.rows?.map((row) => ({
        query: row.keys?.[0] ?? "Unknown query",
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0
      })) ?? []
  } satisfies SearchConsolePerformanceSnapshot;
}
