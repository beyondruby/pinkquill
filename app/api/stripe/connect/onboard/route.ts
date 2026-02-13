import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse } from "@/lib/api-security";
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

    // Get user profile for display name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .single();

    const provider = getActiveProvider();
    const result = await provider.createSellerAccount(user.id, user.email || "", {
      username: profile?.username || undefined,
      displayName: profile?.display_name || undefined,
    });

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
