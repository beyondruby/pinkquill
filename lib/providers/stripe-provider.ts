/**
 * Stripe Provider — Platform-Centric Payment Architecture
 *
 * All payments are processed through the PLATFORM's Stripe account.
 * Sellers receive payouts via Stripe Transfers after order fulfillment.
 * Seller Connect accounts are for payouts only — their status never blocks payments.
 *
 * - Checkout: Stripe Checkout Sessions (embedded mode)
 * - Payouts: Stripe Transfers to seller's Connect Express account
 * - Escrow: Funds held in platform balance until transfer
 * - Refunds: stripe.refunds.create() + transfer reversal if needed
 */

import Stripe from "stripe";
import type {
  PaymentProviderInterface,
  OnboardingResult,
  SellerStatusResult,
  DashboardResult,
  CheckoutSessionResult,
  TransferResult,
  RefundResult,
  OrderForCheckout,
} from "@/lib/payment-provider";
import { getStripeServer, CONNECT_ACCOUNT_TYPE } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

// ============================================================================
// HELPERS
// ============================================================================

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://www.pinkquill.com"
      : "http://localhost:3000")
  );
}

function normalizeDescriptorSuffix(
  orderNumber: string | null | undefined
): string | undefined {
  const fallback = String(orderNumber || "").trim();
  let suffix = (fallback || "PINKQUILL")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (!/[A-Z]/.test(suffix)) {
    suffix = `${suffix} PQ`.trim();
  }

  suffix = suffix.slice(-12).trim();
  if (!suffix || !/[A-Z]/.test(suffix)) {
    return "PINKQUILL";
  }

  return suffix;
}

const REQUESTED_CONNECT_CAPABILITIES: Stripe.AccountCreateParams.Capabilities = {
  transfers: { requested: true },
};

// ============================================================================
// STRIPE PROVIDER
// ============================================================================

export class StripeProvider implements PaymentProviderInterface {
  readonly name = "stripe" as const;

  // ============================================================================
  // SELLER ONBOARDING — For payouts only
  // ============================================================================

