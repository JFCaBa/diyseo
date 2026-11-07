import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { syncWorkspaceFromStripe } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

/**
 * Stripe sends the buyer here after Checkout. Syncing now means the plan is
 * right on the next page even if the webhook is slow; the webhook does the
 * same sync again later, harmlessly.
 */
export async function GET(request: Request) {
  const back = (query: string) => NextResponse.redirect(new URL(`/billing?${query}`, request.url));
  const sessionId = new URL(request.url).searchParams.get("session_id");
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, stripeCustomerId: true }
  });

  if (!workspace?.stripeCustomerId || !sessionId) {
    return back("error=checkout_missing");
  }

  const checkout = await getStripe().checkout.sessions.retrieve(sessionId).catch(() => null);
  const customerId = typeof checkout?.customer === "string" ? checkout.customer : checkout?.customer?.id;

  // Only the buyer's own session may trigger a sync for this workspace.
  if (!checkout || customerId !== workspace.stripeCustomerId) {
    return back("error=checkout_mismatch");
  }

  await syncWorkspaceFromStripe(workspace.stripeCustomerId);
  await prisma.workspace.update({ where: { id: workspace.id }, data: { pendingCheckoutSessionId: null } });

  return back("checkout=success");
}
