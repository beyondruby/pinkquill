import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getActiveProvider } from "@/lib/payment-provider";

export const runtime = "nodejs";

function verifyCronSecret(authHeader: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  if (!authHeader || authHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

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

    // Transfer funds to sellers for completed orders that haven't been transferred yet
    const { data: pendingTransfers, error: transferQueryError } = await supabaseAdmin
      .from("orders")
      .select("id")
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
