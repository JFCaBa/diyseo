import { effectivePlan, type WorkspacePlan } from "@/lib/entitlements";

const DAY_MS = 24 * 60 * 60 * 1000;

export const TRIALS_ENDING_DAYS = 7;

// `from` is exclusive and `to` inclusive (the dashboard query uses gt / lte).
export function trialEndingWindow(now: Date): { from: Date; to: Date } {
  return { from: now, to: new Date(now.getTime() + TRIALS_ENDING_DAYS * DAY_MS) };
}

function mondayUtc(date: Date): number {
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return dayStart - sinceMonday * DAY_MS;
}

/** Monday-start UTC weeks, oldest first, always `weeks` entries; dates outside the range are ignored. */
export function bucketByWeekUtc(dates: Date[], now: Date, weeks: number): { weekStart: Date; count: number }[] {
  const lastStart = mondayUtc(now);
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(lastStart - (weeks - 1 - i) * 7 * DAY_MS),
    count: 0
  }));
  for (const d of dates) {
    const index = Math.floor((mondayUtc(d) - buckets[0].weekStart.getTime()) / (7 * DAY_MS));
    if (index >= 0 && index < weeks && d.getTime() < lastStart + 7 * DAY_MS) buckets[index].count += 1;
  }
  return buckets;
}

export function countByEffectivePlan(
  workspaces: { plan: string; trialEndsAt: Date | null }[],
  now: Date
): Record<WorkspacePlan, number> {
  const counts: Record<WorkspacePlan, number> = { TRIAL: 0, STARTER: 0, PRO: 0, AGENCY: 0, COMP: 0, NONE: 0 };
  for (const ws of workspaces) counts[effectivePlan(ws, now)] += 1;
  return counts;
}

export type MonthlyUsage = { month: Date; counts: Record<string, number>; total: number };

function monthStartOf(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

/** First instant (UTC) of the oldest month in a `months`-long window ending with the month of `now`. */
export function usageWindowStartUtc(now: Date, months: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
}

/** UTC calendar months, oldest first, always `months` entries; rows outside the window are ignored. */
export function fillMonthlyUsage(
  rows: { month: Date; kind: string; count: number }[],
  now: Date,
  months: number
): MonthlyUsage[] {
  const out: MonthlyUsage[] = Array.from({ length: months }, (_, i) => ({
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - i), 1)),
    counts: {},
    total: 0
  }));
  for (const row of rows) {
    const entry = out.find((m) => m.month.getTime() === monthStartOf(row.month));
    if (!entry) continue;
    entry.counts[row.kind] = (entry.counts[row.kind] ?? 0) + row.count;
    entry.total += row.count;
  }
  return out;
}
