import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { enforceSameOrigin } from "@/lib/api-security";
import {
  collectPaymentMethodDomains,
  ensurePaymentMethodDomainsRegistered,
} from "@/lib/stripe-payment-method-domains";
import { getStripeServer } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Registers the platform domain with Stripe for Payment Element wallets.
 * This activates Apple Pay / Google Pay / Link on supported browsers when the
 * domain is properly verified and enabled in Stripe.
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
    const domains = collectPaymentMethodDomains(request);
    const results = await ensurePaymentMethodDomainsRegistered(stripe, domains);

    return NextResponse.json({
      success: true,
      domains: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to register domain";
    console.error("[Stripe Register Domain]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
