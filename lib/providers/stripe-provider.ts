/**
 * Stripe Provider — Primary payment provider for Pinkquill marketplace.
 *
 * Uses Stripe Connect (Express) with destination charges.
 * - Products: auto-capture with application_fee_amount
 * - Commissions: manual capture (escrow) with application_fee_amount
 *   Funds are held until buyer approves delivery, then captured via releaseEscrow().
 */

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
import { getStripeServer, CONNECT_ACCOUNT_TYPE } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

export class StripeProvider implements PaymentProviderInterface {
  readonly name = "stripe" as const;

  // ============================================================================
  // SELLER ONBOARDING
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
        metadata: { user_id: userId, username: profile.username || "" },
        business_profile: {
          name: profile.displayName || profile.username || undefined,
        },
      });
      stripeAccountId = account.id;

      if (existing) {
        await supabaseAdmin
          .from("seller_accounts")
          .update({ stripe_account_id: stripeAccountId, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      } else {
        await supabaseAdmin.from("seller_accounts").insert({
          user_id: userId,
          stripe_account_id: stripeAccountId,
        });
      }
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
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
      const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);

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

    // No stripe_account_id — seller needs to complete Stripe onboarding
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
      // No Stripe account linked — redirect to onboarding
      const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      return { url: `${origin}/seller/onboarding` };
    }

    const stripe = getStripeServer();
    const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id);
    return { url: loginLink.url };
  }

  // ============================================================================
  // CHECKOUT — Destination charges with platform fee
  // ============================================================================

  async createCheckoutSession(order: OrderForPayment): Promise<CheckoutResult> {
    const stripe = getStripeServer();
    const amountCents = Math.round(order.amount * 100);
    const currency = (order.currency || "usd").toLowerCase();
    const isService = order.listingType === "service";

    // Look up seller's Stripe Connect account for destination charges
    const { data: sellerOrder } = await supabaseAdmin
      .from("orders")
      .select("seller_id, platform_fee")
      .eq("id", order.id)
      .single();

    let transferData: { destination: string } | undefined;
    let applicationFeeAmount: number | undefined;

    if (sellerOrder?.seller_id) {
      const { data: sellerAccount } = await supabaseAdmin
        .from("seller_accounts")
        .select("stripe_account_id, onboarding_complete, charges_enabled")
        .eq("user_id", sellerOrder.seller_id)
        .single();

      if (!sellerAccount?.stripe_account_id || !sellerAccount.charges_enabled) {
        throw new Error(
          "Seller Stripe account is not ready to receive payments. Ask the seller to complete Stripe onboarding."
        );
      }

      transferData = { destination: sellerAccount.stripe_account_id };
      const platformFeeCents = Math.round(Number(sellerOrder.platform_fee) * 100);
      if (platformFeeCents > 0) {
        applicationFeeAmount = platformFeeCents;
      }
    }

    // Check for existing reusable PaymentIntent
    let paymentIntent = order.existingPaymentRef?.startsWith("pi_")
      ? await stripe.paymentIntents.retrieve(order.existingPaymentRef).catch(() => null)
      : null;

    const reusableStatuses = new Set([
      "requires_payment_method", "requires_confirmation",
      "requires_action", "processing",
    ]);

    if (paymentIntent && paymentIntent.amount !== amountCents) {
      paymentIntent = null;
    }

    if (paymentIntent?.status === "succeeded") {
      return {
        mode: "stripe",
        clientToken: null,
        paymentReference: paymentIntent.id,
        message: "Payment already completed",
      };
    }

    if (paymentIntent?.status === "requires_capture") {
      return {
        mode: "stripe",
        clientToken: null,
        paymentReference: paymentIntent.id,
        message: "Payment already authorized (escrow)",
      };
    }

    if (!paymentIntent || !reusableStatuses.has(paymentIntent.status)) {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency,
          automatic_payment_methods: { enabled: true },
          // Manual capture for commissions (escrow), auto for products
          capture_method: isService ? "manual" : "automatic",
          // Destination charge routes funds to seller's connected account
          ...(transferData ? { transfer_data: transferData } : {}),
          // Application fee is Pinkquill's 5% platform cut
          ...(applicationFeeAmount ? { application_fee_amount: applicationFeeAmount } : {}),
          metadata: {
            order_id: order.id,
            buyer_id: order.buyerId,
            listing_type: order.listingType,
          },
          description: `PinkQuill order ${order.id}`,
          receipt_email: order.buyerEmail ?? undefined,
        },
        { idempotencyKey: `checkout_${order.id}_${amountCents}_${currency}` }
      );
    }

    // Persist payment intent on order
    await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "stripe",
        payment_reference: paymentIntent.id,
        payment_intent_id: paymentIntent.id,
        payment_status: "pending",
      })
      .eq("id", order.id);

    return {
      mode: "stripe",
      clientToken: paymentIntent.client_secret,
      paymentReference: paymentIntent.id,
    };
  }

  // ============================================================================
  // CAPTURE — Verify payment status after client-side confirmation
  // ============================================================================

  async capturePayment(_orderId: string, paymentRef: string): Promise<CaptureResult> {
    const stripe = getStripeServer();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentRef);

    // Auto-captured payment (products)
    if (paymentIntent.status === "succeeded") {
      return { success: true, alreadyProcessed: true };
    }

    // Manual capture (commissions/escrow) — auth succeeded, awaiting capture
    if (paymentIntent.status === "requires_capture") {
      return {
        success: true,
        status: "paid",
        paymentStatus: "authorized",
        paymentReference: paymentRef,
      };
    }

    if (paymentIntent.status === "canceled" || paymentIntent.status === "requires_payment_method") {
      throw new Error(paymentIntent.last_payment_error?.message || "Payment failed");
    }

    throw new Error(`Payment not complete (status: ${paymentIntent.status})`);
  }

  // ============================================================================
  // ESCROW RELEASE — Capture a manually-held PaymentIntent
  // ============================================================================

  async releaseEscrow(paymentRef: string, orderId: string): Promise<CaptureResult> {
    const stripe = getStripeServer();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentRef);

    if (paymentIntent.status === "succeeded") {
      return { success: true, alreadyProcessed: true };
    }

    if (paymentIntent.status !== "requires_capture") {
      throw new Error(`Cannot release escrow: payment status is ${paymentIntent.status}`);
    }

    const captured = await stripe.paymentIntents.capture(
      paymentRef,
      {},
      { idempotencyKey: `escrow_release_${orderId}` }
    );

    return {
      success: true,
      status: "paid",
      paymentStatus: "paid",
      paymentReference: captured.id,
    };
  }

  // ============================================================================
  // REFUNDS — Handle both captured and uncaptured (escrow void)
  // ============================================================================

  async refundPayment(paymentRef: string, orderId: string, _amount?: number): Promise<RefundResult> {
    const stripe = getStripeServer();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentRef);

    // Uncaptured escrow — void the authorization
    if (paymentIntent.status === "requires_capture") {
      await stripe.paymentIntents.cancel(paymentRef, {
        cancellation_reason: "requested_by_customer",
      });
      return { success: true };
    }

    // Captured payment — refund
    if (paymentIntent.status === "succeeded") {
      await stripe.refunds.create({
        payment_intent: paymentRef,
        reason: "requested_by_customer",
        metadata: { order_id: orderId },
      });
      return { success: true };
    }

    // Already canceled or refunded
    return { success: true, alreadyRefunded: true };
  }
}
