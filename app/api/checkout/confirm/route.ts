/**
 * Confirm checkout for placeholder/free orders.
 * For Stripe orders, confirmation happens via webhooks.
 */
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { finalizeOrderPayment } from "@/lib/payments-server";
import { getActiveProvider } from "@/lib/payment-provider";

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
      scope: "checkout.confirm",
      identifier: user.id,
      limit: 10,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 60);

    const parsed = await safeJsonParse<{ order_id?: string }>(request);
    if ("error" in parsed) return parsed.error;
    if (!parsed.data?.order_id) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, payment_provider, payment_reference, amount, listing_type")
      .eq("id", parsed.data.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.status !== "pending_payment") {
      return NextResponse.json({ error: "Order is not awaiting payment" }, { status: 400 });
    }

    // SECURITY: the order's `payment_provider` column is mutable and defaults to
    // 'placeholder' at creation (it only becomes 'stripe' once /api/checkout runs).
    // Trusting it here let a buyer confirm a *paid* order for free by POSTing to this
    // route before ever opening Stripe. Authorize free confirmation off the SERVER's
    // active provider instead, never the order column.
    let activeProviderName: string;
    try {
      activeProviderName = getActiveProvider().name;
    } catch {
      // getActiveProvider throws when placeholder is configured in production; in
      // that misconfigured state, fail safe by treating the environment as real-pay.
      activeProviderName = "stripe";
    }
    const isPlaceholderMode = activeProviderName === "placeholder";
    const isFreeOrder = Number(order.amount) <= 0;

    // In a real-payment environment only genuinely free ($0) orders may be finalized
    // here; any order with a positive total MUST be captured via the Stripe webhook.
    if (!isPlaceholderMode && !isFreeOrder) {
      return NextResponse.json(
        { error: "This order must be completed through checkout." },
        { status: 400 }
      );
    }

    const result = await finalizeOrderPayment({
      orderId: order.id,
      provider: "placeholder",
      paymentReference: order.payment_reference || `placeholder_${order.id}`,
      actorId: user.id,
      source: "checkout_confirm",
    });

    // Auto-transfer for placeholder mode
    if (!result.already_processed) {
      try {
        await getActiveProvider().transferToSeller(order.id);
      } catch {
        // Non-blocking — transfer can be retried later
      }
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      status: result.status,
      payment_status: result.payment_status,
    });
  } catch (err) {
    console.error("[POST /api/checkout/confirm] Error:", err);
    const message = err instanceof Error ? err.message : "Confirmation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
