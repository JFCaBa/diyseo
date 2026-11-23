"use client";

import { useMemo, useState } from "react";

import { useLocale, useT } from "@/components/i18n-provider";
import { formatNumber, type T } from "@/lib/i18n/translate";
import type { UiLocale } from "@/lib/i18n/locale";
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

function formatCompactNumber(value: number, locale: UiLocale) {
  return formatNumber(value, locale, {
    notation: "compact",
    maximumFractionDigits: 1
  });
}

const ONE_DECIMAL = { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false } as const;

function formatOneDecimal(value: number, locale: UiLocale) {
  return formatNumber(value, locale, ONE_DECIMAL);
}

function formatPercent(value: number, locale: UiLocale) {
  return `${formatOneDecimal(value * 100, locale)}%`;
}

function formatPosition(value: number | null, locale: UiLocale) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return "—";
  }

  return formatOneDecimal(value, locale);
}

function formatPositionDelta(value: number | null, t: T, locale: UiLocale) {
  if (value === null || !Number.isFinite(value)) {
    return t("seoPerformance.noPreviousData");
  }

  const change = formatOneDecimal(Math.abs(value), locale);

  if (Math.abs(value) < 0.1) {
    return t("seoPerformance.flat");
  }

  return value < 0 ? t("seoPerformance.upPositions", { change }) : t("seoPerformance.downPositions", { change });
}

function getTrendTone(value: number | null) {
  if (value === null || Math.abs(value) < 0.1) {
    return "text-slate-600";
  }

  return value < 0 ? "text-accent" : "text-amber-700";
}

function getTrendLabel(ranking: SearchConsoleKeywordRanking, t: T, locale: UiLocale) {
  if (ranking.trend === "new") {
    return t("seoPerformance.trendNew");
  }

  if (ranking.trend === "flat") {
    return t("seoPerformance.trendFlat");
  }

  const amount = formatOneDecimal(Math.abs(ranking.positionChange ?? 0), locale);
  return ranking.trend === "up" ? t("seoPerformance.trendUp", { amount }) : t("seoPerformance.trendDown", { amount });
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
  const t = useT();
  const locale = useLocale();
  const validPoints = points.filter((point) => point.position !== null);
  const path = useMemo(() => buildLinePath(points, 520, 180), [points]);
  const latestPoint = [...validPoints].reverse().find((point) => point.position !== null) ?? null;

  return (
    <div className="rounded-[1.5rem] border border-line bg-mist/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t("seoPerformance.positionChart")}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">{label}</h3>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">{t("seoPerformance.latestPosition")}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatPosition(latestPoint?.position ?? null, locale)}</p>
        </div>
      </div>

      {validPoints.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line bg-white px-4 py-8 text-sm text-slate-600">
          {t("seoPerformance.noPoints")}
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-line bg-white p-4">
            <svg viewBox="0 0 520 180" className="h-48 w-full" role="img" aria-label={t("seoPerformance.chartAria", { label })}>
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
  const t = useT();
  const locale = useLocale();
  const pageSize = 10;
  const [selectedView, setSelectedView] = useState<string>("overall");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const trendByQuery = useMemo(() => new Map(keywordTrends.map((trend) => [trend.query, trend] as const)), [keywordTrends]);
  const totalPages = Math.max(1, Math.ceil(keywordRankings.length / pageSize));
  const pagedRankings = keywordRankings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const selectedTrend = selectedView === "overall" ? null : trendByQuery.get(selectedView) ?? null;
  const chartLabel = selectedTrend ? selectedTrend.query : t("seoPerformance.overallAverage");
  const chartPoints = selectedTrend?.points ?? overallTrend;

  return (
    <section className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{t("seoPerformance.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{t("seoPerformance.title")}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {t("seoPerformance.description", { startDate, endDate, previousStartDate, previousEndDate })}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-mist px-4 py-4">
            <p className="text-sm text-slate-500">{t("seoPerformance.avgPosition")}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{formatPosition(position, locale)}</p>
            <p className="mt-2 text-sm text-slate-600">{t("seoPerformance.last28Days")}</p>
          </div>
          <div className="rounded-2xl bg-mist px-4 py-4">
            <p className="text-sm text-slate-500">{t("seoPerformance.positionChange")}</p>
            <p className={`mt-2 text-3xl font-semibold ${getTrendTone(positionChange)}`}>
              {positionChange === null ? "—" : formatOneDecimal(Math.abs(positionChange), locale)}
            </p>
            <p className={`mt-2 text-sm ${getTrendTone(positionChange)}`}>
              {formatPositionDelta(positionChange, t, locale)}
              {previousPosition > 0 ? t("seoPerformance.fromPrevious", { previous: formatOneDecimal(previousPosition, locale) }) : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-[1.5rem] border border-line">
          <div className="grid grid-cols-[1.8fr_0.7fr_0.8fr_0.7fr_0.7fr_0.8fr] gap-3 bg-mist px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <p>{t("seoPerformance.keyword")}</p>
            <p>{t("seoPerformance.position")}</p>
            <p>{t("seoPerformance.clicks")}</p>
            <p>{t("seoPerformance.impressions")}</p>
            <p>{t("seoPerformance.ctr")}</p>
            <p>{t("seoPerformance.trend")}</p>
          </div>
          <div className="divide-y divide-line">
            {keywordRankings.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">
                {t("seoPerformance.noKeywordRows")}
              </div>
            ) : (
              pagedRankings.map((ranking) => (
                <button
                  key={ranking.query}
                  type="button"
                  onClick={() => setSelectedView(ranking.query)}
                  className={`grid w-full grid-cols-[1.8fr_0.7fr_0.8fr_0.7fr_0.7fr_0.8fr] gap-3 px-4 py-4 text-left text-sm transition ${
                    selectedView === ranking.query ? "bg-accent/5" : "bg-white hover:bg-mist/70"
                  }`}
                >
                  <p className="truncate font-semibold text-ink">{ranking.query}</p>
                  <p className="text-slate-700">{formatPosition(ranking.position, locale)}</p>
                  <p className="text-slate-700">{formatCompactNumber(ranking.clicks, locale)}</p>
                  <p className="text-slate-700">{formatCompactNumber(ranking.impressions, locale)}</p>
                  <p className="text-slate-700">{formatPercent(ranking.ctr, locale)}</p>
                  <p>
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getTrendBadgeClass(ranking)}`}>
                      {getTrendLabel(ranking, t, locale)}
                    </span>
                  </p>
                </button>
              ))
            )}
          </div>
          {keywordRankings.length > pageSize ? (
            <div className="flex items-center justify-between border-t border-line bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center justify-center rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("seoPerformance.previous")}
              </button>
              <p className="text-sm text-slate-600">
                {t("seoPerformance.pageOf", { current: currentPage, total: totalPages })}
              </p>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center justify-center rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("seoPerformance.next")}
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-line bg-white p-5">
            <label htmlFor="seo-performance-view" className="text-sm font-medium text-ink">
              {t("seoPerformance.chartView")}
            </label>
            <select
              id="seo-performance-view"
              value={selectedView}
              onChange={(event) => setSelectedView(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
            >
              <option value="overall">{t("seoPerformance.overallAverage")}</option>
              {keywordRankings.map((ranking) => (
                <option key={ranking.query} value={ranking.query}>
                  {ranking.query}
                </option>
              ))}
            </select>
            <p className="mt-3 text-sm text-slate-600">
              {t("seoPerformance.chartHint")}
            </p>
          </div>

          <PositionChart label={chartLabel} points={chartPoints} />
        </div>
      </div>
    </section>
  );
}
