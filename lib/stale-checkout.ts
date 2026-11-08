import { staleCheckoutAction } from "@/lib/billing-rules";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getMembership } from "@/lib/workspace-membership";

/**
 * Before a user joins a team: an abandoned Checkout on the workspace they own
 * must not block the join. Asks Stripe about the remembered session and clears
 * it unless it was paid. Any Stripe error leaves it untouched, so the join
 * stays blocked rather than dropping a session that might still be paid.
 */
export async function releaseStaleCheckout(userId: string): Promise<void> {
  // Only the workspace the user owns is dropped on joining; a member has nothing to release.
  const membership = await getMembership(userId);
  if (membership?.role !== "OWNER") return;
  const workspace = await prisma.workspace.findUnique({
    where: { id: membership.workspaceId },
    select: { id: true, pendingCheckoutSessionId: true }
  });
  const sessionId = workspace?.pendingCheckoutSessionId;
  if (!workspace || !sessionId) return;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const action = staleCheckoutAction(session.status);
    if (action === "keep") return;
    if (action === "expire_then_clear") await stripe.checkout.sessions.expire(sessionId);
  } catch (error) {
    console.error("team_stale_checkout_failed", { code: (error as { code?: string }).code ?? "unknown" });
    return;
  }

  // Conditional: a Checkout started meanwhile keeps its newer reference.
  await prisma.workspace.updateMany({
    where: { id: workspace.id, pendingCheckoutSessionId: sessionId },
    data: { pendingCheckoutSessionId: null }
  });
}
