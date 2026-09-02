import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyCronSecret } from "@/lib/api-security";
import { getActiveProvider } from "@/lib/payment-provider";

export const runtime = "nodejs";


export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    if (!verifyCronSecret(authHeader, cronSecret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: count, error } = await supabaseAdmin.rpc("auto_complete_orders");

    if (error) {
      console.error("[Auto-Complete] RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Reveal blind-window reviews whose deadline has passed (counterpart never reviewed).
    const { error: revealError } = await supabaseAdmin.rpc("reveal_due_reviews");
    if (revealError) {
      console.error("[Auto-Complete] reveal_due_reviews error:", revealError);
    }

    // Transfer funds to sellers for completed orders that haven't been transferred yet
    const { data: pendingTransfers, error: transferQueryError } = await supabaseAdmin
      .from("orders")
      .select("id, seller_id, buyer_id")
      .eq("status", "completed")
      .is("transfer_status", null)
      .in("payment_status", ["paid"])
      .limit(50);

    if (transferQueryError) {
      console.error("[Auto-Complete] Transfer query error:", transferQueryError);
      return NextResponse.json({ error: transferQueryError.message }, { status: 500 });
    }

    let transferred = 0;
    let transferFailures = 0;
    const provider = getActiveProvider();

    for (const order of pendingTransfers || []) {
      try {
        await provider.transferToSeller(order.id);
        transferred++;
      } catch (err) {
        transferFailures++;
        console.error(`[Auto-Complete] Transfer failed for order ${order.id}:`, err);

        // Record failure in DB
        try {
          await supabaseAdmin
            .from("order_events")
            .insert({
              order_id: order.id,
              event_type: "transfer_failed",
              actor_id: null, // system action
              metadata: {
                error: err instanceof Error ? err.message : "Unknown error",
                attempt_at: new Date().toISOString(),
              },
            });
        } catch {
          // Don't fail the loop
        }

        // Notify seller
        if (order.seller_id) {
          try {
            await supabaseAdmin
              .from("notifications")
              .insert({
                user_id: order.seller_id,
                // notifications.actor_id is NOT NULL; attribute to the buyer.
                actor_id: order.buyer_id,
                type: "order_transfer_failed",
                order_id: order.id,
                content: "Payment transfer for order failed. Our team will retry automatically.",
                read: false,
              });
          } catch {
            // Don't fail the loop
          }
        }
      }
    }

    return NextResponse.json({
      auto_completed: count ?? 0,
      transfers_processed: transferred,
      transfer_failures: transferFailures,
    });
  } catch (error) {
    console.error("[Auto-Complete]", error);
    const message = error instanceof Error ? error.message : "Auto-completion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
