import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { stripe } from "@/lib/stripe";

/**
 * Auto-complete orders past their deadline.
 * Called by a cron job / Supabase Edge Function on a schedule.
 * Also releases escrow for newly completed commission orders.
 *
 * Auth: Uses a shared secret header for cron authentication.
 */
export async function POST(request: Request) {
  try {
    // Verify cron secret (if set)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Call the DB function that auto-completes overdue orders
    const { data: count, error } = await supabaseAdmin.rpc("auto_complete_orders");

    if (error) {
      console.error("[Auto-Complete] RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Release escrow for any completed commission orders that haven't been released yet
    const { data: pendingEscrow } = await supabaseAdmin
      .from("orders")
      .select("id, payment_intent_id, amount, platform_fee, seller_amount, currency")
      .eq("status", "completed")
      .eq("escrow_released", false)
      .eq("listing_type", "service")
      .not("payment_intent_id", "is", null);

    let escrowReleased = 0;
    if (pendingEscrow && pendingEscrow.length > 0) {
      for (const order of pendingEscrow) {
        try {
          const pi = await stripe.paymentIntents.retrieve(order.payment_intent_id!);
          if (pi.status === "requires_capture") {
            await stripe.paymentIntents.capture(order.payment_intent_id!);

            await supabaseAdmin.from("transactions").insert([
              {
                order_id: order.id,
                type: "payment",
                amount: order.amount,
                currency: order.currency,
                stripe_payment_intent_id: order.payment_intent_id,
                status: "completed",
              },
              {
                order_id: order.id,
                type: "platform_fee",
                amount: order.platform_fee,
                currency: order.currency,
                stripe_payment_intent_id: order.payment_intent_id,
                status: "completed",
              },
              {
                order_id: order.id,
                type: "seller_payout",
                amount: order.seller_amount,
                currency: order.currency,
                stripe_payment_intent_id: order.payment_intent_id,
                status: "completed",
              },
            ]);

            await supabaseAdmin
              .from("orders")
              .update({
                escrow_released: true,
                escrow_released_at: new Date().toISOString(),
                payment_status: "paid",
              })
              .eq("id", order.id);

            escrowReleased++;
          }
        } catch (err) {
          console.error(`[Auto-Complete] Failed to release escrow for order ${order.id}:`, err);
        }
      }
    }

    return NextResponse.json({
      auto_completed: count ?? 0,
      escrow_released: escrowReleased,
    });
  } catch (error) {
    console.error("[Auto-Complete]", error);
    const message = error instanceof Error ? error.message : "Auto-completion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
