"use client";

import Link from "next/link";
import { useState } from "react";
import { adminFetch, useAdminQuery } from "@/lib/hooks/useAdmin";
import { showToast } from "@/lib/utils/toast";
import { DISPUTE_REASON_LABELS, DISPUTE_RESOLUTION_LABELS, type DisputeReason, type DisputeResolution } from "@/lib/types/store";
import { formatCurrency } from "@/lib/utils/currency";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { EVIDENCE_FILE_FIELDS, EVIDENCE_TEXT_FIELDS, type EvidenceFileField, type EvidencePack, type EvidenceText } from "@/lib/admin/chargeback-evidence";
import type { DisputeRow } from "@/lib/admin/dispute-pack";
import { cents, Chip, dt, KV, Panel } from "./ui";

/**
 * One dispute (Phase 2f). Platform disputes: read everything, pick a
 * resolution (the 1d RPC does the money). Chargebacks: assemble evidence,
 * save it to Stripe as a draft, then submit — confirmed, because Stripe
 * allows exactly one submission.
 */

interface Detail { dispute: DisputeRow; pack: EvidencePack; buyer_id: string; seller_id: string; draft: EvidenceText | null }

const RESOLUTIONS: DisputeResolution[] = ["release_to_seller", "partial_refund", "full_refund", "order_cancelled", "mutual_agreement"];
const TEXT_LABELS: Record<string, string> = {
  product_description: "What was sold", customer_communication: "Message thread", uncategorized_text: "Our account of what happened", access_activity_log: "Timeline",
  service_date: "Service date (YYYY-MM-DD)", customer_name: "Customer name", customer_email_address: "Customer email", refund_policy_disclosure: "Refund policy shown", cancellation_policy_disclosure: "Cancellation policy shown",
};
const INPUT = "w-full px-3.5 py-2.5 rounded-xl border border-border-light bg-surface text-sm font-body text-ink focus:outline-none focus:ring-2 focus:ring-purple-primary/25";

function FileLink({ path, name }: { path: string; name: string }) {
  return (
    <button type="button" className="text-2xs font-ui text-purple-primary hover:underline" onClick={async () => {
      const r = await adminFetch<{ url: string }>(`/api/admin/files?path=${encodeURIComponent(path)}`);
      if (r.ok) window.open(r.data.url, "_blank", "noopener"); else showToast.error("Couldn't open file", r.error);
    }}>{name}</button>
  );
}

