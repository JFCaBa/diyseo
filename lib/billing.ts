import { projectPlan } from "@/lib/billing-rules";
import type { WorkspacePlan } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { lockWorkspace } from "@/lib/quota";
import { getStripe } from "@/lib/stripe";

type Summary = { status: string; lookupKey: string | null; productId: string | null };

async function listSubscriptionSummaries(customerId: string): Promise<Summary[]> {
  // Default status filter: everything except canceled. Ours are never more
  // than a handful per customer, so one page is the whole picture.
  const page = await getStripe().subscriptions.list({ customer: customerId, limit: 100 });

  return page.data.map((sub) => {
    const prices = sub.items.data.map((item) => item.price);
    const product = prices.map((price) => (typeof price.product === "string" ? price.product : price.product.id)).find((id) => id.startsWith("diyseo_"));

    return {
      status: sub.status,
      lookupKey: prices.map((price) => price.lookup_key).find((key) => key?.startsWith("diyseo_")) ?? null,
      productId: product ?? null
    };
  });
}

/**
 * Recomputes a workspace's plan from Stripe. The only writer of `plan` for
 * billed workspaces; called by the webhook and the Checkout return page, in
 * any order and any number of times. The Stripe read and the write happen
 * under the workspace lock, so an older read can never overwrite a newer one.
 * Returns null for a customer that belongs to no workspace.
 */
export async function syncWorkspaceFromStripe(customerId: string): Promise<WorkspacePlan | null> {
  const workspace = await prisma.workspace.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });

  if (!workspace) {
    return null;
  }

  return prisma.$transaction(
    async (tx) => {
      await lockWorkspace(tx, workspace.id);
      const current = await tx.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
        select: { plan: true, trialEndsAt: true }
      });
      const subs = await listSubscriptionSummaries(customerId);
      const projected = projectPlan({ current: current.plan, trialEndsAt: current.trialEndsAt, subs }, new Date());

      if (projected.duplicate) {
        console.warn("billing_duplicate_subscriptions", { workspaceId: workspace.id });
      }

      await tx.workspace.update({
        where: { id: workspace.id },
        data: { plan: projected.plan, subscriptionStatus: projected.status, planSyncedAt: new Date() }
      });

      return projected.plan;
    },
    { timeout: 20_000, maxWait: 10_000 }
  );
}

/** For the billing page: whether Stripe holds more than one live subscription. */
export async function hasDuplicateSubscriptions(customerId: string): Promise<boolean> {
  const subs = await listSubscriptionSummaries(customerId);
  return projectPlan({ current: "NONE", trialEndsAt: null, subs }, new Date()).duplicate;
}
