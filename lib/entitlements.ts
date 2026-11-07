import { PLANS, type PlanId, type PlanLimits } from "@/lib/plans";

/** What a workspace is allowed to do. TRIAL and NONE are not for sale; COMP is never billed. */
export type WorkspacePlan = "TRIAL" | "STARTER" | "PRO" | "AGENCY" | "COMP" | "NONE";

export type BillingInterval = "monthly" | "annual";

export const TRIAL_DAYS = 7;

/** Every new workspace gets the same trial; existing ones were migrated to COMP. */
export function newTrialEndsAt(now: Date): Date {
  return new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

const PAID: Record<PlanId, WorkspacePlan> = { starter: "STARTER", pro: "PRO", agency: "AGENCY" };
const NO_ACCESS: PlanLimits = { sites: 0, articlesPerMonth: 0, translations: false };

export function paidPlanFor(id: PlanId): WorkspacePlan {
  return PAID[id];
}

/**
 * The plan in force right now. A trial ends at `trialEndsAt` (that instant counts
 * as ended), and a trial with no end date grants nothing. Unknown values grant
 * nothing either, so a bad row can never unlock unlimited use.
 */
export function effectivePlan(ws: { plan: string; trialEndsAt: Date | null }, now: Date): WorkspacePlan {
  switch (ws.plan) {
    case "TRIAL":
      return ws.trialEndsAt && ws.trialEndsAt.getTime() > now.getTime() ? "TRIAL" : "NONE";
    case "STARTER":
    case "PRO":
    case "AGENCY":
    case "COMP":
      return ws.plan;
    default:
      return "NONE";
  }
}

/** `null` means no limits (COMP). The trial gets Pro's limits. */
export function limitsFor(plan: WorkspacePlan): PlanLimits | null {
  if (plan === "COMP") return null;
  if (plan === "NONE") return NO_ACCESS;
  const id: PlanId = plan === "TRIAL" ? "pro" : (plan.toLowerCase() as PlanId);
  return PLANS.find((p) => p.id === id)!.limits;
}

/** Quotas reset at the start of each calendar month, UTC. */
export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Stripe prices are found by lookup key, never by hard-coded price id. */
export function lookupKey(plan: PlanId, interval: BillingInterval): string {
  return `diyseo_${plan}_${interval}`;
}

export function planFromLookupKey(key: string | null | undefined): PlanId | null {
  const match = /^diyseo_(starter|pro|agency)_(monthly|annual)$/.exec(key ?? "");
  return match ? (match[1] as PlanId) : null;
}

const RANK: PlanId[] = ["starter", "pro", "agency"];

export function highestPlan(plans: PlanId[]): PlanId | null {
  return plans.reduce<PlanId | null>((best, p) => (best === null || RANK.indexOf(p) > RANK.indexOf(best) ? p : best), null);
}
