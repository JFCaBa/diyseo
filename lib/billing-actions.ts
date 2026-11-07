"use server";

import { redirect } from "next/navigation";

import { getAppOrigin } from "@/lib/app-origin";
import { auth } from "@/lib/auth";
import { automaticTaxEnabled, checkoutTaxParams } from "@/lib/billing-rules";
import { lookupKey, type BillingInterval } from "@/lib/entitlements";
import { isPlanId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { lockWorkspace } from "@/lib/quota";
import { getStripe } from "@/lib/stripe";

const LIVE = new Set(["active", "trialing", "past_due"]);
const HALF_HOUR_S = 30 * 60;

/** Billing is managed only by the workspace owner, resolved from the session. */
async function requireOwnerWorkspace() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, name: true, stripeCustomerId: true, owner: { select: { email: true, name: true } } }
  });

  if (!workspace) {
    redirect("/");
  }

  return workspace;
}

async function hasLiveSubscription(customerId: string) {
  const page = await getStripe().subscriptions.list({ customer: customerId, limit: 100 });
  return page.data.some((sub) => LIVE.has(sub.status));
}

async function portalUrl(customerId: string) {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getAppOrigin()}/billing`
  });

  return session.url;
}

/**
 * First purchase only. A workspace that already pays is sent to the portal to
 * change plan, so it can never hold two subscriptions from this path. Two clicks
 * at once reuse the same open Checkout Session: the customer and session are
 * resolved under the workspace lock, with idempotency keys for retries.
 */
export async function startCheckout(formData: FormData) {
  const plan = formData.get("plan");
  const interval = formData.get("interval");

  if (!isPlanId(plan) || (interval !== "monthly" && interval !== "annual")) {
    redirect("/billing?error=invalid_plan");
  }

  const workspace = await requireOwnerWorkspace();
  const stripe = getStripe();

  if (workspace.stripeCustomerId && (await hasLiveSubscription(workspace.stripeCustomerId))) {
    redirect(await portalUrl(workspace.stripeCustomerId));
  }

  const price = (await stripe.prices.list({ lookup_keys: [lookupKey(plan, interval as BillingInterval)], active: true, limit: 1 })).data[0];

  if (!price) {
    redirect("/billing?error=price_missing");
  }

  const origin = getAppOrigin();
  const url = await prisma.$transaction(
    async (tx) => {
      await lockWorkspace(tx, workspace.id);
      const current = await tx.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
        select: { stripeCustomerId: true, pendingCheckoutSessionId: true }
      });

      let customerId = current.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create(
          {
            email: workspace.owner.email ?? undefined,
            name: workspace.owner.name ?? workspace.name,
            metadata: { workspaceId: workspace.id }
          },
          { idempotencyKey: `workspace-customer:${workspace.id}` }
        );
        customerId = customer.id;
        await tx.workspace.update({ where: { id: workspace.id }, data: { stripeCustomerId: customerId } });
      }

      if (current.pendingCheckoutSessionId) {
        const pending = await stripe.checkout.sessions.retrieve(current.pendingCheckoutSessionId).catch(() => null);

        if (pending?.status === "open" && pending.metadata?.priceId === price.id && pending.url) {
          return pending.url;
        }
      }

      // Same 30-minute bucket → same key and same params, so a retried request
      // returns the session Stripe already created instead of a second one.
      const bucket = Math.floor(Date.now() / 1000 / HALF_HOUR_S) * HALF_HOUR_S;
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: price.id, quantity: 1 }],
          client_reference_id: workspace.id,
          metadata: { workspaceId: workspace.id, priceId: price.id },
          subscription_data: { metadata: { workspaceId: workspace.id } },
          success_url: `${origin}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/billing`,
          expires_at: bucket + 2 * HALF_HOUR_S,
          ...checkoutTaxParams(automaticTaxEnabled(), true)
        },
        { idempotencyKey: `checkout:${workspace.id}:${price.id}:${bucket}` }
      );

      await tx.workspace.update({ where: { id: workspace.id }, data: { pendingCheckoutSessionId: session.id } });

      if (!session.url) {
        throw new Error("Stripe returned a Checkout Session without a URL.");
      }

      return session.url;
    },
    { timeout: 20_000, maxWait: 10_000 }
  );

  redirect(url);
}

export async function openBillingPortal() {
  const workspace = await requireOwnerWorkspace();

  if (!workspace.stripeCustomerId) {
    redirect("/billing");
  }

  redirect(await portalUrl(workspace.stripeCustomerId));
}
