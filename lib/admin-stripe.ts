import { createTtlCache, netRevenueByCurrency } from "./admin-revenue";
import { monthStartUtc } from "./entitlements";
import { getStripe } from "./stripe";

export type MonthRevenue =
  | { ok: true; totals: { currency: string; amountMinor: number }[]; fetchedAt: Date }
  | { ok: false };

const TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 10_000;
const cache = createTtlCache<MonthRevenue & { ok: true }>(TTL_MS);

async function loadMonthRevenue(now: Date) {
  const start = monthStartUtc(now);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const work = async () => {
    const charges = await getStripe()
      .charges.list({
        created: { gte: Math.floor(start.getTime() / 1000), lt: Math.floor(next.getTime() / 1000) },
        limit: 100
      })
      .autoPagingToArray({ limit: 10_000 });
    return {
      ok: true as const,
      totals: netRevenueByCurrency(
        charges.map((c) => ({ amount: c.amount, amountRefunded: c.amount_refunded, paid: c.paid, currency: c.currency }))
      ),
      fetchedAt: new Date()
    };
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Stripe request timed out")), TIMEOUT_MS);
  });
  try {
    return await Promise.race([work(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Never throws; a failure returns { ok: false } and is not cached. */
export async function getMonthRevenue(now: Date = new Date()): Promise<MonthRevenue> {
  const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  try {
    return await cache.get(key, () => loadMonthRevenue(now));
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
    console.error(`[admin] Stripe revenue unavailable (${reason.slice(0, 200)})`);
    return { ok: false };
  }
}
