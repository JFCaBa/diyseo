import "server-only";

import { getStripe } from "@/lib/stripe";

export { checkoutCurrency } from "@/lib/billing-currency";

/** The currency Stripe has fixed on this customer, or null before their first charge. */
export async function stripeCustomerCurrency(customerId: string): Promise<string | null> {
  const customer = await getStripe().customers.retrieve(customerId);
  return "deleted" in customer && customer.deleted ? null : (customer.currency ?? null);
}
