import { NextResponse } from "next/server";

import { syncWorkspaceFromStripe } from "@/lib/billing";
import { checkoutReturnOutcome } from "@/lib/billing-rules";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { requireOwner } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

/**
 * Stripe sends the buyer here after Checkout. Syncing now means the plan is
 * right on the next page even if the webhook is slow; the webhook does the
 * same sync again later, harmlessly.
 */
export async function GET(request: Request) {
  const back = (query: string) => NextResponse.redirect(new URL(`/billing?${query}`, request.url));
  const sessionId = new URL(request.url).searchParams.get("session_id");
  const owner = await requireOwner().catch((error: Error) => error);

  if (owner instanceof Error) {
    return owner.message === "Forbidden" ? back("error=owner_only") : NextResponse.redirect(new URL("/", request.url));
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: owner.workspaceId },
    select: { id: true, stripeCustomerId: true }
  });

  if (!workspace?.stripeCustomerId || !sessionId) {
    return back("error=checkout_missing");
  }

  const checkout = await getStripe().checkout.sessions.retrieve(sessionId).catch(() => null);
  const customerId = typeof checkout?.customer === "string" ? checkout.customer : (checkout?.customer?.id ?? null);
  const outcome = checkoutReturnOutcome(checkout ? { status: checkout.status, customerId } : null, workspace.stripeCustomerId);

  // Only the buyer's own, completed session may trigger a sync.
  if (outcome !== "sync") {
    return back(outcome === "incomplete" ? "error=checkout_incomplete" : "error=checkout_mismatch");
  }

  await syncWorkspaceFromStripe(workspace.stripeCustomerId);
  // Conditional: an old session must not clear the reference to a newer one.
  await prisma.workspace.updateMany({
    where: { id: workspace.id, pendingCheckoutSessionId: sessionId },
    data: { pendingCheckoutSessionId: null }
  });

  return back("checkout=success");
}
