import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { getActiveProvider } from "@/lib/payment-provider";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = getActiveProvider();
    const status = await provider.checkSellerStatus(user.id);

    return NextResponse.json({
      provider: status.provider,
      user_id: user.id,
      has_account: status.hasAccount,
      account_id: status.accountId,
      onboarding_complete: status.onboardingComplete,
      charges_enabled: status.chargesEnabled,
      payouts_enabled: status.payoutsEnabled,
      country: status.country,
      email: status.email,
      placeholder_mode: status.placeholderMode || false,
    });
  } catch (error) {
    console.error("[Connect Status]", error);
    const message = error instanceof Error ? error.message : "Failed to check account status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
