"use client";

import { useMemo, useState } from "react";

import type {
  SearchConsoleKeywordRanking,
  SearchConsoleKeywordTrend,
  SearchConsoleTrendPoint
} from "@/lib/google-search-console";

type SeoPerformanceSectionProps = {
  endDate: string;
  keywordRankings: SearchConsoleKeywordRanking[];
  keywordTrends: SearchConsoleKeywordTrend[];
  overallTrend: SearchConsoleTrendPoint[];
  position: number;
  positionChange: number | null;
  previousEndDate: string;
  previousPosition: number;
  previousStartDate: string;
  startDate: string;
};

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPosition(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "—";
  }

  return value.toFixed(1);
}

function formatPositionDelta(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "No previous data";
  }

  const change = Math.abs(value).toFixed(1);

  if (Math.abs(value) < 0.1) {
    return "Flat vs previous period";
  }

  return value < 0 ? `Up ${change} positions` : `Down ${change} positions`;
}

function getTrendTone(value: number | null) {
  if (value === null || Math.abs(value) < 0.1) {
    return "text-slate-600";
  }

  return value < 0 ? "text-accent" : "text-amber-700";
}

function getTrendLabel(ranking: SearchConsoleKeywordRanking) {
  if (ranking.trend === "new") {
    return "New";
  }

  if (ranking.trend === "flat") {
    return "Flat";
  }

  const amount = Math.abs(ranking.positionChange ?? 0).toFixed(1);
  return ranking.trend === "up" ? `Up ${amount}` : `Down ${amount}`;
}

function getTrendBadgeClass(ranking: SearchConsoleKeywordRanking) {
  if (ranking.trend === "up") {
    return "bg-accent/10 text-accent";
  }

  if (ranking.trend === "down") {
    return "bg-amber-100 text-amber-800";
  }

  if (ranking.trend === "new") {
    return "bg-sky-100 text-sky-800";
  }

  return "bg-slate-100 text-slate-700";
}

function buildLinePath(points: SearchConsoleTrendPoint[], width: number, height: number) {
  const validPoints = points.filter((point) => point.position !== null);

  if (validPoints.length === 0) {
    return "";
  }

  const positions = validPoints.map((point) => point.position ?? 0);
  const minPosition = Math.min(...positions);
  const maxPosition = Math.max(...positions);
  const range = maxPosition - minPosition || 1;

  return validPoints
    .map((point, validIndex) => {
      const index = points.findIndex((candidate) => candidate.date === point.date);
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = ((point.position ?? maxPosition) - minPosition) / range;
      const scaledY = y * height;
      return `${validIndex === 0 ? "M" : "L"} ${x.toFixed(2)} ${scaledY.toFixed(2)}`;
    })
    .join(" ");
}

