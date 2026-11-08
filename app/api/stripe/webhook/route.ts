import { NextResponse } from "next/server";

import { clearExpiredCheckout, syncWorkspaceFromStripe } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

const SYNC_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted"
]);

function customerIdOf(object: unknown): string | null {
  const customer = (object as { customer?: unknown }).customer;

  if (typeof customer === "string") return customer;
  if (customer && typeof customer === "object" && "id" in customer) return String((customer as { id: unknown }).id);
  return null;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");

  if (!secret || !signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event;

  try {
    // The raw body: re-serialized JSON would break the signature.
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.expired") {
    try {
      await clearExpiredCheckout(event.data.object.id);
      return NextResponse.json({ received: true });
    } catch (error) {
      // 500 so Stripe retries; clearing is idempotent.
      console.error("stripe_webhook_sync_failed", { type: event.type, message: error instanceof Error ? error.message : "unknown" });
      return NextResponse.json({ error: "Sync failed." }, { status: 500 });
    }
  }

  if (!SYNC_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const customerId = customerIdOf(event.data.object);

  if (!customerId) {
    return NextResponse.json({ received: true });
  }

  try {
    await syncWorkspaceFromStripe(customerId);
    return NextResponse.json({ received: true });
  } catch (error) {
    // 500 so Stripe retries; the sync is idempotent.
    console.error("stripe_webhook_sync_failed", { type: event.type, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
