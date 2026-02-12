import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse } from "@/lib/api-security";
import { getPaymentProvider } from "@/lib/payments";
import { getActiveProvider } from "@/lib/payment-provider";
import { supabaseAdmin } from "@/lib/supabase-server";

type RefundableOrder = {
  id: string;
  buyer_id: string;
  status: string;
  payment_status: string;
  payment_intent_id: string | null;
  paypal_order_id: string | null;
  payment_reference: string | null;
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
      .select("id, buyer_id, status, payment_status, payment_intent_id, paypal_order_id, payment_reference, amount, currency")
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

    const providerName = getPaymentProvider();
    const provider = getActiveProvider();

    // Determine the payment reference for the active provider
    const paymentRef = providerName === "stripe"
      ? order.payment_intent_id
      : providerName === "paypal"
        ? (order.paypal_order_id || order.payment_reference)
        : order.payment_reference;

    // Issue refund via provider (if not placeholder)
    if (providerName !== "placeholder" && paymentRef) {
      await provider.refundPayment(paymentRef, order.id, order.amount);
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

    // Mark existing pending transactions as refunded
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
        metadata: { provider: providerName, reason: reason || null },
      });
    }

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      actor_id: user.id,
      event_type: "payment",
      metadata: {
        action: "refund",
        provider: providerName,
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

    return NextResponse.json({ success: true, provider: providerName });
  } catch (error) {
    console.error("[Refund]", error);
    const message = error instanceof Error ? error.message : "Failed to process refund";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
