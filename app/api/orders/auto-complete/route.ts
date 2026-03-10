import { NextResponse } from "next/server";
import { normalizePaymentProvider, type PaymentProvider } from "@/lib/payments";
import { finalizeOrderEscrowRelease } from "@/lib/payments-server";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

type PendingEscrowOrder = {
  id: string;
  payment_provider: PaymentProvider | null;
  payment_status: string;
  payment_reference: string | null;
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
      .select("id, payment_provider, payment_status, payment_reference")
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
        const providerName = normalizePaymentProvider(order.payment_provider);
        let paymentReference = order.payment_reference || null;

        if (providerName === "stripe") {
          if (!paymentReference) {
            throw new Error("Missing Stripe payment reference for escrow release");
          }

          const stripe = getStripeServer();
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentReference);

          if (paymentIntent.status === "requires_capture") {
            const captured = await stripe.paymentIntents.capture(
              paymentReference,
              {},
              { idempotencyKey: `escrow_release_auto_${order.id}` }
            );
            paymentReference = captured.id;
          } else if (paymentIntent.status !== "succeeded") {
            throw new Error(`Cannot release escrow: payment status is ${paymentIntent.status}`);
          }
        }

        await finalizeOrderEscrowRelease({
          orderId: order.id,
          provider: providerName,
          paymentReference: paymentReference || `placeholder:${order.id}`,
          source: "api.orders.auto_complete",
        });

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
