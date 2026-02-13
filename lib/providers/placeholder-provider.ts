/**
 * Placeholder Provider (for development/testing without real payment credentials)
 */

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

export class PlaceholderProvider implements PaymentProviderInterface {
  readonly name = "placeholder" as const;

  async createSellerAccount(userId: string): Promise<OnboardingResult> {
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
        payouts_enabled: false,
      });
    } else {
      await supabaseAdmin
        .from("seller_accounts")
        .update({ onboarding_complete: true, charges_enabled: true, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://pinkquill.com" : "http://localhost:3000");
    return { url: `${origin}/seller/onboarding?provider=placeholder`, placeholderMode: true };
  }

  async checkSellerStatus(userId: string): Promise<SellerStatusResult> {
    const { data: account } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    return {
      provider: "placeholder",
      hasAccount: !!account,
      accountId: null,
      onboardingComplete: account?.onboarding_complete || true,
      chargesEnabled: account?.charges_enabled || true,
      payoutsEnabled: false,
      country: null,
      email: null,
      placeholderMode: true,
    };
  }

  async getSellerDashboardUrl(): Promise<DashboardResult> {
    return { url: "/seller/onboarding?provider=placeholder", placeholderMode: true };
  }

  async createCheckoutSession(order: OrderForPayment): Promise<CheckoutResult> {
    const paymentReference = `placeholder:${order.id}`;

    await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "placeholder",
        payment_reference: paymentReference,
        payment_intent_id: paymentReference,
        payment_status: "pending",
      })
      .eq("id", order.id);

    return {
      mode: "placeholder",
      clientToken: null,
      paymentReference,
      message: "Placeholder payments active — no real charge.",
    };
  }

  async capturePayment(): Promise<CaptureResult> {
    return { success: true };
  }

  async releaseEscrow(): Promise<CaptureResult> {
    return { success: true };
  }

  async refundPayment(): Promise<RefundResult> {
    return { success: true };
  }
}
