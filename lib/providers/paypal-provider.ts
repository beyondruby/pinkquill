/**
 * PayPal Commerce Platform Provider
 *
 * Implements PaymentProviderInterface using PayPal REST API v2:
 * - Orders API for checkout (create/capture)
 * - Partner Referrals for seller onboarding
 * - Manual capture (authorize then capture) for commission escrow
 */

import { paypalFetch } from "@/lib/paypal";
import { supabaseAdmin } from "@/lib/supabase-server";
import type {
  PaymentProviderInterface,
  OnboardingResult,
  SellerStatusResult,
  DashboardResult,
  CheckoutResult,
  CaptureResult,
  RefundResult,
  OrderForPayment,
} from "@/lib/payment-provider";

// PayPal API response types
interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string; method: string }>;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string }>;
      authorizations?: Array<{ id: string; status: string }>;
    };
  }>;
}

interface PayPalPartnerReferral {
  links: Array<{ rel: string; href: string }>;
}

interface PayPalMerchantStatus {
  merchant_id: string;
  tracking_id: string;
  products?: Array<{ name: string; vetting_status: string }>;
  payments_receivable: boolean;
  primary_email_confirmed: boolean;
  oauth_integrations?: Array<{ oauth_third_party: Array<{ partner_client_id: string }> }>;
}

export class PayPalProvider implements PaymentProviderInterface {
  readonly name = "paypal" as const;

  // ========== SELLER ONBOARDING ==========

