// Billing decisions as pure functions: nothing here imports Stripe or Prisma,
// so the tests need no keys and no database.
import { highestPlan, paidPlanFor, planFromLookupKey, planFromProductId, type WorkspacePlan } from "@/lib/entitlements";
import type { PlanId } from "@/lib/plans";

/** Statuses that keep a paid plan. past_due keeps it while Stripe retries the card. */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/** True when a Stripe subscription status still keeps a paid plan. */
export function isLiveStatus(status: string | null | undefined): boolean {
  return status != null && LIVE_STATUSES.has(status);
}

export type SubscriptionSummary = { status: string; lookupKey: string | null; productId?: string | null };

/**
 * The single rule for what plan a workspace has, from Stripe's live state:
 * COMP never changes; a live subscription sets the plan (the highest if there
 * are several, flagged as a duplicate); otherwise a running trial is kept and
 * anything else is NONE.
 */
export function projectPlan(
  input: { current: string; trialEndsAt: Date | null; subs: SubscriptionSummary[] },
  now: Date
): { plan: WorkspacePlan; status: string | null; duplicate: boolean } {
  const live = input.subs
    .map((sub) => ({ status: sub.status, plan: planFromLookupKey(sub.lookupKey) ?? planFromProductId(sub.productId) }))
    .filter((sub): sub is { status: string; plan: PlanId } => sub.plan !== null && LIVE_STATUSES.has(sub.status));
  const best = highestPlan(live.map((sub) => sub.plan));
  const chosen = best ? live.find((sub) => sub.plan === best)! : null;
  const status = chosen?.status ?? null;
  const duplicate = live.length > 1;

  if (input.current === "COMP") {
    return { plan: "COMP", status, duplicate };
  }

  if (best) {
    return { plan: paidPlanFor(best), status, duplicate };
  }

  const trialRunning = input.trialEndsAt !== null && input.trialEndsAt.getTime() > now.getTime();
  return { plan: trialRunning ? "TRIAL" : "NONE", status: null, duplicate: false };
}

/**
 * Off unless STRIPE_AUTOMATIC_TAX is exactly "true": Checkout fails when it
 * asks for automatic tax before Stripe Tax is set up. Same contract as
 * mycarplate-api src/lib/stripeTax.ts.
 */
export const automaticTaxEnabled = (env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): boolean =>
  env.STRIPE_AUTOMATIC_TAX === "true";

/** The billing address locates the customer for VAT; a VAT number makes an EU business sale a reverse charge. */
export const checkoutTaxParams = (enabled: boolean, existingCustomer: boolean) =>
  enabled
    ? {
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
        billing_address_collection: "required" as const,
        ...(existingCustomer ? { customer_update: { address: "auto" as const, name: "auto" as const } } : {})
      }
    : {};

/**
 * What the Checkout return page may do: sync only for a completed session that
 * belongs to this workspace's customer.
 */
export function checkoutReturnOutcome(
  checkout: { status: string | null; customerId: string | null } | null,
  stripeCustomerId: string | null
): "sync" | "incomplete" | "mismatch" {
  if (!checkout || !stripeCustomerId || checkout.customerId !== stripeCustomerId) return "mismatch";
  return checkout.status === "complete" ? "sync" : "incomplete";
}

const HALF_HOUR_S = 30 * 60;

/**
 * Checkout Sessions are keyed per 30-minute bucket so a retried request gets
 * the same session back; the parameters must then be identical, so the expiry
 * is fixed per bucket. It lands 60-90 minutes ahead: well past Stripe's
 * 30-minute minimum even with clock skew.
 */
export function checkoutWindow(nowSeconds: number): { bucket: number; expiresAt: number } {
  const bucket = Math.floor(nowSeconds / HALF_HOUR_S) * HALF_HOUR_S;
  return { bucket, expiresAt: bucket + 3 * HALF_HOUR_S };
}

/**
 * What to do with a workspace's remembered Checkout Session before its owner
 * joins another team: a finished-without-paying (or unknown) session is
 * cleared, an open one is expired first so it can no longer be paid, and a
 * completed one stays (its subscription blocks the join).
 */
export function staleCheckoutAction(status: string | null): "clear" | "expire_then_clear" | "keep" {
  if (status === "complete") return "keep";
  if (status === "open") return "expire_then_clear";
  return "clear";
}
