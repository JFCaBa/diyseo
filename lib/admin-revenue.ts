import { planFromLookupKey, planFromProductId, type WorkspacePlan } from "./entitlements";
import { PLANS, type PlanId } from "./plans";

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

/** Same fallback as lib/billing-rules.ts: lookup key first, then the price's product id (string or expanded). */
export function planFromPrice(
  price: { lookup_key?: string | null; product?: string | { id: string } | null } | null | undefined
): PlanId | null {
  if (!price) return null;
  const productId = typeof price.product === "string" ? price.product : price.product?.id;
  return planFromLookupKey(price.lookup_key) ?? planFromProductId(productId);
}

/** Remembers failures per key for ttlMs, so a down upstream is not retried on every page load. */
export function createNegativeCache(ttlMs: number, now: () => number = Date.now) {
  const failedAt = new Map<string, number>();
  return {
    isBlocked(key: string): boolean {
      const at = failedAt.get(key);
      if (at === undefined) return false;
      if (now() - at < ttlMs) return true;
      failedAt.delete(key);
      return false;
    },
    mark(key: string) {
      failedAt.set(key, now());
    }
  };
}

type PagedSource<T> = { autoPagingEach(cb: (item: T) => boolean | void | Promise<boolean | void>): Promise<void> };

/** Collects up to `cap` items; paging stops (callback returns false) once `stop.stopped` is set or the cap is hit. */
export async function collectPaged<T>(source: PagedSource<T>, stop: { stopped: boolean }, cap: number): Promise<T[]> {
  const items: T[] = [];
  await source.autoPagingEach((item) => {
    if (stop.stopped || items.length >= cap) return false;
    items.push(item);
    if (items.length >= cap) return false;
  });
  return items;
}

/**
 * Races `work` against a timeout. On timeout the stop flag is set (so paging stops) and a late
 * rejection of the abandoned work is swallowed instead of becoming an unhandled rejection.
 */
export async function withTimeout<T>(work: (stop: { stopped: boolean }) => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = { stopped: false };
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      stop.stopped = true;
      reject(new Error("Stripe request timed out"));
    }, ms);
  });
  const running = work(stop);
  running.catch(() => {});
  try {
    return await Promise.race([running, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
