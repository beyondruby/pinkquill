import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { isSellerCountry } from "@/lib/payments";
import { TransferBlockedError } from "@/lib/payment-provider";
import { getActiveProvider } from "@/lib/payment-provider";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      request,
      scope: "payments.connect_onboard",
      limit: 15,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const parsed = await safeJsonParse<{ country?: string }>(request);
    const requestedCountry = "error" in parsed ? undefined : parsed.data?.country;

    // Existing accounts keep their country; new ones must state it.
    const { data: existingAccount } = await supabaseAdmin
      .from("seller_accounts")
      .select("stripe_account_id, country")
      .eq("user_id", user.id)
      .maybeSingle();
    const country = (existingAccount?.stripe_account_id && existingAccount.country) || requestedCountry;
    if (!isSellerCountry(country)) {
      return NextResponse.json(
        { error: "Please choose the country where you'll receive payouts." },
        { status: 400 }
      );
    }

    // Get user profile for display name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single();

    const provider = getActiveProvider();
    let result;
    try {
      result = await provider.createSellerAccount(
        user.id,
        user.email || "",
        { username: profile?.username || undefined, displayName: profile?.display_name || undefined },
        country
      );
    } catch (err) {
      if (err instanceof TransferBlockedError) {
        return NextResponse.json({ error: err.message, code: err.reason }, { status: 400 });
      }
      throw err;
    }

    return NextResponse.json({
      url: result.url,
      placeholder_mode: result.placeholderMode || false,
    });
  } catch (error) {
    console.error("[Connect Onboard]", error);
    const message = error instanceof Error ? error.message : "Failed to create onboarding link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
