import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse } from "@/lib/api-security";
import { getActiveProvider } from "@/lib/payment-provider";

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
      scope: "payments.connect_dashboard",
      limit: 20,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const provider = getActiveProvider();
    const result = await provider.getSellerDashboardUrl(user.id);

    return NextResponse.json({
      url: result.url,
      placeholder_mode: result.placeholderMode || false,
    });
  } catch (error) {
    console.error("[Connect Dashboard]", error);
    const message = error instanceof Error ? error.message : "Failed to create dashboard link";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
