import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse } from "@/lib/api-security";
import { getPaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      request,
      scope: "payments.connect_dashboard",
      limit: 20,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    if (getPaymentProvider() !== "stripe") {
      return NextResponse.json({
        url: "/seller/onboarding?provider=placeholder",
        placeholder_mode: true,
      });
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

    const { stripe } = await import("@/lib/stripe");
    const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id);

    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    console.error("[Stripe Connect Dashboard]", error);
    const message = error instanceof Error ? error.message : "Failed to create dashboard link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
