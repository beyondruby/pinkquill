"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { adminFetch, useAdminQuery } from "@/lib/hooks/useAdmin";
import { showToast } from "@/lib/utils/toast";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import type { StatusTone } from "@/lib/utils/orderStatus";
import { ArmedButton, cents, Chip, dt, Empty, Panel, Rows, Skeleton } from "./ui";

interface Refund {
  id: string; order_id: string; kind: "full" | "partial"; status: string; amount_cents: number; currency: string; listing_amount_cents: number | null; listing_currency: string | null;
  seller_share_cents: number | null; initiator_role: string; reason: string | null; note: string | null; last_error: string | null; attempts: number; stripe_refund_id: string | null;
  created_at: string; updated_at: string; decided_at: string | null; previous_status: string | null;
  order: { order_number: string; status: string; payment_status: string; listing_type: string; buyer: { username: string; display_name: string | null } | null; seller: { username: string; display_name: string | null } | null; product: { title: string } | null } | null;
}

const TONE: Record<string, StatusTone> = { needs_review: "red", failed: "red", requested: "amber", approved: "purple", processing: "purple", succeeded: "emerald", declined: "neutral", cancelled: "neutral" };
const LABEL: Record<string, string> = { needs_review: "Needs review", failed: "Failed", requested: "Waiting on seller", approved: "Approved · sending", processing: "Sending", succeeded: "Refunded", declined: "Declined", cancelled: "Cancelled" };

export default function AdminRefunds() {
  const [scope, setScope] = useState<"open" | "all">("open");
  const { data, loading, error, refetch } = useAdminQuery<{ refunds: Refund[] }>(`/api/admin/refunds?scope=${scope}`);
  const [cancelling, setCancelling] = useState<Refund | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (refund: Refund, action: "retry" | "cancel", extra?: Record<string, unknown>) => {
    const r = await adminFetch<{ execution?: { submitted?: number; needs_review?: number; errors?: string[] } }>("/api/admin/refunds", { json: { refund_id: refund.id, action, ...extra } });
    if (!r.ok) { showToast.error("That didn't go through", r.error); return false; }
    if (action === "retry") {
      const ex = r.data.execution;
      showToast.success(ex?.submitted ? "Refund sent to Stripe" : ex?.needs_review ? "Retried — Stripe refused again, still in review" : "Refund queued for the next run");
    } else showToast.success("Refund cancelled");
    await refetch();
    return true;
  };

  const decide = async (refund: Refund, approve: boolean) => {
    const { error: rpcError } = await supabase.rpc("decide_refund_request", { p_refund_id: refund.id, p_approve: approve, p_note: approve ? "Approved by Pinkquill" : "Declined by Pinkquill" });
    if (rpcError) { showToast.error("That didn't go through", rpcError.message); return; }
    showToast.success(approve ? "Refund approved on the seller's behalf" : "Refund request declined");
    await refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-ink">Refunds</h1>
        <div className="flex gap-1.5">
          {(["open", "all"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)} className={`px-3 py-1.5 rounded-full border text-xs font-ui font-semibold ${scope === s ? "bg-purple-primary/10 border-purple-primary/40 text-purple-800" : "bg-surface border-border-light text-muted"}`}>{s === "open" ? "Needs a person" : "Everything"}</button>
          ))}
        </div>
      </div>
      <p className="text-sm font-body text-muted">Retry puts a refund back in the executor&apos;s queue and runs it once now. Cancel marks it as not happening; a full refund that had cancelled the order puts the order back where it was.</p>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm font-body text-ink">{error}</div>}
      <Panel title={`${data?.refunds.length ?? 0} refund${data?.refunds.length === 1 ? "" : "s"}`}>
        {loading ? <Skeleton /> : !data?.refunds.length ? <Empty text={scope === "open" ? "No refunds need a person right now." : "No refunds yet."} /> : (
          <Rows>
            {data.refunds.map((r) => (
              <div key={r.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Chip label={LABEL[r.status] ?? r.status} tone={TONE[r.status] ?? "neutral"} />
                    <Link href={`/orders/${r.order_id}`} className="text-sm font-ui text-ink hover:text-purple-primary tabular-nums">{r.order?.order_number ?? r.order_id.slice(0, 8)}</Link>
                    <span className="text-sm font-body text-muted truncate">{r.order?.product?.title ?? ""}</span>
                  </div>
                  <p className="text-2xs font-body text-muted mt-1">
                    {r.kind} · {cents(r.listing_amount_cents, r.listing_currency ?? "usd")} listing / {cents(r.amount_cents, r.currency)} on the card · by {r.initiator_role} · {dt(r.created_at)}
                    {r.order ? ` · @${r.order.buyer?.username ?? "?"} ← @${r.order.seller?.username ?? "?"}` : ""}{r.attempts ? ` · ${r.attempts} attempt${r.attempts === 1 ? "" : "s"}` : ""}
                  </p>
                  {r.reason && <p className="text-2xs font-body text-muted">“{r.reason}”</p>}
                  {r.last_error && <p className="text-2xs font-body text-red-700 mt-0.5">Stripe: {r.last_error}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {(r.status === "needs_review" || r.status === "failed") && <ArmedButton label="Retry" confirmLabel="Retry now" onConfirm={() => act(r, "retry").then(() => undefined)} variant="primary" />}
                  {["needs_review", "failed", "approved"].includes(r.status) && <Button size="sm" variant="secondary" onClick={() => { setCancelling(r); setNote(""); }}>Cancel refund</Button>}
                  {r.status === "requested" && <>
                    <ArmedButton label="Approve for seller" confirmLabel="Approve" onConfirm={() => decide(r, true)} variant="primary" />
                    <ArmedButton label="Decline" confirmLabel="Decline" onConfirm={() => decide(r, false)} />
                  </>}
                </div>
              </div>
            ))}
          </Rows>
        )}
      </Panel>

      {cancelling && (
        <Sheet isOpen onClose={() => setCancelling(null)} busy={busy} title="Cancel this refund?" subtitle={`${cents(cancelling.listing_amount_cents, cancelling.listing_currency ?? "usd")} will not be returned to the buyer.${cancelling.kind === "full" && cancelling.order?.status === "cancelled" ? " The order goes back to where it was before the refund." : ""}`}
          footer={<><Button variant="secondary" onClick={() => setCancelling(null)} disabled={busy}>Keep it</Button><Button variant="danger" loading={busy} loadingText="Cancelling…" onClick={async () => { setBusy(true); const ok = await act(cancelling, "cancel", { note }); setBusy(false); if (ok) setCancelling(null); }}>Cancel refund</Button></>}
        >
          <label className="block text-sm font-ui font-semibold text-ink mb-1.5">Why <span className="font-normal text-muted text-xs">shown on the order thread</span></label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Card was already refunded through Stripe support." className="w-full px-3.5 py-2.5 rounded-xl border border-border-light bg-surface text-sm font-body text-ink focus:outline-none focus:ring-2 focus:ring-purple-primary/25" />
        </Sheet>
      )}
    </div>
  );
}