export default function AdminDisputeDetail({ disputeId }: { disputeId: string }) {
  const { data, loading, error, refetch } = useAdminQuery<Detail>(`/api/admin/disputes/${disputeId}`);
  const [resolution, setResolution] = useState<DisputeResolution>("release_to_seller");
  const [notes, setNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [confirmResolve, setConfirmResolve] = useState(false);
  // null = untouched: the Stripe draft from the server shows until the operator edits.
  const [textEdits, setTextEdits] = useState<EvidenceText | null>(null);
  const [fileFields, setFileFields] = useState<Record<string, EvidenceFileField | "">>({});
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [busy, setBusy] = useState<"resolve" | "save" | "submit" | null>(null);
  const [showThread, setShowThread] = useState(false);

  if (loading) return <div className="space-y-3"><div className="h-8 w-56 rounded bg-skeleton/60 animate-pulse" /><div className="h-64 rounded-2xl bg-skeleton/60 animate-pulse" /></div>;
  if (error || !data) return <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm font-body text-ink">{error ?? "Not found"} · <Link href="/admin/disputes" className="text-purple-primary hover:underline">Back to disputes</Link></div>;

  const { dispute: d, pack } = data;
  const text: EvidenceText = textEdits ?? data.draft ?? {};
  const setText = (fn: (t: EvidenceText) => EvidenceText) => setTextEdits(fn(text));
  const open = ["open", "under_review", "escalated"].includes(d.status);
  const isChargeback = d.kind === "chargeback";
  const attachments = pack.evidenceItems.flatMap((e) => e.attachments.map((a) => ({ ...a, by: e.role })));
  const needsAmount = resolution === "partial_refund" || resolution === "mutual_agreement";

  const resolve = async () => {
    setBusy("resolve");
    const r = await adminFetch("/api/admin/disputes", { json: { dispute_id: d.id, resolution, notes: notes || undefined, refund_amount: needsAmount && refundAmount ? Number(refundAmount) : undefined } });
    setBusy(null);
    if (!r.ok) { showToast.error("That didn't go through", r.error); return; }
    setConfirmResolve(false);
    showToast.success("Dispute resolved");
    await refetch();
  };

  const sendEvidence = async (submit: boolean) => {
    setBusy(submit ? "submit" : "save");
    const files = attachments.filter((a) => fileFields[a.path]).map((a) => ({ path: a.path, field: fileFields[a.path] }));
    const r = await adminFetch<{ stripe_status: string }>("/api/admin/chargebacks", { json: { dispute_id: d.id, text, files, submit } });
    setBusy(null);
    if (!r.ok) { showToast.error("Stripe didn't take it", r.error); return; }
    setConfirmSubmit(false);
    showToast.success(submit ? `Submitted · Stripe says ${r.data.stripe_status.replace(/_/g, " ")}` : "Draft saved to Stripe");
    await refetch();
  };

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/disputes" className="text-xs font-ui text-muted hover:text-ink">← Disputes</Link>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <h1 className="font-display text-2xl font-semibold text-ink">{isChargeback ? "Chargeback" : "Dispute"} · {pack.order.order_number}</h1>
          <Chip label={d.status.replace(/_/g, " ")} tone={d.status === "resolved" ? "emerald" : open ? "amber" : "neutral"} />
          {d.stripe_status && <Chip label={`Stripe: ${d.stripe_status.replace(/_/g, " ")}`} tone="neutral" />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Panel title="The case">
            <div className="p-4 space-y-3">
              <KV items={[
                ["Reason", DISPUTE_REASON_LABELS[d.reason as DisputeReason] ?? d.reason],
                ["Opened", `${dt(d.created_at)}${d.initiated_by === data.buyer_id ? " by the buyer" : d.initiated_by === data.seller_id ? " by the seller" : isChargeback ? " by the buyer's bank" : ""}`],
                ["Amount", d.amount_cents != null ? cents(d.amount_cents, d.currency ?? "usd") : formatCurrency(pack.order.total_amount ?? pack.order.amount, pack.order.currency)],
                ...(d.evidence_due_by ? [["Evidence due", dt(d.evidence_due_by)] as [string, string]] : []),
                ...(d.stripe_dispute_id ? [["Stripe dispute", d.stripe_dispute_id] as [string, string]] : []),
                ...(d.resolution ? [["Resolution", `${DISPUTE_RESOLUTION_LABELS[d.resolution as DisputeResolution] ?? d.resolution}${d.resolution_notes ? ` — ${d.resolution_notes}` : ""} · ${dt(d.resolved_at)}`] as [string, string]] : []),
              ]} />
              {d.description && <p className="text-sm font-body text-ink whitespace-pre-wrap rounded-xl bg-subtle border border-border-light p-3">{d.description}</p>}
            </div>
          </Panel>

          <Panel title={`Evidence · ${pack.evidenceItems.length}`}>
            {pack.evidenceItems.length === 0 ? <p className="p-4 text-sm font-body text-muted">Nothing added yet.</p> : (
              <div className="divide-y divide-border-light">
                {pack.evidenceItems.map((e, i) => (
                  <div key={i} className="p-4">
                    <p className="text-xs font-ui text-muted">{e.role} · {dt(e.at)}</p>
                    {e.text && <p className="text-sm font-body text-ink whitespace-pre-wrap mt-1">{e.text}</p>}
                    {e.attachments.length > 0 && <div className="flex flex-wrap gap-3 mt-2">{e.attachments.map((a) => <FileLink key={a.path} path={a.path} name={a.name} />)}</div>}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title={`Messages · ${pack.messages.filter((m) => m.role !== "system").length}`} right={<button type="button" onClick={() => setShowThread((v) => !v)} className="text-xs font-ui font-semibold text-purple-primary hover:underline">{showThread ? "Hide" : "Show"}</button>}>
            {showThread && (
              <div className="divide-y divide-border-light max-h-[420px] overflow-y-auto">
                {pack.messages.map((m, i) => (
                  <div key={i} className={`px-4 py-2.5 text-sm ${m.role === "system" ? "font-body text-muted italic" : "font-body text-ink"}`}>
                    <span className="text-xs font-ui text-muted mr-2">{m.role} · {dt(m.at)}</span>{m.text}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Order">
            <div className="p-4">
              <KV items={[
                ["Listing", pack.product?.title ?? "—"],
                ["Package", pack.pricing?.variant_name ?? "—"],
                ["Buyer", `${pack.buyer.display_name ?? ""} @${pack.buyer.username ?? "?"}`],
                ["Creator", `${pack.seller.display_name ?? ""} @${pack.seller.username ?? "?"}`],
                ["Status", pack.order.status.replace(/_/g, " ")],
                ["Paid", formatCurrency(pack.order.total_amount ?? pack.order.amount, pack.order.currency)],
                ["Delivered", pack.order.submitted_at ? dt(pack.order.submitted_at) : "not yet"],
                ["Approved", pack.order.completed_at ? dt(pack.order.completed_at) : "not yet"],
                ["Deliveries", String(pack.deliveries.length)],
              ]} />
              <Link href={`/orders/${d.order_id}`} className="inline-block mt-3 text-xs font-ui font-semibold text-purple-primary hover:underline">Open the order page</Link>
            </div>
          </Panel>

          {!isChargeback && open && (
            <Panel title="Resolve">
              <div className="p-4 space-y-3">
                <select value={resolution} onChange={(e) => setResolution(e.target.value as DisputeResolution)} className={INPUT} aria-label="Resolution">
                  {RESOLUTIONS.map((r) => <option key={r} value={r}>{DISPUTE_RESOLUTION_LABELS[r] ?? r}</option>)}
                </select>
                {needsAmount && <input type="number" min={0} step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder={`Refund amount in ${pack.order.currency.toUpperCase()}`} className={INPUT} />}
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes both sides will see" className={INPUT} />
                <Button fullWidth onClick={() => setConfirmResolve(true)} disabled={needsAmount && !(Number(refundAmount) > 0)}>Resolve dispute</Button>
                <p className="text-2xs font-body text-muted">Refunds created here run through the normal refund executor. A held payout is released when the seller keeps the money.</p>
              </div>
            </Panel>
          )}
        </div>
      </div>

      {isChargeback && open && (
        <Panel title="Evidence for Stripe" right={<span className="text-2xs font-body text-muted">pre-filled from the order · edit freely</span>}>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {EVIDENCE_TEXT_FIELDS.map((f) => (
              <label key={f} className={["customer_communication", "uncategorized_text", "product_description", "access_activity_log"].includes(f) ? "lg:col-span-2" : ""}>
                <span className="block text-xs font-ui text-muted mb-1">{TEXT_LABELS[f] ?? f}</span>
                {["customer_name", "customer_email_address", "service_date"].includes(f)
                  ? <input value={text[f] ?? ""} onChange={(e) => setText((t) => ({ ...t, [f]: e.target.value }))} className={INPUT} />
                  : <textarea rows={f === "customer_communication" ? 8 : 4} value={text[f] ?? ""} onChange={(e) => setText((t) => ({ ...t, [f]: e.target.value }))} className={`${INPUT} font-mono text-xs`} />}
              </label>
            ))}
            <div className="lg:col-span-2">
              <span className="block text-xs font-ui text-muted mb-1">Files · one per Stripe field, 5 MB each</span>
              {attachments.length === 0 ? <p className="text-sm font-body text-muted">No files were attached as evidence. Sellers and buyers add them from the order page.</p> : (
                <div className="space-y-2">
                  {attachments.map((a) => (
                    <div key={a.path} className="flex items-center gap-3 text-sm">
                      <FileLink path={a.path} name={a.name} />
                      <span className="text-2xs font-body text-muted">{a.by}</span>
                      <select value={fileFields[a.path] ?? ""} onChange={(e) => setFileFields((m) => ({ ...m, [a.path]: e.target.value as EvidenceFileField | "" }))} className="ml-auto px-2 py-1.5 rounded-lg border border-border-light bg-surface text-xs font-body text-ink" aria-label={`Stripe field for ${a.name}`}>
                        <option value="">Don&apos;t send</option>
                        {EVIDENCE_FILE_FIELDS.map((f) => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="px-4 pb-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-2xs font-body text-muted">Save keeps a draft on the Stripe dispute. Submit sends it to the card network — once, and it cannot be changed after.</p>
            <div className="flex gap-2">
              <Button variant="secondary" loading={busy === "save"} loadingText="Saving…" disabled={busy != null} onClick={() => sendEvidence(false)}>Save draft to Stripe</Button>
              <Button loading={busy === "submit"} disabled={busy != null} onClick={() => setConfirmSubmit(true)}>Submit to card network</Button>
            </div>
          </div>
        </Panel>
      )}

      {confirmResolve && (
        <Sheet isOpen onClose={() => setConfirmResolve(false)} busy={busy === "resolve"} title={`Resolve as “${DISPUTE_RESOLUTION_LABELS[resolution] ?? resolution}”?`} subtitle={needsAmount ? `${formatCurrency(Number(refundAmount), pack.order.currency)} goes back to the buyer; the rest stays with the creator.` : resolution === "release_to_seller" ? "The buyer gets nothing back and the payout is released." : "The buyer is refunded in full and the order is cancelled."}
          footer={<><Button variant="secondary" onClick={() => setConfirmResolve(false)} disabled={busy === "resolve"}>Back</Button><Button variant={resolution === "release_to_seller" ? "primary" : "danger"} loading={busy === "resolve"} loadingText="Resolving…" onClick={resolve}>Resolve</Button></>}
        >
          <p className="text-sm font-body text-muted">Both sides are notified and the decision is written to the order thread. It cannot be undone from here.</p>
        </Sheet>
      )}
      {confirmSubmit && (
        <Sheet isOpen onClose={() => setConfirmSubmit(false)} busy={busy === "submit"} title="Submit evidence to the card network?" subtitle="Stripe forwards it once. After this, nothing on the dispute can be changed."
          footer={<><Button variant="secondary" onClick={() => setConfirmSubmit(false)} disabled={busy === "submit"}>Back</Button><Button variant="danger" loading={busy === "submit"} loadingText="Submitting…" onClick={() => sendEvidence(true)}>Submit</Button></>}
        >
          <p className="text-sm font-body text-muted">{Object.values(text).filter((v) => v && v.trim()).length} text fields and {attachments.filter((a) => fileFields[a.path]).length} files will be sent.</p>
        </Sheet>
      )}
    </div>
  );
}
