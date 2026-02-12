import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getActiveProvider } from "@/lib/payment-provider";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      request,
      scope: "payments.checkout",
      limit: 30,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const body = await request.json();
    const { order_id: orderId } = body as { order_id?: string };

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, listing_type, amount, currency, payment_provider, payment_reference, payment_intent_id, paypal_order_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.status !== "pending_payment") {
      return NextResponse.json(
        { error: `Order is already ${order.status}` },
        { status: 400 }
      );
    }

    const provider = getActiveProvider();
    const result = await provider.createCheckoutSession({
      id: order.id,
      buyerId: user.id,
      buyerEmail: user.email ?? undefined,
      amount: Number(order.amount),
      currency: String(order.currency || "usd"),
      listingType: order.listing_type,
      existingPaymentRef: order.payment_reference || order.payment_intent_id || order.paypal_order_id,
    });

    return NextResponse.json({
      mode: result.mode,
      client_secret: result.clientToken,
      payment_reference: result.paymentReference,
      approval_url: result.approvalUrl || null,
      message: result.message || null,
    });
  } catch (error) {
    console.error("[Checkout Prepare]", error);
    const message = error instanceof Error ? error.message : "Failed to prepare checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
