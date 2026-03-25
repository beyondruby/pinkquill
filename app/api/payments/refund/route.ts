import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveProvider } from "@/lib/payment-provider";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/payments/refund
 *
 * Issues a refund for an order. Can be called by the buyer OR the seller.
 * - Buyer: requesting a refund on their purchase
 * - Seller: proactively issuing a refund to the buyer
 *
 * Body: { order_id: string, reason?: string }
 */
export async function POST(request: Request) {
  // Authenticate
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  let body: { order_id?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { order_id, reason } = body;
  if (!order_id) {
    return NextResponse.json({ error: "order_id is required" }, { status: 400 });
  }

  // Fetch order
  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("id, buyer_id, seller_id, status, payment_status, amount, currency")
    .eq("id", order_id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Verify caller is buyer or seller
  const isBuyer = user.id === order.buyer_id;
  const isSeller = user.id === order.seller_id;
  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: "You are not a participant in this order" }, { status: 403 });
  }

  // Only allow refunds on paid/completed/delivered orders
  const refundableStatuses = ["paid", "completed", "delivered", "in_progress", "submitted", "shipped"];
  if (!refundableStatuses.includes(order.status)) {
    return NextResponse.json(
      { error: `Cannot refund an order with status: ${order.status}` },
      { status: 400 }
    );
  }

  // Already refunded
  if (order.payment_status === "refunded") {
    return NextResponse.json(
      { error: "This order has already been refunded" },
      { status: 400 }
    );
  }

  try {
    // Call the payment provider to process the refund
    const provider = getActiveProvider();
    const result = await provider.refundPayment(order_id);

    if (!result.success) {
      return NextResponse.json({ error: "Refund processing failed" }, { status: 500 });
    }

    // Create notification for the other party
    const notifyUserId = isBuyer ? order.seller_id : order.buyer_id;
    const notificationType = isSeller ? "order_refunded" : "refund_requested";

    await supabaseAdmin.from("notifications").insert({
      user_id: notifyUserId,
      actor_id: user.id,
      type: notificationType,
      order_id: order.id,
      content: isSeller
        ? `The seller issued a refund of $${Number(order.amount).toFixed(2)} for your order.`
        : `A refund of $${Number(order.amount).toFixed(2)} has been requested.`,
    });

    // Create order event
    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      actor_id: user.id,
      event_type: "payment",
      metadata: {
        action: isSeller ? "seller_refund" : "buyer_refund_request",
        reason: reason || null,
        initiated_by: isSeller ? "seller" : "buyer",
      },
    });

    // Create system message in order chat
    await supabaseAdmin.from("order_messages").insert({
      order_id: order.id,
      sender_id: user.id,
      content: isSeller
        ? `Seller issued a full refund${reason ? `: ${reason}` : "."}`
        : `Buyer requested a refund${reason ? `: ${reason}` : "."}`,
      message_type: "system",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    console.error("[Refund API] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