  async createSellerAccount(
    userId: string,
    email: string,
    profile: { username?: string; displayName?: string }
  ): Promise<OnboardingResult> {
    const partnerId = process.env.PAYPAL_CLIENT_ID;
    if (!partnerId) throw new Error("Missing PAYPAL_CLIENT_ID");

    const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Check if already has a seller account
    const { data: existing } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (existing?.paypal_merchant_id && existing?.onboarding_complete) {
      return { url: `${origin}/seller/onboarding?success=true`, accountId: existing.paypal_merchant_id };
    }

    // Create Partner Referral for seller onboarding
    const referral = await paypalFetch<PayPalPartnerReferral>("/v2/customer/partner-referrals", {
      method: "POST",
      body: {
        tracking_id: userId,
        partner_config_override: {
          return_url: `${origin}/seller/onboarding?success=true`,
          return_url_description: "Return to PinkQuill after PayPal setup",
          action_renewal_url: `${origin}/seller/onboarding?refresh=true`,
        },
        operations: [
          {
            operation: "API_INTEGRATION",
            api_integration_preference: {
              rest_api_integration: {
                integration_method: "PAYPAL",
                integration_type: "THIRD_PARTY",
                third_party_details: {
                  features: ["PAYMENT", "REFUND", "PARTNER_FEE"],
                },
              },
            },
          },
        ],
        products: ["EXPRESS_CHECKOUT"],
        legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
        email_address: email,
      },
      idempotencyKey: `onboard_${userId}`,
    });

    const actionUrl = referral.links.find((l) => l.rel === "action_url")?.href;
    if (!actionUrl) throw new Error("PayPal did not return an onboarding URL");

    // Save/update seller account record
    if (existing) {
      await supabaseAdmin
        .from("seller_accounts")
        .update({
          paypal_email: email,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      await supabaseAdmin.from("seller_accounts").insert({
        user_id: userId,
        paypal_email: email,
        onboarding_complete: false,
        charges_enabled: false,
        payouts_enabled: false,
      });
    }

    return { url: actionUrl };
  }

  async checkSellerStatus(userId: string): Promise<SellerStatusResult> {
    const { data: account } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!account) {
      return {
        provider: "paypal",
        hasAccount: false,
        accountId: null,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        country: null,
        email: null,
      };
    }

    // If we have a merchant ID, check live status with PayPal
    if (account.paypal_merchant_id) {
      try {
        const partnerId = process.env.PAYPAL_CLIENT_ID;
        const status = await paypalFetch<PayPalMerchantStatus>(
          `/v1/customer/partners/${partnerId}/merchant-integrations/${account.paypal_merchant_id}`
        );

        const chargesEnabled = status.payments_receivable && status.primary_email_confirmed;
        const onboardingComplete = chargesEnabled;

        await supabaseAdmin
          .from("seller_accounts")
          .update({
            onboarding_complete: onboardingComplete,
            charges_enabled: chargesEnabled,
            payouts_enabled: chargesEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        return {
          provider: "paypal",
          hasAccount: true,
          accountId: account.paypal_merchant_id,
          onboardingComplete,
          chargesEnabled,
          payoutsEnabled: chargesEnabled,
          country: account.country || null,
          email: account.paypal_email || null,
        };
      } catch {
        // If PayPal API fails, return cached status
      }
    }

    // Try to fetch merchant ID from tracking_id if not stored yet
    if (!account.paypal_merchant_id) {
      try {
        const partnerId = process.env.PAYPAL_CLIENT_ID;
        const status = await paypalFetch<PayPalMerchantStatus>(
          `/v1/customer/partners/${partnerId}/merchant-integrations?tracking_id=${userId}`
        );

        if (status.merchant_id) {
          const chargesEnabled = status.payments_receivable && status.primary_email_confirmed;

          await supabaseAdmin
            .from("seller_accounts")
            .update({
              paypal_merchant_id: status.merchant_id,
              onboarding_complete: chargesEnabled,
              charges_enabled: chargesEnabled,
              payouts_enabled: chargesEnabled,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          return {
            provider: "paypal",
            hasAccount: true,
            accountId: status.merchant_id,
            onboardingComplete: chargesEnabled,
            chargesEnabled,
            payoutsEnabled: chargesEnabled,
            country: account.country || null,
            email: account.paypal_email || null,
          };
        }
      } catch {
        // Merchant not found yet — still pending
      }
    }

    return {
      provider: "paypal",
      hasAccount: true,
      accountId: account.paypal_merchant_id || null,
      onboardingComplete: account.onboarding_complete || false,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
      country: account.country || null,
      email: account.paypal_email || null,
    };
  }

  async getSellerDashboardUrl(_userId: string): Promise<DashboardResult> {
    // PayPal doesn't have an embeddable dashboard like Stripe Express.
    // Sellers manage their PayPal account directly at paypal.com
    const env = process.env.PAYPAL_ENVIRONMENT === "production" ? "" : "sandbox.";
    return {
      url: `https://www.${env}paypal.com/myaccount/summary`,
    };
  }

  // ========== CHECKOUT ==========

  async createCheckoutSession(order: OrderForPayment): Promise<CheckoutResult> {
    const amountStr = order.amount.toFixed(2);
    const currency = (order.currency || "usd").toUpperCase();
    const isService = order.listingType === "service";

    // For commissions: AUTHORIZE (manual capture = escrow)
    // For products: CAPTURE (auto-capture)
    const intent = isService ? "AUTHORIZE" : "CAPTURE";

    // Get seller's PayPal merchant ID for partner fee
    const { data: sellerOrder } = await supabaseAdmin
      .from("orders")
      .select("seller_id, platform_fee")
      .eq("id", order.id)
      .single();

    let payee: { merchant_id?: string } | undefined;
    let platformFee: { amount: { currency_code: string; value: string } } | undefined;

    if (sellerOrder?.seller_id) {
      const { data: sellerAccount } = await supabaseAdmin
        .from("seller_accounts")
        .select("paypal_merchant_id")
        .eq("user_id", sellerOrder.seller_id)
        .single();

      if (sellerAccount?.paypal_merchant_id) {
        payee = { merchant_id: sellerAccount.paypal_merchant_id };

        if (sellerOrder.platform_fee) {
          platformFee = {
            amount: {
              currency_code: currency,
              value: Number(sellerOrder.platform_fee).toFixed(2),
            },
          };
        }
      }
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const ppOrder = await paypalFetch<PayPalOrder>("/v2/checkout/orders", {
      method: "POST",
      body: {
        intent,
        purchase_units: [
          {
            reference_id: order.id,
            description: `PinkQuill order ${order.id}`,
            amount: {
              currency_code: currency,
              value: amountStr,
            },
            ...(payee ? { payee } : {}),
            ...(platformFee ? { payment_instruction: { platform_fees: [platformFee] } } : {}),
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              brand_name: "PinkQuill",
              locale: "en-US",
              landing_page: "LOGIN",
              user_action: "PAY_NOW",
              return_url: `${origin}/orders/${order.id}?payment=success`,
              cancel_url: `${origin}/orders/${order.id}?payment=cancelled`,
            },
          },
        },
      },
      idempotencyKey: `checkout_${order.id}`,
    });

    const approvalUrl = ppOrder.links.find((l) => l.rel === "payer-action")?.href
      || ppOrder.links.find((l) => l.rel === "approve")?.href;

    // Store PayPal order ID on the order
    await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "paypal",
        payment_reference: ppOrder.id,
        paypal_order_id: ppOrder.id,
        payment_status: "pending",
      })
      .eq("id", order.id);

    return {
      mode: "paypal",
      clientToken: ppOrder.id,
      paymentReference: ppOrder.id,
      approvalUrl,
    };
  }

  async capturePayment(orderId: string, paymentRef: string): Promise<CaptureResult> {
    // Determine intent (authorize vs capture) by checking the order
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("listing_type, status, payment_status")
      .eq("id", orderId)
      .single();

    if (!order) throw new Error("Order not found");

    // Check PayPal order status first
    const ppOrder = await paypalFetch<PayPalOrder>(`/v2/checkout/orders/${paymentRef}`);

    if (ppOrder.status === "COMPLETED") {
      return { success: true, alreadyProcessed: true };
    }

    if (ppOrder.status !== "APPROVED") {
      throw new Error(`PayPal order is not approved (status: ${ppOrder.status})`);
    }

    const isService = order.listing_type === "service";

    if (isService) {
      // AUTHORIZE for escrow
      const authResult = await paypalFetch<PayPalOrder>(`/v2/checkout/orders/${paymentRef}/authorize`, {
        method: "POST",
      });

      return {
        success: true,
        status: "paid",
        paymentStatus: "authorized",
      };
    } else {
      // CAPTURE for products
      const captureResult = await paypalFetch<PayPalOrder>(`/v2/checkout/orders/${paymentRef}/capture`, {
        method: "POST",
      });

      return {
        success: true,
        status: "paid",
        paymentStatus: "paid",
      };
    }
  }

  // ========== REFUNDS ==========

  async refundPayment(paymentRef: string, orderId: string, _amount?: number): Promise<RefundResult> {
    // Get the capture ID from the PayPal order
    const ppOrder = await paypalFetch<PayPalOrder>(`/v2/checkout/orders/${paymentRef}`);

    const captureId = ppOrder.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const authId = ppOrder.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;

    if (captureId) {
      // Refund a captured payment
      await paypalFetch(`/v2/payments/captures/${captureId}/refund`, {
        method: "POST",
        body: {},
        idempotencyKey: `refund_${orderId}`,
      });
    } else if (authId) {
      // Void an authorization (not yet captured)
      await paypalFetch(`/v2/payments/authorizations/${authId}/void`, {
        method: "POST",
        idempotencyKey: `void_${orderId}`,
      });
    } else {
      throw new Error("No capture or authorization found to refund");
    }

    return { success: true };
  }
}
