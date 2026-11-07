// Billing decisions as pure functions: nothing here imports Stripe or Prisma,
// so the tests need no keys and no database.
import { highestPlan, paidPlanFor, planFromLookupKey, type WorkspacePlan } from "@/lib/entitlements";
import type { PlanId } from "@/lib/plans";

/** Statuses that keep a paid plan. past_due keeps it while Stripe retries the card. */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type SubscriptionSummary = { status: string; lookupKey: string | null };

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
    .map((sub) => ({ status: sub.status, plan: planFromLookupKey(sub.lookupKey) }))
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
