import { NextResponse } from "next/server";
import { capturePayPalEscrowAuthorization } from "@/lib/paypal-escrow";
import { supabaseAdmin } from "@/lib/supabase-server";

type PendingEscrowOrder = {
  id: string;
  payment_provider: string | null;
  payment_status: string;
  payment_reference: string | null;
  paypal_order_id: string | null;
};

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
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: count, error } = await supabaseAdmin.rpc("auto_complete_orders");

    if (error) {
      console.error("[Auto-Complete] RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Release escrow for completed commission orders.
    const { data: pendingEscrow, error: escrowQueryError } = await supabaseAdmin
      .from("orders")
      .select("id, payment_provider, payment_status, payment_reference, paypal_order_id")
      .eq("status", "completed")
      .eq("escrow_released", false)
      .eq("listing_type", "service")
      .in("payment_status", ["authorized", "paid"])
      .returns<PendingEscrowOrder[]>();

    if (escrowQueryError) {
      console.error("[Auto-Complete] Escrow query error:", escrowQueryError);
      return NextResponse.json({ error: escrowQueryError.message }, { status: 500 });
    }

    let escrowReleased = 0;
    let escrowReleaseFailures = 0;

    for (const order of pendingEscrow || []) {
      try {
        const providerName = order.payment_provider || "placeholder";
        let paymentReference = order.payment_reference || order.paypal_order_id || null;

        if (providerName === "paypal" && order.payment_status === "authorized") {
          if (!order.paypal_order_id) {
            throw new Error("Missing PayPal order ID for auto escrow release");
          }

          const captureResult = await capturePayPalEscrowAuthorization({
            paypalOrderId: order.paypal_order_id,
            authorizationReference: order.payment_reference,
            idempotencyKey: `escrow_release_auto_${order.id}`,
          });

          paymentReference = captureResult.paymentReference;
        }

        const { error: txError } = await supabaseAdmin
          .from("transactions")
          .update({ status: "completed" })
          .eq("order_id", order.id)
          .eq("status", "pending");
        if (txError) {
          throw new Error(txError.message);
        }

        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({
            escrow_released: true,
            escrow_released_at: new Date().toISOString(),
            payment_status: "paid",
            payment_reference: paymentReference,
          })
          .eq("id", order.id);
        if (updateError) {
          throw new Error(updateError.message);
        }

        const { error: eventError } = await supabaseAdmin.from("order_events").insert({
          order_id: order.id,
          event_type: "payment",
          metadata: {
            action: "escrow_released_auto",
            provider: providerName,
            payment_reference: paymentReference,
          },
        });
        if (eventError) {
          throw new Error(eventError.message);
        }

        escrowReleased += 1;
      } catch (releaseError) {
        escrowReleaseFailures += 1;
        console.error(`[Auto-Complete] Escrow release failed for order ${order.id}:`, releaseError);
      }
    }

    return NextResponse.json({
      auto_completed: count ?? 0,
      escrow_released: escrowReleased,
      escrow_release_failures: escrowReleaseFailures,
    });
  } catch (error) {
    console.error("[Auto-Complete]", error);
    const message = error instanceof Error ? error.message : "Auto-completion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
