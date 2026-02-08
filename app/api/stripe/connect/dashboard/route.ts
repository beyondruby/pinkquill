import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: account } = await supabaseAdmin
      .from("seller_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .single();

    if (!account?.stripe_account_id) {
      return NextResponse.json(
        { error: "Seller account not found. Please complete onboarding first." },
        { status: 404 }
      );
    }

    const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id);

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    console.error("[Stripe Connect Dashboard]", error);
    const message = error instanceof Error ? error.message : "Failed to create dashboard link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
