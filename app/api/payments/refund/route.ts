import { NextResponse } from "next/server";
import { getAuthUser, createSupabaseServerClient } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { getActiveProvider } from "@/lib/payment-provider";
import { supabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REFUND_RESTORABLE_STATUSES = new Set([
  "paid",
  "completed",
  "delivered",
  "in_progress",
  "submitted",
  "shipped",
]);

/**
 * POST /api/payments/refund
 *
 * Two distinct flows:
 *
 * 1. BUYER requests a refund → order goes to "refund_requested" status.
 *    No money moves yet. Seller must approve.
 *
 * 2. SELLER approves/issues a refund → actual Stripe refund is processed.
 *    Can be triggered by seller approving a buyer request OR proactively.
 *
 * Body: { order_id: string, reason?: string, action?: "request" | "approve" | "decline" }
 *   - action defaults to "request" for buyers and "approve" for sellers
 */
export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const user = await getAuthUser(request);
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

  const parsed = await safeJsonParse<{
    order_id?: string;
    reason?: string;
    action?: "request" | "approve" | "decline";
  }>(request);
  if ("error" in parsed) return parsed.error;

  const { order_id, reason, action } = parsed.data;
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

  const isBuyer = user.id === order.buyer_id;
  const isSeller = user.id === order.seller_id;
  if (!isBuyer && !isSeller) {
    return NextResponse.json({ error: "You are not a participant in this order" }, { status: 403 });
  }

  // Already refunded
  if (order.payment_status === "refunded") {
    return NextResponse.json({ error: "This order has already been refunded" }, { status: 400 });
  }

  // Determine the action
  const resolvedAction = action || (isSeller ? "approve" : "request");

  // ─── BUYER: Request a refund (no money moves) ───────────────────
  if (resolvedAction === "request" && isBuyer) {
    // The guarded RPC (supabase/migrations/20260621_phase1_request_refund_escrow_guard.sql)
    // owns the rules: only paid/completed/delivered orders, never after escrow
    // release, and it writes the event, system message and seller notification
    // itself. It runs as the caller (cookie client) so auth.uid() is the buyer.
    try {
      const supabase = await createSupabaseServerClient();
      const { error: rpcError } = await supabase.rpc("request_refund", {
        p_order_id: order_id,
        p_reason: reason || null,
      });

      if (rpcError) {
        const message = rpcError.message || "Failed to request refund";
        const isRuleViolation =
          /cannot request|not authorized|after funds have been released/i.test(message);
        return NextResponse.json({ error: message }, { status: isRuleViolation ? 400 : 500 });
      }

      return NextResponse.json({ success: true, status: "refund_requested" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to request refund";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ─── SELLER: Approve/issue a refund (processes Stripe refund) ───
  if (resolvedAction === "approve" && isSeller) {
    const approvableStatuses = [
      "refund_requested", "paid", "completed", "delivered",
      "in_progress", "submitted", "shipped",
    ];
    if (!approvableStatuses.includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot issue a refund for an order with status: ${order.status}` },
        { status: 400 }
      );
    }

    try {
      // Process the actual Stripe refund
      const provider = getActiveProvider();
      const result = await provider.refundPayment(order_id);

      if (!result.success) {
        return NextResponse.json({ error: "Refund processing failed" }, { status: 500 });
      }

      // Stripe refunds emit canonical side effects from the webhook. Avoid
      // duplicating notifications, order events, and system messages here.
      if (provider.name !== "stripe") {
        await supabaseAdmin.from("notifications").insert({
          user_id: order.buyer_id,
          actor_id: order.seller_id,
          type: "order_refunded",
          order_id: order.id,
          content: `Your refund of $${Number(order.amount).toFixed(2)} has been approved and processed.`,
        });

        await supabaseAdmin.from("order_events").insert({
          order_id: order.id,
          actor_id: user.id,
          event_type: "payment",
          metadata: {
            action: "seller_approved_refund",
            reason: reason || null,
            previous_status: order.status,
          },
        });

        await supabaseAdmin.from("order_messages").insert({
          order_id: order.id,
          sender_id: user.id,
          content: `Refund approved and processed${reason ? `: ${reason}` : "."}`,
          message_type: "system",
        });
      }

      return NextResponse.json({ success: true, status: "refunded" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refund failed";
      console.error("[Refund API] Error:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ─── SELLER: Decline a refund request (restore previous status) ──
  if (resolvedAction === "decline" && isSeller) {
    if (order.status !== "refund_requested") {
      return NextResponse.json(
        { error: "No refund request to decline" },
        { status: 400 }
      );
    }

    try {
      const now = new Date().toISOString();
      const { data: refundRequestEvent } = await supabaseAdmin
        .from("order_events")
        .select("from_status")
        .eq("order_id", order_id)
        .eq("to_status", "refund_requested")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ from_status: string | null }>();

      const restoredStatus =
        refundRequestEvent?.from_status &&
        REFUND_RESTORABLE_STATUSES.has(refundRequestEvent.from_status)
          ? refundRequestEvent.from_status
          : "paid";

      // Restore the last known status before the refund request.
      await supabaseAdmin
        .from("orders")
        .update({
          status: restoredStatus,
          updated_at: now,
        })
        .eq("id", order_id);

      // Notify buyer
      await supabaseAdmin.from("notifications").insert({
        user_id: order.buyer_id,
        actor_id: order.seller_id,
        type: "order_paid",
        order_id: order.id,
        content: `Your refund request has been declined by the seller.${reason ? ` Reason: ${reason}` : ""}`,
      });

      // Order event
      await supabaseAdmin.from("order_events").insert({
        order_id: order.id,
        actor_id: user.id,
        event_type: "status_change",
        from_status: "refund_requested",
        to_status: restoredStatus,
        metadata: {
          action: "seller_declined_refund",
          reason: reason || null,
          restored_status: restoredStatus,
        },
      });

      // System message
      await supabaseAdmin.from("order_messages").insert({
        order_id: order.id,
        sender_id: user.id,
        content: `Refund request declined${reason ? `: ${reason}` : "."}`,
        message_type: "system",
      });

      return NextResponse.json({ success: true, status: restoredStatus });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to decline refund";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Invalid action/role combination
  if (resolvedAction === "approve" && isBuyer) {
    return NextResponse.json({ error: "Only the seller can approve a refund" }, { status: 403 });
  }
  if (resolvedAction === "request" && isSeller) {
    return NextResponse.json({ error: "Sellers should use action: 'approve' to issue refunds directly" }, { status: 400 });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
