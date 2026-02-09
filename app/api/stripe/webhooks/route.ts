import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST() {
  const provider = getPaymentProvider();

  if (provider !== "stripe") {
    return NextResponse.json({
      received: true,
      skipped: true,
      reason: "Webhook processing is disabled while placeholder payments are active.",
    });
  }

  return NextResponse.json(
    {
      error: "Stripe webhook handling is disabled until Stripe setup is completed.",
    },
    { status: 503 }
  );
}
