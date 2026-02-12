/**
 * Payment Provider Abstraction Layer
 *
 * Strategy pattern for payment providers.
 * Active provider is determined by PAYMENTS_PROVIDER env var.
 * Supports: paypal, stripe, placeholder
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
  country: string | null;
  email: string | null;
  placeholderMode?: boolean;
}

export interface CheckoutResult {
  mode: string;
  /** Stripe: client_secret. PayPal: order ID for approval. Placeholder: null */
  clientToken: string | null;
  paymentReference: string;
  /** PayPal: approval URL to redirect buyer */
  approvalUrl?: string | null;
  message?: string;
}

export interface CaptureResult {
  success: boolean;
  alreadyProcessed?: boolean;
  status?: string;
  paymentStatus?: string;
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
  buyerId: string;
  buyerEmail?: string;
  amount: number;
  currency: string;
  listingType: string;
  existingPaymentRef?: string | null;
}

export interface PaymentProviderInterface {
  readonly name: "stripe" | "paypal" | "placeholder";

  // Seller onboarding
  createSellerAccount(userId: string, email: string, profile: { username?: string; displayName?: string }): Promise<OnboardingResult>;
  checkSellerStatus(userId: string): Promise<SellerStatusResult>;
  getSellerDashboardUrl(userId: string): Promise<DashboardResult>;

  // Checkout
  createCheckoutSession(order: OrderForPayment): Promise<CheckoutResult>;
  capturePayment(orderId: string, paymentRef: string): Promise<CaptureResult>;

  // Refunds
  refundPayment(paymentRef: string, orderId: string, amount?: number): Promise<RefundResult>;
}

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

import { getPaymentProvider, type PaymentProvider } from "@/lib/payments";

let _providerInstance: PaymentProviderInterface | null = null;
let _providerName: PaymentProvider | null = null;

/**
 * Returns the active payment provider instance based on PAYMENTS_PROVIDER env var.
 * Lazy-instantiated and cached for the lifetime of the process.
 */
export function getActiveProvider(): PaymentProviderInterface {
  const current = getPaymentProvider();
  if (_providerInstance && _providerName === current) return _providerInstance;

  switch (current) {
    case "stripe": {
      const { StripeProvider } = require("@/lib/providers/stripe-provider");
      _providerInstance = new StripeProvider();
      break;
    }
    case "paypal": {
      const { PayPalProvider } = require("@/lib/providers/paypal-provider");
      _providerInstance = new PayPalProvider();
      break;
    }
    default: {
      const { PlaceholderProvider } = require("@/lib/providers/placeholder-provider");
      _providerInstance = new PlaceholderProvider();
      break;
    }
  }

  _providerName = current;
  return _providerInstance!;
}