  async createSellerAccount(
    userId: string,
    email: string,
    profile: { username?: string; displayName?: string }
  ): Promise<OnboardingResult> {
    const stripe = getStripeServer();

    const { data: existing } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    let stripeAccountId = existing?.stripe_account_id;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: CONNECT_ACCOUNT_TYPE,
        email,
        metadata: {
          user_id: userId,
          username: profile.username || "",
        },
        business_profile: {
          name: profile.displayName || profile.username || undefined,
        },
        capabilities: REQUESTED_CONNECT_CAPABILITIES,
      });
      stripeAccountId = account.id;

      if (existing) {
        await supabaseAdmin
          .from("seller_accounts")
          .update({
            stripe_account_id: stripeAccountId,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      } else {
        await supabaseAdmin.from("seller_accounts").insert({
          user_id: userId,
          stripe_account_id: stripeAccountId,
        });
      }
    }

    const origin = getSiteUrl();
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/seller/onboarding?refresh=true`,
      return_url: `${origin}/seller/onboarding?success=true`,
      type: "account_onboarding",
    });

    return { url: accountLink.url, accountId: stripeAccountId };
  }

  async checkSellerStatus(userId: string): Promise<SellerStatusResult> {
    const { data: account } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!account) {
      return {
        provider: "stripe",
        hasAccount: false,
        accountId: null,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        country: null,
        email: null,
      };
    }

    if (account.stripe_account_id) {
      const stripe = getStripeServer();
      const stripeAccount = await stripe.accounts.retrieve(
        account.stripe_account_id
      );

      const updates = {
        onboarding_complete: stripeAccount.details_submitted ?? false,
        charges_enabled: stripeAccount.charges_enabled ?? false,
        payouts_enabled: stripeAccount.payouts_enabled ?? false,
        country: stripeAccount.country || account.country,
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin
        .from("seller_accounts")
        .update(updates)
        .eq("id", account.id);

      return {
        provider: "stripe",
        hasAccount: true,
        accountId: account.stripe_account_id,
        onboardingComplete: updates.onboarding_complete,
        chargesEnabled: updates.charges_enabled,
        payoutsEnabled: updates.payouts_enabled,
        country: updates.country || null,
        email: null,
      };
    }

    return {
      provider: "stripe",
      hasAccount: true,
      accountId: null,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      country: account.country || null,
      email: null,
    };
  }

  async getSellerDashboardUrl(userId: string): Promise<DashboardResult> {
    const { data: account } = await supabaseAdmin
      .from("seller_accounts")
      .select("stripe_account_id")
      .eq("user_id", userId)
      .single();

    if (!account?.stripe_account_id) {
      const origin = getSiteUrl();
      return { url: `${origin}/seller/onboarding` };
    }

    const stripe = getStripeServer();
    const loginLink = await stripe.accounts.createLoginLink(
      account.stripe_account_id
    );
    return { url: loginLink.url };
  }

  // ============================================================================
  // CHECKOUT — Stripe Checkout Session (Embedded Mode)
  // All payments go through the PLATFORM's account. No destination charges.
  // ============================================================================

  async createCheckoutSession(
    order: OrderForCheckout
  ): Promise<CheckoutSessionResult> {
    const stripe = getStripeServer();
    const amountCents = Math.round(order.amount * 100);
    const currency = (order.currency || "usd").toLowerCase();
    const orderReference = order.orderNumber || order.id;
    const compactTitle = String(order.productTitle || "").trim().slice(0, 80);
    const productName = compactTitle || `Order ${orderReference}`;
    const description = compactTitle
      ? `PinkQuill ${orderReference} — ${compactTitle}`
      : `PinkQuill order ${orderReference}`;

    // Check for existing checkout session on this order
    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("checkout_session_id")
      .eq("id", order.id)
      .single();

    if (existingOrder?.checkout_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          existingOrder.checkout_session_id
        );

        // If session is still open, reuse it
        if (existingSession.status === "open" && existingSession.client_secret) {
          return {
            mode: "stripe",
            clientSecret: existingSession.client_secret,
            sessionId: existingSession.id,
          };
        }

        // If already completed, return as-is
        if (existingSession.status === "complete") {
          return {
            mode: "stripe",
            clientSecret: null,
            sessionId: existingSession.id,
            message: "Payment already completed",
          };
        }
      } catch {
        // Session not found or expired — create a new one
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded",
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: productName,
              description,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata: {
          order_id: order.id,
          order_number: order.orderNumber || "",
          buyer_id: order.buyerId,
          listing_type: order.listingType,
        },
        ...(normalizeDescriptorSuffix(order.orderNumber)
          ? {
              statement_descriptor_suffix:
                normalizeDescriptorSuffix(order.orderNumber),
            }
          : {}),
      },
      ...(order.buyerEmail ? { customer_email: order.buyerEmail } : {}),
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber || "",
        buyer_id: order.buyerId,
        listing_type: order.listingType,
      },
      return_url: `${getSiteUrl()}/checkout/${order.id}/complete?session_id={CHECKOUT_SESSION_ID}`,
    });

    // Persist checkout session on order
    await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "stripe",
        payment_reference: session.id,
        checkout_session_id: session.id,
        payment_status: "pending",
      })
      .eq("id", order.id);

    return {
      mode: "stripe",
      clientSecret: session.client_secret,
      sessionId: session.id,
    };
  }

  // ============================================================================
  // TRANSFERS — Pay seller after order completion
  // ============================================================================

  async transferToSeller(orderId: string): Promise<TransferResult> {
    const stripe = getStripeServer();

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Already transferred
    if (order.transfer_id) {
      return { success: true, alreadyTransferred: true };
    }

    // Get seller's Connect account
    const { data: sellerAccount } = await supabaseAdmin
      .from("seller_accounts")
      .select("stripe_account_id, payouts_enabled, onboarding_complete")
      .eq("user_id", order.seller_id)
      .single();

    // Seller hasn't completed Connect onboarding — queue for later
    if (
      !sellerAccount?.stripe_account_id ||
      !sellerAccount.payouts_enabled
    ) {
      await supabaseAdmin
        .from("orders")
        .update({ transfer_status: "pending_onboarding" })
        .eq("id", orderId);

      return { success: true, pendingOnboarding: true };
    }

    // Pay exactly what the ledger says. `seller_amount` is computed once by
    // create_marketplace_order / apply_promo_to_order (5% of the goods or
    // service amount, shipping passed through); recomputing here from
    // `amount` (which includes shipping) made payouts disagree with what the
    // dashboards show (findings S10).
    const amountCents = Math.round(Number(order.amount) * 100);
    const sellerAmountCents = Math.round(Number(order.seller_amount) * 100);
    if (!Number.isFinite(sellerAmountCents) || sellerAmountCents <= 0 || sellerAmountCents > amountCents) {
      throw new Error(`Order ${orderId} has an invalid seller_amount (${order.seller_amount})`);
    }
    const platformFeeCents = amountCents - sellerAmountCents;

    const transfer = await stripe.transfers.create(
      {
        amount: sellerAmountCents,
        currency: order.currency || "usd",
        destination: sellerAccount.stripe_account_id,
        transfer_group: orderId,
        metadata: {
          order_id: orderId,
          order_number: order.order_number || "",
        },
      },
      { idempotencyKey: `transfer_${orderId}` }
    );

    // Record transfer via RPC
    await supabaseAdmin.rpc("mark_order_transfer_completed", {
      p_order_id: orderId,
      p_transfer_id: transfer.id,
      p_transfer_amount: sellerAmountCents,
      p_source: "stripe_transfer",
    });

    return {
      success: true,
      transferId: transfer.id,
      amount: sellerAmountCents,
      platformFee: platformFeeCents,
    };
  }

  // ============================================================================
  // REFUNDS — Refund buyer + reverse transfer if needed
  // ============================================================================

  async refundPayment(orderId: string): Promise<RefundResult> {
    const stripe = getStripeServer();

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Get the PaymentIntent from the Checkout Session
    let paymentIntentId: string | null = null;

    if (order.checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(
        order.checkout_session_id
      );
      paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;
    } else if (order.payment_intent_id) {
      // Fallback for legacy orders
      paymentIntentId = order.payment_intent_id;
    }

    if (!paymentIntentId) {
      throw new Error("No payment found for this order");
    }

    // If transfer was already sent to seller, reverse it first. If the reversal
    // fails (e.g. seller already spent the balance), do NOT proceed to refund the
    // buyer — otherwise the platform refunds the buyer while the seller keeps the
    // payout, eating the loss. Halt for manual review instead.
    if (order.transfer_id) {
      try {
        await stripe.transfers.createReversal(
          order.transfer_id,
          { metadata: { order_id: orderId, reason: "refund" } },
          { idempotencyKey: `reversal_${orderId}` }
        );
      } catch (err) {
        console.error("[StripeProvider] Transfer reversal failed:", err);
        throw new Error(
          "Refund halted: the seller payout could not be reclaimed. This order needs manual review before a refund can be issued."
        );
      }
    }

    // Refund the buyer (idempotent so webhook/double-submit retries can't double-refund)
    await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
        metadata: { order_id: orderId },
      },
      { idempotencyKey: `refund_${orderId}` }
    );

    // Update order status
    await supabaseAdmin
      .from("orders")
      .update({
        payment_status: "refunded",
        status: "refunded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return { success: true };
  }
}
