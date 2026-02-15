import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { enforceSameOrigin } from "@/lib/api-security";
import { getStripeServer } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Registers the platform domain with Stripe for Apple Pay.
 * Registers both apex + www by default. Idempotent — safe to call multiple times.
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
    const configuredDomains = process.env.STRIPE_APPLE_PAY_DOMAINS
      ?.split(",")
      .map((domain) => domain.trim())
      .filter(Boolean);

    const primaryHost = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname
      : "pinkquill.com";

    const derivedHosts = primaryHost.startsWith("www.")
      ? [primaryHost, primaryHost.slice(4)]
      : [primaryHost, `www.${primaryHost}`];

    const domains = Array.from(new Set([...(configuredDomains || []), ...derivedHosts]));
    const results: Array<{ domain: string; id: string | null; status: "registered" | "already_registered" }> = [];

    for (const domain of domains) {
      try {
        const applePayDomain = await stripe.applePayDomains.create({
          domain_name: domain,
        });
        results.push({
          domain: applePayDomain.domain_name,
          id: applePayDomain.id,
          status: "registered",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to register domain";
        if (message.includes("already been registered")) {
          results.push({
            domain,
            id: null,
            status: "already_registered",
          });
          continue;
        }
        throw error;
      }
    }

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
