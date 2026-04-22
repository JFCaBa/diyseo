import Link from "next/link";

import { updateArticleDate } from "@/lib/actions";

type CalendarArticle = {
  id: string;
  publishedAt: Date;
  status: "DRAFT" | "PUBLISHED";
  title: string;
};

type CalendarMonthViewProps = {
  articles: CalendarArticle[];
  month: Date;
  returnToBase: string;
  siteId: string;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatMonthParam(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getGridStart(month: Date) {
  const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

function buildGridDays(month: Date) {
  const gridStart = getGridStart(month);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return {
      date,
      dayKey: formatDayKey(date),
      inMonth: date.getUTCMonth() === month.getUTCMonth()
    };
  });
}

export function CalendarMonthView({ articles, month, returnToBase, siteId }: CalendarMonthViewProps) {
  const updateDateForSite = updateArticleDate.bind(null, siteId);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric"
  }).format(month);
  const previousMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
  const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
  const returnTo = `${returnToBase}?month=${formatMonthParam(month)}`;
  const articleMap = new Map<string, CalendarArticle[]>();

  for (const article of articles) {
    const key = formatDayKey(article.publishedAt);
    const dayArticles = articleMap.get(key) ?? [];
    dayArticles.push(article);
    articleMap.set(key, dayArticles);
  }

  return (
    <div className="space-y-4 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{monthLabel}</h2>
          <p className="text-sm text-slate-600">Drafts and published articles with a scheduled date appear on this grid.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/${siteId}/articles/new?returnTo=${encodeURIComponent(returnTo)}`}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            New Draft
          </Link>
          <Link
            href={`${returnToBase}?month=${formatMonthParam(previousMonth)}`}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Prev
          </Link>
          <Link
            href={`${returnToBase}?month=${formatMonthParam(nextMonth)}`}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Next
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {weekdayLabels.map((label) => (
          <div key={label} className="rounded-2xl bg-mist px-3 py-2 text-center">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
        {buildGridDays(month).map((day) => {
          const dayArticles = articleMap.get(day.dayKey) ?? [];

          return (
            <div
              key={day.dayKey}
              className={`min-h-48 rounded-3xl border p-3 ${
                day.inMonth ? "border-line bg-white" : "border-dashed border-line bg-mist/60 text-slate-400"
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">{day.date.getUTCDate()}</p>
                {day.inMonth ? (
                  <Link
                    href={`/${siteId}/articles/new?date=${day.dayKey}&returnTo=${encodeURIComponent(returnTo)}`}
                    className="inline-flex items-center justify-center rounded-full border border-line px-2 py-1 text-[11px] font-semibold text-accent transition hover:bg-mist"
                  >
                    New Draft
                  </Link>
                ) : null}
              </div>

              <div className="space-y-3">
                {dayArticles.map((article) => (
                  <div
                    key={article.id}
                    className={`rounded-2xl border px-3 py-3 text-sm ${
                      article.status === "PUBLISHED"
                        ? "border-accent bg-accent/10"
                        : "border-dashed border-line bg-mist/70"
                    }`}
                  >
                    <Link href={`/${siteId}/articles/${article.id}`} className="font-semibold text-ink hover:text-accent">
                      {article.title}
                    </Link>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{article.status}</p>
                    <form action={updateDateForSite} className="mt-3 grid gap-2">
                      <input type="hidden" name="articleId" value={article.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input
                        type="date"
                        name="newDate"
                        defaultValue={day.dayKey}
                        className="rounded-xl border border-line px-3 py-2 text-sm outline-none transition focus:border-accent"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        Save Date
                      </button>
                    </form>
                    <form action={updateDateForSite} className="mt-2">
                      <input type="hidden" name="articleId" value={article.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="newDate" value="" />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-xl border border-line px-3 py-2 text-xs font-semibold text-ink transition hover:bg-mist"
                        >
                          Clear
                        </button>
                      </div>
                    </form>
                  </div>
                ))}

                {day.inMonth && dayArticles.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-xs text-slate-500">
                    No scheduled content.
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
