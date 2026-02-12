/**
 * Stripe Provider (dormant — kept behind interface for future re-activation)
 *
 * Wraps existing Stripe Connect logic behind the PaymentProviderInterface.
 * Activated when PAYMENTS_PROVIDER=stripe.
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
import { getStripeServer } from "@/lib/stripe";
import { CONNECT_ACCOUNT_TYPE } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

export class StripeProvider implements PaymentProviderInterface {
  readonly name = "stripe" as const;

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

    return {
      provider: "stripe",
      hasAccount: true,
      accountId: null,
      onboardingComplete: account.onboarding_complete || false,
      chargesEnabled: account.charges_enabled || false,
      payoutsEnabled: account.payouts_enabled || false,
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
      throw new Error("Seller account not found");
    }

    const stripe = getStripeServer();
    const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id);
    return { url: loginLink.url };
  }

  async createCheckoutSession(order: OrderForPayment): Promise<CheckoutResult> {
    const stripe = getStripeServer();
    const amountCents = Math.round(order.amount * 100);
    const currency = (order.currency || "usd").toLowerCase();

    let paymentIntent = order.existingPaymentRef?.startsWith("pi_")
      ? await stripe.paymentIntents.retrieve(order.existingPaymentRef).catch(() => null)
      : null;

    const reusableStatuses = new Set(["requires_payment_method", "requires_confirmation", "requires_action", "processing"]);

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

    if (!paymentIntent || !reusableStatuses.has(paymentIntent.status)) {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency,
          automatic_payment_methods: { enabled: true },
          metadata: { order_id: order.id, buyer_id: order.buyerId, listing_type: order.listingType },
          description: `PinkQuill order ${order.id}`,
          receipt_email: order.buyerEmail ?? undefined,
        },
        { idempotencyKey: `checkout_${order.id}_${amountCents}_${currency}` }
      );
    }

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

  async capturePayment(orderId: string, paymentRef: string): Promise<CaptureResult> {
    const stripe = getStripeServer();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentRef);

    if (paymentIntent.status === "succeeded") {
      return { success: true, alreadyProcessed: true };
    }

    if (paymentIntent.status === "canceled" || paymentIntent.status === "requires_payment_method") {
      throw new Error(paymentIntent.last_payment_error?.message || "Payment failed");
    }

    // Any other non-succeeded status means payment isn't complete
    throw new Error(`Payment not complete (status: ${paymentIntent.status})`);
  }

  async refundPayment(paymentRef: string, orderId: string, _amount?: number): Promise<RefundResult> {
    const stripe = getStripeServer();
    await stripe.refunds.create({
      payment_intent: paymentRef,
      reason: "requested_by_customer",
      metadata: { order_id: orderId },
    });
    return { success: true };
  }
}
