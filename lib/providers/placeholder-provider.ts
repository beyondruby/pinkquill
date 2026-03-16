/**
 * Placeholder Provider — For development/testing and free orders.
 *
 * No actual payment processing. Simulates the provider interface
 * so the app works without Stripe credentials.
 */

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
import { supabaseAdmin } from "@/lib/supabase-server";

export class PlaceholderProvider implements PaymentProviderInterface {
  readonly name = "placeholder" as const;

  async createSellerAccount(
    userId: string,
    _email: string,
    _profile: { username?: string; displayName?: string }
  ): Promise<OnboardingResult> {
    const { data: existing } = await supabaseAdmin
      .from("seller_accounts")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!existing) {
      await supabaseAdmin.from("seller_accounts").insert({
        user_id: userId,
        onboarding_complete: true,
        charges_enabled: true,
        payouts_enabled: true,
      });
    } else {
      await supabaseAdmin
        .from("seller_accounts")
        .update({
          onboarding_complete: true,
          charges_enabled: true,
          payouts_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return {
      url: `${origin}/seller/onboarding?success=true`,
      placeholderMode: true,
    };
  }

  async checkSellerStatus(userId: string): Promise<SellerStatusResult> {
    const { data: account } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    return {
      provider: "placeholder",
      hasAccount: Boolean(account),
      accountId: null,
      onboardingComplete: Boolean(account?.onboarding_complete),
      chargesEnabled: Boolean(account?.charges_enabled),
      payoutsEnabled: Boolean(account?.payouts_enabled),
      country: null,
      email: null,
      placeholderMode: true,
    };
  }

  async getSellerDashboardUrl(_userId: string): Promise<DashboardResult> {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return { url: `${origin}/seller/earnings`, placeholderMode: true };
  }

  async createCheckoutSession(
    order: OrderForCheckout
  ): Promise<CheckoutSessionResult> {
    const sessionId = `cs_placeholder_${order.id}`;

    await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "placeholder",
        payment_reference: sessionId,
        checkout_session_id: sessionId,
        payment_status: "pending",
      })
      .eq("id", order.id);

    return {
      mode: "placeholder",
      clientSecret: null,
      sessionId,
    };
  }

  async transferToSeller(orderId: string): Promise<TransferResult> {
    await supabaseAdmin
      .from("orders")
      .update({
        transfer_id: `tr_placeholder_${orderId}`,
        transfer_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return {
      success: true,
      transferId: `tr_placeholder_${orderId}`,
    };
  }

  async refundPayment(orderId: string): Promise<RefundResult> {
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
