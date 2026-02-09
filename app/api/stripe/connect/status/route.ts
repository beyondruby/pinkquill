import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { getPaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (getPaymentProvider() !== "stripe") {
      return NextResponse.json({
        provider: "placeholder",
        user_id: user.id,
        has_account: true,
        onboarding_complete: true,
        charges_enabled: true,
        payouts_enabled: false,
        country: null,
        placeholder_mode: true,
      });
    }

    const { data: account } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!account) {
      return NextResponse.json({
        has_account: false,
        onboarding_complete: false,
        charges_enabled: false,
        payouts_enabled: false,
      });
    }

    // If we have a Stripe account, fetch fresh status
    if (account.stripe_account_id) {
      const { stripe } = await import("@/lib/stripe");
      const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);

      const updates = {
        onboarding_complete: stripeAccount.details_submitted ?? false,
        charges_enabled: stripeAccount.charges_enabled ?? false,
        payouts_enabled: stripeAccount.payouts_enabled ?? false,
        country: stripeAccount.country || account.country,
        updated_at: new Date().toISOString(),
      };

      // Sync latest status back to DB
      await supabaseAdmin
        .from("seller_accounts")
        .update(updates)
        .eq("id", account.id);

      return NextResponse.json({
        user_id: user.id,
        has_account: true,
        stripe_account_id: account.stripe_account_id,
        ...updates,
      });
    }

    return NextResponse.json({
      user_id: user.id,
      has_account: true,
      onboarding_complete: account.onboarding_complete,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (error) {
    console.error("[Stripe Connect Status]", error);
    const message = error instanceof Error ? error.message : "Failed to check account status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
