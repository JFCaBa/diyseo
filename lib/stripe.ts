import Stripe from "stripe";

let client: Stripe | null = null;

/** Created on first use, so building the app never needs the key. */
export function getStripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();

    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set.");
    }

    client = new Stripe(key);
  }

  return client;
}
