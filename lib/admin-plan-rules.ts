// Admin plan changes as pure decisions: no Prisma, no Stripe. The caller applies
// an ok decision and writes the AdminAuditLog row.
import { isLiveStatus } from "@/lib/billing-rules";

export const EXTEND_PRESETS = [7, 14] as const;

export type WorkspaceState = {
  plan: string;
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  /** Computed server-side: the workspace owner's email is in ALLOWED_EMAILS (sign-in re-promotes them to COMP). */
  ownerListed: boolean;
};

const LISTED_OWNER_REASON =
  "The owner is listed in ALLOWED_EMAILS, so sign-in puts them back on COMP; remove them from that list first.";

export type Decision =
  | { ok: true; plan: "COMP" | "TRIAL" | "NONE"; trialEndsAt: Date | null }
  | { ok: false; reason: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export function decideGrantComp(ws: WorkspaceState): Decision {
  if (ws.plan === "COMP") return { ok: false, reason: "Workspace is already COMP." };
  if (isLiveStatus(ws.subscriptionStatus)) {
    return { ok: false, reason: "Workspace has a live subscription: cancel the subscription in Stripe first." };
  }
  return { ok: true, plan: "COMP", trialEndsAt: null };
}

export function decideRevokeComp(ws: WorkspaceState, now: Date): Decision {
  if (ws.plan !== "COMP") return { ok: false, reason: "Workspace is not COMP." };
  if (ws.ownerListed) return { ok: false, reason: LISTED_OWNER_REASON };
  if (isLiveStatus(ws.subscriptionStatus)) {
    return { ok: false, reason: "Workspace has a live subscription: resolve it in Stripe first." };
  }
  if (ws.trialEndsAt && ws.trialEndsAt.getTime() > now.getTime()) {
    return { ok: true, plan: "TRIAL", trialEndsAt: ws.trialEndsAt };
  }
  return { ok: true, plan: "NONE", trialEndsAt: ws.trialEndsAt };
}

export function decideExtendTrial(ws: WorkspaceState, days: number, now: Date): Decision {
  if (!(EXTEND_PRESETS as readonly number[]).includes(days)) {
    return { ok: false, reason: `Extension must be one of ${EXTEND_PRESETS.join(", ")} days.` };
  }
  if (ws.plan === "COMP") return { ok: false, reason: "COMP workspaces have no trial to extend." };
  if (ws.ownerListed) return { ok: false, reason: LISTED_OWNER_REASON };
  if (isLiveStatus(ws.subscriptionStatus)) {
    return { ok: false, reason: "Workspace has a live subscription: a trial cannot be extended." };
  }
  const base = ws.trialEndsAt && ws.trialEndsAt.getTime() > now.getTime() ? ws.trialEndsAt : now;
  return { ok: true, plan: "TRIAL", trialEndsAt: new Date(base.getTime() + days * DAY_MS) };
}

/**
 * A Grant COMP must not race a Stripe Checkout the customer can still pay.
 * `status` is the pending Checkout Session's status (null/undefined when the
 * workspace has none); `verified` is false when Stripe could not be queried.
 */
export function checkoutBlocksGrant(
  status: string | null | undefined,
  verified: boolean
): { blocked: boolean; reason?: string } {
  if (!verified) return { blocked: true, reason: "Could not verify the Stripe Checkout state; try again in a minute." };
  if (status === "open") {
    return { blocked: true, reason: "A Stripe Checkout is in progress for this workspace; wait until it completes or expires." };
  }
  return { blocked: false };
}
