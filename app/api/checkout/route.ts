import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getActiveProvider } from "@/lib/payment-provider";
import type { OrderForCheckout } from "@/lib/payment-provider";
import { verifyTurnstileToken } from "@/lib/turnstile-server";

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
      scope: "user",
      identifier: user.id,
      limit: 10,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 60);

    const parsed = await safeJsonParse<{
      order_id?: string;
      turnstile_token?: string;
    }>(request);
    if ("error" in parsed) return parsed.error;
    if (!parsed.data?.order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const turnstile = await verifyTurnstileToken({
      request,
      token: parsed.data.turnstile_token,
      action: "checkout_create",
    });
    if (!turnstile.ok) {
      return turnstile.response!;
    }

    // Fetch order with product details
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(`
        id, order_number, buyer_id, seller_id, amount, currency,
        listing_type, status, payment_status, checkout_session_id,
        quantity, pricing_id,
        product:products (id, title, listing_type)
      `)
      .eq("id", parsed.data.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized for this order" }, { status: 403 });
    }

    if (order.status !== "pending_payment") {
      return NextResponse.json(
        { error: `Order is not awaiting payment (status: ${order.status})` },
        { status: 400 }
      );
    }

    // Verify order amount against the exact pricing option captured on the order.
    if (order.product) {
      const productRecord = Array.isArray(order.product) ? order.product[0] : order.product;
      if (productRecord?.id) {
        if (!order.pricing_id) {
          return NextResponse.json(
            { error: "Order is missing its pricing option. Please recreate your order." },
            { status: 409 }
          );
        }

        const { data: pricing, error: pricingError } = await supabaseAdmin
          .from("product_pricing")
          .select("id, product_id, price, is_available")
          .eq("id", order.pricing_id)
          .eq("product_id", productRecord.id)
          .single();

        if (pricingError || !pricing) {
          return NextResponse.json(
            { error: "Pricing option is no longer available. Please recreate your order." },
            { status: 409 }
          );
        }

        if (pricing.is_available === false) {
          return NextResponse.json(
            { error: "Pricing option is no longer available. Please recreate your order." },
            { status: 409 }
          );
        }

        const qty = order.quantity ?? 1;
        if (Math.abs(Number(order.amount) - Number(pricing.price) * qty) > 0.01) {
          // Price changed since order was created
          return NextResponse.json(
            { error: "Product price has changed. Please recreate your order." },
            { status: 409 }
          );
        }
      }
    }

    // Build order data for the provider
    const product = Array.isArray(order.product) ? order.product[0] : order.product;
    const orderForCheckout: OrderForCheckout = {
      id: order.id,
      orderNumber: order.order_number,
      buyerId: order.buyer_id,
      buyerEmail: user.email || undefined,
      amount: Number(order.amount),
      currency: order.currency || "usd",
      listingType: order.listing_type,
      productTitle: product?.title || null,
    };

    const provider = getActiveProvider();
    const result = await provider.createCheckoutSession(orderForCheckout);

    return NextResponse.json({
      mode: result.mode,
      client_secret: result.clientSecret,
      session_id: result.sessionId,
      message: result.message,
    });
  } catch (err) {
    console.error("[POST /api/checkout] Error:", err);
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
