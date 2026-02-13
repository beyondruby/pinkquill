import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

type EscrowOrder = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  listing_type: string;
  payment_provider: string | null;
  payment_status: string;
  payment_reference: string | null;
  escrow_released: boolean | null;
};

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
      scope: "payments.escrow_release",
      limit: 20,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const parsed = await safeJsonParse<{ order_id?: string }>(request);
    if ("error" in parsed) return parsed.error;
    const { order_id: orderId } = parsed.data;

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, seller_id, status, listing_type, payment_provider, payment_status, payment_reference, escrow_released")
      .eq("id", orderId)
      .single<EscrowOrder>();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (user.id !== order.buyer_id && user.id !== order.seller_id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.listing_type !== "service") {
      return NextResponse.json({ error: "Escrow release only applies to commission orders" }, { status: 400 });
    }

    if (order.status !== "completed") {
      return NextResponse.json(
        { error: "Order must be completed before releasing escrow" },
        { status: 400 }
      );
    }

    if (order.escrow_released) {
      return NextResponse.json({ success: true, already_released: true });
    }

    if (!["authorized", "paid"].includes(order.payment_status)) {
      return NextResponse.json(
        { error: `Cannot release escrow with payment status ${order.payment_status}` },
        { status: 400 }
      );
    }

    let paymentReference = order.payment_reference || null;
    const providerName = order.payment_provider || "placeholder";

    // Stripe escrow: capture the manually-held PaymentIntent
    if (providerName === "stripe" && order.payment_status === "authorized" && paymentReference) {
      const stripe = getStripeServer();
      const captured = await stripe.paymentIntents.capture(
        paymentReference,
        {},
        { idempotencyKey: `escrow_release_${order.id}` }
      );
      paymentReference = captured.id;
    }

    const now = new Date().toISOString();

    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .update({ status: "completed" })
      .eq("order_id", order.id)
      .eq("status", "pending");
    if (txError) {
      throw new Error(txError.message);
    }

    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        escrow_released: true,
        escrow_released_at: now,
        payment_status: "paid",
        payment_reference: paymentReference,
      })
      .eq("id", orderId);
    if (orderUpdateError) {
      throw new Error(orderUpdateError.message);
    }

    const { error: eventError } = await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      actor_id: user.id,
      event_type: "payment",
      metadata: {
        action: "escrow_released",
        provider: providerName,
        payment_reference: paymentReference,
      },
    });
    if (eventError) {
      throw new Error(eventError.message);
    }

    const { error: messageError } = await supabaseAdmin.from("order_messages").insert({
      order_id: order.id,
      sender_id: user.id,
      content: "Escrow released and payout marked as available.",
      message_type: "system",
    });
    if (messageError) {
      throw new Error(messageError.message);
    }

    return NextResponse.json({ success: true, provider: providerName });
  } catch (error) {
    console.error("[Escrow Release]", error);
    const message = error instanceof Error ? error.message : "Failed to release escrow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
