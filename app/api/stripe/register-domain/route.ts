import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { enforceSameOrigin } from "@/lib/api-security";
import { getStripeServer } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Registers the platform domain with Stripe for Apple Pay.
 * Only needs to be called once. Idempotent — safe to call multiple times.
 */
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stripe = getStripeServer();
    const domain = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
      : "pinkquill.com";

    const applePayDomain = await stripe.applePayDomains.create({
      domain_name: domain,
    });

    return NextResponse.json({
      success: true,
      domain: applePayDomain.domain_name,
      id: applePayDomain.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register domain";
    // If already registered, Stripe returns a specific error
    if (message.includes("already been registered")) {
      return NextResponse.json({ success: true, already_registered: true });
    }
    console.error("[Stripe Register Domain]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
