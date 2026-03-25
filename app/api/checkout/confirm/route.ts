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
      scope: "user",
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

    // Only allow confirmation for placeholder/free orders
    const isPlaceholder = order.payment_provider === "placeholder";
    const isFreeOrder = Number(order.amount) <= 0;

    if (!isPlaceholder && !isFreeOrder) {
      return NextResponse.json(
        { error: "Stripe orders are confirmed via webhooks" },
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
