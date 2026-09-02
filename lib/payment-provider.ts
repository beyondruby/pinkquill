/**
 * Payment Provider Abstraction Layer
 *
 * Strategy pattern for payment providers.
 * Active provider is determined by PAYMENTS_PROVIDER env var.
 *
 * Architecture: Platform is merchant of record.
 * - All payments go through the platform's Stripe account
 * - Sellers receive payouts via Stripe Transfers after order fulfillment
 * - Seller Connect accounts are for payouts only (not for payment collection)
 */

// ============================================================================
// RESULT INTERFACES
// ============================================================================

export interface OnboardingResult {
  url: string;
  accountId?: string;
  placeholderMode?: boolean;
}

export interface SellerStatusResult {
  provider: string;
  hasAccount: boolean;
  accountId: string | null;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  country: string | null;
  email: string | null;
  placeholderMode?: boolean;
}

export interface DashboardResult {
  url: string;
  placeholderMode?: boolean;
}

export interface CheckoutSessionResult {
  mode: string;
  /** Checkout Session client_secret for embedded mode */
  clientSecret: string | null;
  /** Checkout Session ID */
  sessionId: string;
  message?: string;
}

export interface TransferRequest {
  /** payouts.id — also the idempotency key */
  payoutId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  /** Connected account id */
  destinationAccountId: string;
  /** Charge that funded this payout; lets Stripe transfer from pending balance */
  sourceChargeId?: string | null;
  metadata?: Record<string, string>;
}

export interface TransferResult {
  transferId: string;
  balanceTransactionId: string | null;
  amountCents: number;
}

/** Thrown by createTransfer when the destination cannot receive money (not a retry). */
export class TransferBlockedError extends Error {
  constructor(public readonly reason: string, message?: string) {
    super(message || reason);
    this.name = "TransferBlockedError";
  }
}

export interface RefundRequest {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  metadata?: Record<string, string>;
}

export interface RefundResult {
  refundId: string;
  amountCents: number;
  status: string | null;
}

export interface ReversalRequest {
  transferId: string;
  amountCents: number;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface ReversalResult {
  reversalId: string;
  amountCents: number;
}

// ============================================================================
// ORDER INPUT
// ============================================================================

export interface OrderForCheckout {
  id: string;
  orderNumber?: string | null;
  buyerId: string;
  buyerEmail?: string;
  buyerName?: string;
  /** Order amount (goods/service + shipping − discount), excluding the buyer fee */
  amount: number;
  /** Buyer-side processing fee charged on top of `amount` */
  buyerFee: number;
  /** Listing currency (USD) */
  currency: string;
  /** Settlement-currency charge (lib/fx.ts). When absent, charge in `currency`. */
  charge?: {
    currency: string;
    amountCents: number;
    feeCents: number;
    rate: number;
  };
  listingType: string;
  productTitle?: string | null;
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface PaymentProviderInterface {
  readonly name: "stripe" | "placeholder";

  // Seller onboarding (for payouts only — not needed for payment collection)
  createSellerAccount(
    userId: string,
    email: string,
    profile: { username?: string; displayName?: string },
    /** ISO-3166 alpha-2; drives cross-border (recipient) agreement for non-platform countries */
    country: string
  ): Promise<OnboardingResult>;
  checkSellerStatus(userId: string): Promise<SellerStatusResult>;
  getSellerDashboardUrl(userId: string): Promise<DashboardResult>;

  // Checkout — creates embedded checkout session on platform's account
  createCheckoutSession(order: OrderForCheckout): Promise<CheckoutSessionResult>;

  // Transfers — one per released payout (called by the payout worker only)
  createTransfer(request: TransferRequest): Promise<TransferResult>;

  // Refunds / reversals — money movement only; bookkeeping lives in the RPCs
  createRefund(request: RefundRequest): Promise<RefundResult>;
  reverseTransfer(request: ReversalRequest): Promise<ReversalResult>;
}

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

import { getPaymentProvider, type PaymentProvider } from "@/lib/payments";
import { PlaceholderProvider } from "@/lib/providers/placeholder-provider";
import { StripeProvider } from "@/lib/providers/stripe-provider";

let _providerInstance: PaymentProviderInterface | null = null;
let _providerName: PaymentProvider | null = null;

function createProviderInstance(providerName: PaymentProvider): PaymentProviderInterface {
  switch (providerName) {
    case "stripe": {
      return new StripeProvider();
    }
    default: {
      return new PlaceholderProvider();
    }
  }
}

/**
 * Returns a payment provider instance for a specific provider name.
 * Cached per process and refreshed if requested provider changes.
 */
export function getProviderByName(providerName: PaymentProvider): PaymentProviderInterface {
  if (_providerInstance && _providerName === providerName) return _providerInstance;
  _providerInstance = createProviderInstance(providerName);
  _providerName = providerName;
  return _providerInstance;
}

/**
 * Returns the active payment provider instance based on PAYMENTS_PROVIDER env var.
 * Lazy-instantiated and cached for the lifetime of the process.
 */
export function getActiveProvider(): PaymentProviderInterface {
  const providerName = getPaymentProvider();

  if (process.env.NODE_ENV === "production" && providerName === "placeholder") {
    throw new Error(
      "Placeholder payment provider cannot be used in production. Set PAYMENTS_PROVIDER to 'stripe' or 'paypal'."
    );
  }

  return getProviderByName(providerName);
}
