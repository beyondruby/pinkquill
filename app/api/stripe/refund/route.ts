import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse } from "@/lib/api-security";
import { getPaymentProvider } from "@/lib/payments";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

type RefundableOrder = {
  id: string;
  buyer_id: string;
  status: string;
  payment_status: string;
  payment_intent_id: string | null;
  amount: number;
  currency: string;
};

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
      scope: "payments.refund",
      limit: 12,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const body = await request.json();
    const { order_id: orderId, reason } = body as { order_id?: string; reason?: string };

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, payment_status, payment_intent_id, amount, currency")
      .eq("id", orderId)
      .single<RefundableOrder>();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.payment_status === "refunded") {
      return NextResponse.json({ success: true, already_refunded: true });
    }

    if (!["authorized", "paid", "partially_refunded"].includes(order.payment_status)) {
      return NextResponse.json(
        { error: `Cannot refund payment in status: ${order.payment_status}` },
        { status: 400 }
      );
    }

    const provider = getPaymentProvider();
    if (provider === "stripe") {
      if (!order.payment_intent_id || !order.payment_intent_id.startsWith("pi_")) {
        return NextResponse.json({ error: "Missing Stripe payment intent for this order" }, { status: 400 });
      }

      const stripe = getStripeServer();
      await stripe.refunds.create({
        payment_intent: order.payment_intent_id,
        reason: "requested_by_customer",
        metadata: {
          order_id: order.id,
          requested_by: user.id,
        },
      });
    }

    const now = new Date().toISOString();

    await supabaseAdmin
      .from("orders")
      .update({
        status: "refunded",
        payment_status: "refunded",
        cancel_reason: reason || "Refund requested by buyer",
        updated_at: now,
      })
      .eq("id", orderId);

    // Mark existing pending transactions as refunded first.
    await supabaseAdmin
      .from("transactions")
      .update({ status: "refunded" })
      .eq("order_id", order.id)
      .eq("status", "pending");

    const { data: existingRefund } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("order_id", order.id)
      .eq("type", "refund")
      .maybeSingle();

    if (!existingRefund) {
      await supabaseAdmin.from("transactions").insert({
        order_id: order.id,
        type: "refund",
        amount: order.amount,
        currency: order.currency,
        status: "completed",
        metadata: { provider, reason: reason || null },
      });
    }

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      actor_id: user.id,
      event_type: "payment",
      metadata: {
        action: "refund",
        provider,
        reason: reason || null,
      },
    });

    await supabaseAdmin.from("order_messages").insert({
      order_id: order.id,
      sender_id: user.id,
      content: reason
        ? `Refund requested by buyer. Reason: ${reason}`
        : "Refund requested by buyer.",
      message_type: "system",
    });

    return NextResponse.json({ success: true, provider });
  } catch (error) {
    console.error("[Refund]", error);
    const message = error instanceof Error ? error.message : "Failed to process refund";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
