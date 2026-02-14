import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    _stripe = new Stripe(key, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * @deprecated Use getStripeServer() instead for lazy initialization.
 * Kept as a convenience alias for API routes.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripeServer() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Platform fee rates
export const STRIPE_FEES = {
  product: 0.08, // 8% flat on products
  service: 0.10, // 10% flat on commissions
} as const;

// Stripe Connect account type
export const CONNECT_ACCOUNT_TYPE = "express" as const;

// Currency
export const DEFAULT_CURRENCY = "usd" as const;

// Minimum payout amount in cents
export const MIN_PAYOUT_AMOUNT = 100; // $1.00
