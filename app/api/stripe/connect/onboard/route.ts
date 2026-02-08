import { NextResponse } from "next/server";
import { stripe, CONNECT_ACCOUNT_TYPE } from "@/lib/stripe";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if seller account already exists
    const { data: existingAccount } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let stripeAccountId = existingAccount?.stripe_account_id;

    if (!stripeAccountId) {
      // Get user profile for prefill
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .single();

      // Create Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: CONNECT_ACCOUNT_TYPE,
        email: user.email,
        metadata: {
          user_id: user.id,
          username: profile?.username || "",
        },
        business_profile: {
          name: profile?.display_name || profile?.username || undefined,
        },
      });

      stripeAccountId = account.id;

      // Save to database
      if (existingAccount) {
        await supabaseAdmin
          .from("seller_accounts")
          .update({ stripe_account_id: stripeAccountId, updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
      } else {
        await supabaseAdmin
          .from("seller_accounts")
          .insert({ user_id: user.id, stripe_account_id: stripeAccountId });
      }
    }

    // Create onboarding link
    const { url: returnUrl } = request;
    const origin = new URL(returnUrl).origin;

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/seller/onboarding?refresh=true`,
      return_url: `${origin}/seller/onboarding?success=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("[Stripe Connect Onboard]", error);
    const message = error instanceof Error ? error.message : "Failed to create onboarding link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
