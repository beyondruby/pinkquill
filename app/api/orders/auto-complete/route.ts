import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

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
      .select("id, payment_provider")
      .eq("status", "completed")
      .eq("escrow_released", false)
      .eq("listing_type", "service")
      .in("payment_status", ["authorized", "paid"]);

    if (escrowQueryError) {
      console.error("[Auto-Complete] Escrow query error:", escrowQueryError);
      return NextResponse.json({ error: escrowQueryError.message }, { status: 500 });
    }

    let escrowReleased = 0;

    for (const order of pendingEscrow || []) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "completed" })
        .eq("order_id", order.id)
        .eq("status", "pending");

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          escrow_released: true,
          escrow_released_at: new Date().toISOString(),
          payment_status: "paid",
        })
        .eq("id", order.id);

      if (!updateError) {
        escrowReleased += 1;
        await supabaseAdmin.from("order_events").insert({
          order_id: order.id,
          event_type: "payment",
          metadata: { action: "escrow_released_auto", provider: order.payment_provider || "placeholder" },
        });
      }
    }

    return NextResponse.json({
      auto_completed: count ?? 0,
      escrow_released: escrowReleased,
      provider: "placeholder",
    });
  } catch (error) {
    console.error("[Auto-Complete]", error);
    const message = error instanceof Error ? error.message : "Auto-completion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
