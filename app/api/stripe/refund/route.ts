import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";

type RefundableOrder = {
  id: string;
  buyer_id: string;
  status: string;
  payment_status: string;
};

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
      scope: "payments.refund",
      limit: 5,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const parsed = await safeJsonParse<{ order_id?: string; reason?: string }>(request);
    if ("error" in parsed) return parsed.error;
    const { order_id: orderId } = parsed.data;
    // Sanitize and limit refund reason to prevent XSS and oversized inputs
    const reason = parsed.data.reason
      ? String(parsed.data.reason).trim().slice(0, 500)
      : undefined;

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, payment_status")
      .eq("id", orderId)
      .single<RefundableOrder>();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.payment_status === "refunded" || order.status === "refunded") {
      return NextResponse.json({ success: true, already_refunded: true });
    }

    if (order.status === "refund_requested") {
      return NextResponse.json({ success: true, already_requested: true, status: "refund_requested" });
    }

    if (!["authorized", "paid", "partially_refunded"].includes(order.payment_status)) {
      return NextResponse.json(
        { error: `Cannot refund payment in status: ${order.payment_status}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "refund_requested",
        cancel_reason: reason || "Refund requested by buyer",
        updated_at: now,
      })
      .eq("id", orderId);
    if (orderUpdateError) {
      return NextResponse.json({ error: orderUpdateError.message || "Failed to request refund" }, { status: 500 });
    }

    const { error: eventError } = await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      actor_id: user.id,
      event_type: "payment",
      metadata: {
        action: "refund_requested",
        reason: reason || null,
      },
    });
    if (eventError) {
      return NextResponse.json({ error: eventError.message || "Failed to log refund request" }, { status: 500 });
    }

    const { error: messageError } = await supabaseAdmin.from("order_messages").insert({
      order_id: order.id,
      sender_id: user.id,
      content: reason
        ? `Refund requested by buyer. Reason: ${reason}`
        : "Refund requested by buyer.",
      message_type: "system",
    });
    if (messageError) {
      return NextResponse.json({ error: messageError.message || "Failed to log refund request" }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: "refund_requested" });
  } catch (error) {
    console.error("[Refund]", error);
    const message = error instanceof Error ? error.message : "Failed to process refund";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
