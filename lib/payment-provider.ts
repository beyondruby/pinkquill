/**
 * Payment Provider Abstraction Layer
 *
 * Strategy pattern for payment providers.
 * Active provider is determined by PAYMENTS_PROVIDER env var.
 * Supports: stripe, placeholder
 */

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
  cardPaymentsEnabled?: boolean;
  transfersEnabled?: boolean;
  country: string | null;
  email: string | null;
  placeholderMode?: boolean;
}

export interface CheckoutResult {
  mode: string;
  /** Stripe: client_secret. Placeholder: null */
  clientToken: string | null;
  paymentReference: string;
  message?: string;
}

export interface CaptureResult {
  success: boolean;
  alreadyProcessed?: boolean;
  status?: string;
  paymentStatus?: string;
  paymentReference?: string;
}

export interface RefundResult {
  success: boolean;
  alreadyRefunded?: boolean;
}

export interface DashboardResult {
  url: string;
  placeholderMode?: boolean;
}

export interface OrderForPayment {
  id: string;
  orderNumber?: string | null;
  buyerId: string;
  buyerEmail?: string;
  buyerName?: string;
  buyerPhone?: string | null;
  amount: number;
  currency: string;
  listingType: string;
  productTitle?: string | null;
  shippingAddress?: Record<string, unknown> | null;
  existingPaymentRef?: string | null;
}

export interface PaymentProviderInterface {
  readonly name: "stripe" | "placeholder";

  // Seller onboarding
  createSellerAccount(userId: string, email: string, profile: { username?: string; displayName?: string }): Promise<OnboardingResult>;
  checkSellerStatus(userId: string): Promise<SellerStatusResult>;
  getSellerDashboardUrl(userId: string): Promise<DashboardResult>;

  // Checkout
  createCheckoutSession(order: OrderForPayment): Promise<CheckoutResult>;
  capturePayment(orderId: string, paymentRef: string): Promise<CaptureResult>;

  // Escrow
  releaseEscrow?(paymentRef: string, orderId: string): Promise<CaptureResult>;

  // Refunds
  refundPayment(paymentRef: string, orderId: string, amount?: number): Promise<RefundResult>;
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
