import { createTtlCache, netRevenueByCurrency } from "./admin-revenue";
import { monthStartUtc, planFromLookupKey } from "./entitlements";
import type { PlanId } from "./plans";
import { getStripe } from "./stripe";

export type MonthRevenue =
  | { ok: true; totals: { currency: string; amountMinor: number }[]; fetchedAt: Date }
  | { ok: false };

const TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 10_000;
// Per-request options so a timed-out race does not leave paging requests running.
const REQUEST_OPTIONS = { timeout: TIMEOUT_MS, maxNetworkRetries: 0 } as const;
const cache = createTtlCache<MonthRevenue & { ok: true }>(TTL_MS);

async function loadMonthRevenue(now: Date) {
  const start = monthStartUtc(now);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));

  const work = async () => {
    const charges = await getStripe()
      .charges.list({
        created: { gte: Math.floor(start.getTime() / 1000), lt: Math.floor(next.getTime() / 1000) },
        limit: 100
      }, REQUEST_OPTIONS)
      .autoPagingToArray({ limit: 10_000 });
    return {
      ok: true as const,
      totals: netRevenueByCurrency(
        charges.map((c) => ({ amount: c.amount, amountRefunded: c.amount_refunded, paid: c.paid, currency: c.currency }))
      ),
      fetchedAt: new Date()
    };
  };

  return withTimeout(work());
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Stripe request timed out")), TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
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

export type SubscriptionRow = {
  id: string;
  customerId: string;
  status: string;
  plan: PlanId | null;
  interval: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type ChargeRow = {
  id: string;
  customerId: string | null;
  amount: number;
  currency: string;
  status: string;
  paid: boolean;
  refunded: boolean;
  failureMessage: string | null;
  created: Date;
};

export type PaymentsOverview =
  | { ok: true; subscriptions: SubscriptionRow[]; charges: ChargeRow[]; failed: ChargeRow[]; fetchedAt: Date }
  | { ok: false };

const SHOWN_CHARGES = 50;
const paymentsCache = createTtlCache<PaymentsOverview & { ok: true }>(TTL_MS);

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function loadPaymentsOverview(now: Date) {
  const since = Math.floor((now.getTime() - 30 * 24 * 60 * 60 * 1000) / 1000);

  const work = async () => {
    const stripe = getStripe();
    const [subs, rawCharges] = await Promise.all([
      stripe.subscriptions.list({ status: "all", limit: 100 }, REQUEST_OPTIONS).autoPagingToArray({ limit: 2000 }),
      stripe.charges.list({ created: { gte: since }, limit: 100 }, REQUEST_OPTIONS).autoPagingToArray({ limit: 2000 })
    ]);

    const subscriptions: SubscriptionRow[] = subs.map((sub) => {
      const item = sub.items.data[0];
      const ends = sub.items.data.map((i) => i.current_period_end).filter((n): n is number => typeof n === "number");
      return {
        id: sub.id,
        customerId: idOf(sub.customer) ?? "",
        status: sub.status,
        plan: planFromLookupKey(item?.price.lookup_key),
        interval: item?.price.recurring?.interval ?? null,
        currentPeriodEnd: ends.length > 0 ? new Date(Math.min(...ends) * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end
      };
    });

    const all: ChargeRow[] = rawCharges
      .map((c) => ({
        id: c.id,
        customerId: idOf(c.customer),
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        paid: c.paid,
        refunded: c.refunded,
        failureMessage: c.failure_message ?? null,
        created: new Date(c.created * 1000)
      }))
      .sort((a, b) => b.created.getTime() - a.created.getTime());

    return {
      ok: true as const,
      subscriptions,
      charges: all.slice(0, SHOWN_CHARGES),
      failed: all.filter((c) => c.status === "failed"),
      fetchedAt: new Date()
    };
  };

  return withTimeout(work());
}

/** Read-only. Never throws; a failure returns { ok: false } and is not cached. */
export async function getPaymentsOverview(now: Date = new Date()): Promise<PaymentsOverview> {
  try {
    return await paymentsCache.get("payments", () => loadPaymentsOverview(now));
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
    console.error(`[admin] Stripe payments unavailable (${reason.slice(0, 200)})`);
    return { ok: false };
  }
}
