/** One dispute with everything needed to judge it (Phase 2f): order, people, thread, deliveries, evidence, a draft Stripe evidence text for chargebacks. */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { loadDisputePack } from "@/lib/admin/dispute-pack";
import { draftEvidenceText } from "@/lib/admin/chargeback-evidence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const { id } = await context.params;
  const loaded = await loadDisputePack(id);
  if (!loaded) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  const { dispute, pack, buyer_id, seller_id } = loaded;
  return NextResponse.json({
    dispute, pack, buyer_id, seller_id,
    draft: dispute.kind === "chargeback" ? draftEvidenceText(pack) : null,
  });
}
