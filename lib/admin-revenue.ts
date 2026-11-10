import type { WorkspacePlan } from "./entitlements";
import { PLANS } from "./plans";

export type ChargeLike = { amount: number; amountRefunded: number; paid: boolean; currency: string };

/** Paid charges only, net of refunds on them, per currency (minor units), sorted by currency. */
export function netRevenueByCurrency(charges: ChargeLike[]): { currency: string; amountMinor: number }[] {
  const totals = new Map<string, number>();
  for (const c of charges) {
    if (!c.paid) continue;
    const net = Math.max(0, c.amount - c.amountRefunded);
    totals.set(c.currency, (totals.get(c.currency) ?? 0) + net);
  }
  return [...totals.entries()]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function estimateMonthlyFromPlans(counts: Record<WorkspacePlan, number>): number {
  const byPlan: Record<string, number> = { starter: counts.STARTER, pro: counts.PRO, agency: counts.AGENCY };
  return PLANS.reduce((sum, plan) => sum + (byPlan[plan.id] ?? 0) * plan.monthlyPrice, 0);
}

/** Per-key TTL cache. A failed load is never cached. */
export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<string, { at: number; value: Promise<T> }>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value;
      const value = load();
      const entry = { at: now(), value };
      entries.set(key, entry);
      value.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return value;
    }
  };
}

/** Converts Stripe minor units using the currency's own fraction digits (GBP /100, JPY /1). */
export function formatMinor(amountMinor: number, currency: string, locale = "en-GB"): string {
  try {
    const format = new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() });
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
    return format.format(amountMinor / 10 ** digits);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
