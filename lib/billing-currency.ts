import type { UiLocale } from "@/lib/i18n/locale";

/** The currencies every live plan price is sold in (GBP prices with an EUR `currency_options` entry). */
export type PlanCurrency = "gbp" | "eur";

function isPlanCurrency(value: unknown): value is PlanCurrency {
  return value === "gbp" || value === "eur";
}

/**
 * The currency a workspace is shown and charged in. A Stripe customer that already has a currency keeps it
 * (Stripe can't mix currencies on one customer); otherwise the Spanish and Portuguese UI pay in euros and English in pounds.
 */
export function checkoutCurrency(input: { customerCurrency: string | null | undefined; locale: UiLocale }): PlanCurrency {
  if (isPlanCurrency(input.customerCurrency)) return input.customerCurrency;
  return input.locale === "en" ? "gbp" : "eur";
}

type PendingSession = { status: string | null; url: string | null; currency: string | null; metadata: Record<string, string> | null };

/** An open Checkout Session is reused only for the same price in the same currency. */
export function canReusePending(pending: PendingSession | null, priceId: string, currency: PlanCurrency): boolean {
  return Boolean(pending && pending.status === "open" && pending.url && pending.metadata?.priceId === priceId && pending.currency === currency);
}

/**
 * Same request retried → same key → Stripe returns the session it already created. The session being replaced is
 * part of the key, so switching price or currency and back within the 30-minute bucket gets a fresh session instead
 * of the one that switch expired.
 */
export function checkoutIdempotencyKey(
  workspaceId: string,
  priceId: string,
  currency: PlanCurrency,
  bucket: number,
  replacedSessionId: string | null
): string {
  return `checkout:${workspaceId}:${priceId}:${currency}:${bucket}:${replacedSessionId ?? "none"}`;
}
