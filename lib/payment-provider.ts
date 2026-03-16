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

export interface TransferResult {
  success: boolean;
  transferId?: string;
  /** Cents transferred to seller */
  amount?: number;
  /** Cents kept by platform */
  platformFee?: number;
  alreadyTransferred?: boolean;
  /** Seller hasn't completed Connect onboarding yet */
  pendingOnboarding?: boolean;
}

export interface RefundResult {
  success: boolean;
  alreadyRefunded?: boolean;
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
  amount: number;
  currency: string;
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
    profile: { username?: string; displayName?: string }
  ): Promise<OnboardingResult>;
  checkSellerStatus(userId: string): Promise<SellerStatusResult>;
  getSellerDashboardUrl(userId: string): Promise<DashboardResult>;

  // Checkout — creates embedded checkout session on platform's account
  createCheckoutSession(order: OrderForCheckout): Promise<CheckoutSessionResult>;

  // Transfers — pay seller after order completion
  transferToSeller(orderId: string): Promise<TransferResult>;

  // Refunds — refund buyer, reverse transfer if needed
  refundPayment(orderId: string): Promise<RefundResult>;
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
  return getProviderByName(getPaymentProvider());
}