function PositionChart({
  label,
  points
}: {
  label: string;
  points: SearchConsoleTrendPoint[];
}) {
  const validPoints = points.filter((point) => point.position !== null);
  const path = useMemo(() => buildLinePath(points, 520, 180), [points]);
  const latestPoint = [...validPoints].reverse().find((point) => point.position !== null) ?? null;

  return (
    <div className="rounded-[1.5rem] border border-line bg-mist/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Position Chart</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">{label}</h3>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Latest recorded position</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatPosition(latestPoint?.position ?? null)}</p>
        </div>
      </div>

      {validPoints.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-sm text-slate-600">
          Google Search Console returned no daily position points for this selection in the current 28-day range.
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-line bg-white p-4">
            <svg viewBox="0 0 520 180" className="h-48 w-full" role="img" aria-label={`${label} position trend`}>
              <line x1="0" y1="180" x2="520" y2="180" className="stroke-line" strokeWidth="1" />
              <line x1="0" y1="0" x2="0" y2="180" className="stroke-line" strokeWidth="1" />
              <path d={path} fill="none" stroke="currentColor" strokeWidth="3" className="text-accent" strokeLinecap="round" />
            </svg>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{points[0]?.date}</span>
            <span>{points[points.length - 1]?.date}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function SeoPerformanceSection({
  startDate,
  endDate,
  previousStartDate,
  previousEndDate,
  position,
  previousPosition,
  positionChange,
  keywordRankings,
  keywordTrends,
  overallTrend
}: SeoPerformanceSectionProps) {
  const [selectedView, setSelectedView] = useState<string>("overall");
  const trendByQuery = useMemo(() => new Map(keywordTrends.map((trend) => [trend.query, trend] as const)), [keywordTrends]);

  const selectedTrend = selectedView === "overall" ? null : trendByQuery.get(selectedView) ?? null;
  const chartLabel = selectedTrend ? selectedTrend.query : "Overall average position";
  const chartPoints = selectedTrend?.points ?? overallTrend;

  return (
    <section className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">SEO Performance</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Keyword rankings and trend movement</h2>
          <p className="mt-2 text-sm text-slate-600">
            Rankings come from live Google Search Console `searchAnalytics.query` data for {startDate} to {endDate},
            compared with {previousStartDate} to {previousEndDate}.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-mist px-4 py-4">
            <p className="text-sm text-slate-500">Avg position</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{formatPosition(position)}</p>
            <p className="mt-2 text-sm text-slate-600">Last 28 days</p>
          </div>
          <div className="rounded-2xl bg-mist px-4 py-4">
            <p className="text-sm text-slate-500">Position change</p>
            <p className={`mt-2 text-3xl font-semibold ${getTrendTone(positionChange)}`}>
              {positionChange === null ? "—" : Math.abs(positionChange).toFixed(1)}
            </p>
            <p className={`mt-2 text-sm ${getTrendTone(positionChange)}`}>
              {formatPositionDelta(positionChange)}
              {previousPosition > 0 ? ` from ${previousPosition.toFixed(1)}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[1.5rem] border border-line">
          <div className="grid grid-cols-[1.8fr_0.7fr_0.8fr_0.7fr_0.7fr_0.8fr] gap-3 bg-mist px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <p>Keyword</p>
            <p>Position</p>
            <p>Clicks</p>
            <p>Impr.</p>
            <p>CTR</p>
            <p>Trend</p>
          </div>
          <div className="divide-y divide-line">
            {keywordRankings.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">
                Google Search Console returned no keyword rows for the current 28-day range.
              </div>
            ) : (
              keywordRankings.map((ranking) => (
                <button
                  key={ranking.query}
                  type="button"
                  onClick={() => setSelectedView(ranking.query)}
                  className={`grid w-full grid-cols-[1.8fr_0.7fr_0.8fr_0.7fr_0.7fr_0.8fr] gap-3 px-4 py-4 text-left text-sm transition ${
                    selectedView === ranking.query ? "bg-accent/5" : "bg-white hover:bg-mist/70"
                  }`}
                >
                  <p className="truncate font-semibold text-ink">{ranking.query}</p>
                  <p className="text-slate-700">{formatPosition(ranking.position)}</p>
                  <p className="text-slate-700">{formatCompactNumber(ranking.clicks)}</p>
                  <p className="text-slate-700">{formatCompactNumber(ranking.impressions)}</p>
                  <p className="text-slate-700">{formatPercent(ranking.ctr)}</p>
                  <p>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getTrendBadgeClass(ranking)}`}>
                      {getTrendLabel(ranking)}
                    </span>
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-line bg-white p-5">
            <label htmlFor="seo-performance-view" className="text-sm font-medium text-ink">
              Chart view
            </label>
            <select
              id="seo-performance-view"
              value={selectedView}
              onChange={(event) => setSelectedView(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
            >
              <option value="overall">Overall average position</option>
              {keywordRankings.map((ranking) => (
                <option key={ranking.query} value={ranking.query}>
                  {ranking.query}
                </option>
              ))}
            </select>
            <p className="mt-3 text-sm text-slate-600">
              Select a keyword to inspect its daily position line, or keep the overall aggregated view.
            </p>
          </div>

          <PositionChart label={chartLabel} points={chartPoints} />
        </div>
      </div>
    </section>
  );
}
