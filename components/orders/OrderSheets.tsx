"use client";

import { useState, type ReactNode } from "react";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import type { Order, OrderWorkroom, DisputeReason } from "@/lib/types/store";
import { DISPUTE_REASON_LABELS } from "@/lib/types/store";
import { formatCurrency } from "@/lib/utils/currency";
import type { OrderActions } from "@/lib/hooks/useDisputes";
import { useCancelOrder, useCreateDispute, useIssueRefund, useRequestRefund, useAddDisputeEvidence } from "@/lib/hooks/useDisputes";
import { useDeclineOrder, useUpdateOrderDraft } from "@/lib/hooks/useOrders";
import { uploadOrderFiles, useRequestRevision, useSubmitDelivery } from "@/lib/hooks/useOrderWorkroom";
import { useAddTracking } from "@/lib/hooks/useShipping";
import { useRequestExtension } from "@/lib/hooks/useTimeline";
import { formatBytes } from "./AttachmentGrid";
import { orderTotalForBuyer, personName, shortDate } from "./orderFormat";

export type SheetKind = "deliver" | "revision" | "cancel" | "refund" | "dispute" | "evidence" | "tracking" | "decline" | "brief" | "extension";

interface SheetContext {
  order: Order;
  actions: OrderActions | null;
  isBuyer: boolean;
  workroom: OrderWorkroom | null;
  onClose: () => void;
  /** Called after a successful write with the toast message to show. */
  onDone: (message: string) => void;
}

interface OrderSheetsProps extends SheetContext {
  kind: SheetKind | null;
}

/** Every order-page form lives here; OrderActionBar opens one at a time. */
export default function OrderSheets(props: OrderSheetsProps) {
  const { kind, ...ctx } = props;
  switch (kind) {
    case "deliver": return <DeliverSheet {...ctx} />;
    case "revision": return <RevisionSheet {...ctx} />;
    case "cancel": return <CancelSheet {...ctx} />;
    case "refund": return <RefundSheet {...ctx} />;
    case "dispute": return <DisputeSheet {...ctx} />;
    case "evidence": return <EvidenceSheet {...ctx} />;
    case "tracking": return <TrackingSheet {...ctx} />;
    case "decline": return <DeclineSheet {...ctx} />;
    case "brief": return <BriefSheet {...ctx} />;
    case "extension": return <ExtensionSheet {...ctx} />;
    default: return null;
  }
}

// ─── shared bits ────────────────────────────────────────────────────

const INPUT = "w-full px-3.5 py-2.5 rounded-xl border border-border-light bg-surface text-sm font-body text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-purple-primary/25 focus:border-purple-primary/40 transition-shadow";

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-ui font-semibold text-ink mb-1.5">{label}{hint && <span className="ml-1.5 font-normal text-muted text-xs">{hint}</span>}</label>
      {children}
    </div>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? <p className="text-sm font-body text-red-600" role="alert">{text}</p> : null;
}

function FilePicker({ files, onChange, label, max = 25 }: { files: File[]; onChange: (f: File[]) => void; label: string; max?: number }) {
  return (
    <div>
      <label className="block rounded-xl border border-dashed border-border-strong bg-subtle p-4 text-center cursor-pointer hover:border-purple-primary/40 transition-colors">
        <span className="text-sm font-ui font-medium text-ink">{label}</span>
        <span className="block text-2xs font-body text-muted mt-0.5">Up to {max} files · 100 MB each</span>
        <input
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            onChange([...files, ...picked].slice(0, max));
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-subtle text-xs font-ui">
              <span className="truncate text-ink">{f.name}</span>
              <span className="flex items-center gap-2 shrink-0 text-muted">
                {formatBytes(f.size)}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="text-muted hover:text-red-600">×</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="w-full flex items-center justify-between gap-3 py-1 text-left">
      <span className="text-sm font-ui text-ink">{label}</span>
      <span className={`w-10 h-6 rounded-full relative transition-colors ${checked ? "bg-purple-primary" : "bg-skeleton"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

// ─── sheets ─────────────────────────────────────────────────────────

function DeliverSheet({ order, workroom, onClose, onDone }: SheetContext) {
  const { submitDelivery, loading, error } = useSubmitDelivery();
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isFinal, setIsFinal] = useState(false);
  const version = (workroom?.deliveries.reduce((m, d) => Math.max(m, d.version), 0) ?? 0) + 1;
  const openRevision = workroom?.revisions.find((r) => r.status === "open") ?? null;
  const canSubmit = (note.trim().length > 0 || files.length > 0) && !loading;

  const submit = async () => {
    const result = await submitDelivery(order.id, note, files, isFinal);
    if (result) onDone(`Delivery v${result.version} sent`);
  };

  return (
    <Sheet
      isOpen
      onClose={onClose}
      busy={loading}
      title={version > 1 ? `Deliver v${version}` : "Deliver your work"}
      subtitle={openRevision ? `This addresses revision ${openRevision.number}.` : "The buyer is notified and has 3 days to review before it auto-approves."}
      footer={<><Button variant="secondary" onClick={onClose} disabled={loading}>Not now</Button><Button onClick={submit} disabled={!canSubmit} loading={loading} loadingText="Uploading…">Send delivery</Button></>}
    >
      <FilePicker files={files} onChange={setFiles} label="Drop files or tap to choose" />
      <Field label="Note to the buyer" hint={files.length === 0 ? "required without files" : "optional"}>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={openRevision ? "What changed in this version…" : "What you're delivering, and anything they should know…"} className={INPUT} />
      </Field>
      <Switch checked={isFinal} onChange={setIsFinal} label="This is the final delivery" />
      <ErrorLine text={error} />
    </Sheet>
  );
}

function RevisionSheet({ order, actions, onClose, onDone }: SheetContext) {
  const { requestRevision, loading, error } = useRequestRevision();
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const number = order.revision_count + 1;
  const left = actions?.revisions_left;

  const submit = async () => {
    const result = await requestRevision(order.id, note, files);
    if (result) onDone(`Revision ${result.number} requested`);
  };

  return (
    <Sheet
      isOpen
      onClose={onClose}
      busy={loading}
      title="Request a revision"
      subtitle={`Revision ${number}${order.max_revisions ? ` of ${order.max_revisions}` : ""}${left != null ? ` · ${left} left after this` : ""}. Be specific: what to keep, what to change.`}
      footer={<><Button variant="secondary" onClick={onClose} disabled={loading}>Not now</Button><Button onClick={submit} disabled={!note.trim() || loading} loading={loading} loadingText="Sending…">Send revision request</Button></>}
    >
      <Field label="What should change?">
        <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Keep the pose and background; the horns should be copper, and the light a little warmer…" className={INPUT} />
      </Field>
      <FilePicker files={files} onChange={setFiles} label="Attach markups or references" />
      <ErrorLine text={error} />
    </Sheet>
  );
}

function CancelSheet({ order, actions, isBuyer, onClose, onDone }: SheetContext) {
  const { cancelOrder, loading, error } = useCancelOrder();
  const [reason, setReason] = useState("");
  const mode = actions?.cancel_mode ?? "free";
  const other = personName(isBuyer ? order.seller : order.buyer, isBuyer ? "the creator" : "the buyer");
  const total = formatCurrency(orderTotalForBuyer(order));
  const title = mode === "request" ? "Ask to cancel?" : mode === "refund" ? "Cancel and refund?" : "Cancel this order?";
  const subtitle = mode === "request"
    ? `Work has started, so ${other} decides. If they agree, ${total} goes back to your card.`
    : mode === "refund"
      ? (isBuyer ? `${actions?.is_late ? "This order is overdue, so you can cancel it. " : ""}${total} goes back to your card in 5–10 days.` : `${total} goes back to the buyer, fees included. You keep nothing from this order.`)
      : "Nothing was charged. The other side is told right away.";

  const submit = async () => {
    const result = await cancelOrder(order.id, reason.trim() || undefined);
    if (result) onDone(result.outcome === "requested" ? "Cancellation request sent" : "Order cancelled");
  };

  return (
    <Sheet isOpen onClose={onClose} busy={loading} title={title} subtitle={subtitle}
      footer={<><Button variant="secondary" onClick={onClose} disabled={loading}>Keep order</Button><Button variant="danger" onClick={submit} loading={loading} loadingText="Working…">{mode === "request" ? "Send request" : "Cancel order"}</Button></>}
    >
      <Field label="Reason" hint="optional · the other side sees it">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={INPUT} />
      </Field>
      <ErrorLine text={error} />
    </Sheet>
  );
}

function RefundSheet({ order, actions, isBuyer, onClose, onDone }: SheetContext) {
  const { requestRefund, loading: requesting, error: requestError } = useRequestRefund();
  const { issueRefund, loading: issuing, error: issueError } = useIssueRefund();
  const loading = requesting || issuing;
  const maxPartial = (actions?.seller_share_remaining_listing_cents ?? Math.round(Number(order.seller_amount) * 100)) / 100;
  const total = orderTotalForBuyer(order);
  const canPartial = maxPartial > 0 && !["completed", "resolved"].includes(order.status);
  const [kind, setKind] = useState<"partial" | "full">(canPartial ? "partial" : "full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const parsed = Number(amount);
  const amountOk = kind === "full" || (Number.isFinite(parsed) && parsed > 0 && parsed <= maxPartial + 1e-9);

  const submit = async () => {
    const value = kind === "partial" ? Math.round(parsed * 100) / 100 : undefined;
    const ok = isBuyer ? await requestRefund(order.id, reason.trim() || undefined, value) : await issueRefund(order.id, value, reason.trim() || undefined);
    if (ok) onDone(isBuyer ? "Refund request sent" : kind === "full" ? "Refund issued and order cancelled" : `Refund of ${formatCurrency(value ?? 0)} issued`);
  };

  const option = (k: "partial" | "full", title: string, desc: string, disabled = false) => (
    <button type="button" disabled={disabled} onClick={() => setKind(k)} aria-pressed={kind === k}
      className={`rounded-xl border p-3 text-left transition-colors disabled:opacity-40 ${kind === k ? "border-purple-primary bg-purple-50" : "border-border-light bg-surface hover:border-border-strong"}`}>
      <p className="text-sm font-ui font-semibold text-ink">{title}</p>
      <p className="text-2xs font-body text-muted mt-0.5">{desc}</p>
    </button>
  );

  return (
    <Sheet isOpen onClose={onClose} busy={loading}
      title={isBuyer ? "Request a refund" : "Issue a refund"}
      subtitle={isBuyer ? "The creator answers within 3 days. A partial refund keeps the order going." : "A full refund cancels the order. A partial one comes out of your share and the order continues."}
      footer={<><Button variant="secondary" onClick={onClose} disabled={loading}>Not now</Button><Button variant={isBuyer ? "primary" : "danger"} onClick={submit} disabled={!amountOk || loading} loading={loading} loadingText="Working…">{isBuyer ? "Send request" : kind === "full" ? `Refund ${formatCurrency(total)}` : amountOk ? `Refund ${formatCurrency(parsed)}` : "Refund"}</Button></>}
    >
      <div className="grid grid-cols-2 gap-2">
        {option("partial", "Partial", "Order continues", !canPartial)}
        {option("full", `Full · ${formatCurrency(total)}`, "Cancels the order")}
      </div>
      {kind === "partial" && (
        <Field label="Amount" hint={`up to ${formatCurrency(maxPartial)}`}>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-body text-muted">$</span>
            <input type="number" inputMode="decimal" min={0.01} max={maxPartial} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${INPUT} pl-7 tabular-nums`} />
          </div>
        </Field>
      )}
      <Field label="Reason" hint={isBuyer ? "the creator sees it" : "the buyer sees it"}>
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={INPUT} />
      </Field>
      <ErrorLine text={requestError || issueError} />
    </Sheet>
  );
}

const DISPUTE_REASONS = Object.entries(DISPUTE_REASON_LABELS) as [DisputeReason, string][];

function DisputeSheet({ order, onClose, onDone }: SheetContext) {
  const { createDispute, loading, error } = useCreateDispute();
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [description, setDescription] = useState("");

  const submit = async () => {
    if (!reason) return;
    const result = await createDispute(order.id, reason, description.trim());
    if (result) onDone("Dispute opened");
  };

  return (
    <Sheet isOpen onClose={onClose} busy={loading} title="Open a dispute"
      subtitle="Pauses the order and any payout. Pinkquill reviews both sides. You can add evidence afterwards."
      footer={<><Button variant="secondary" onClick={onClose} disabled={loading}>Not now</Button><Button variant="danger" onClick={submit} disabled={!reason || !description.trim() || loading} loading={loading} loadingText="Opening…">Open dispute</Button></>}
    >
      <Field label="Reason">
        <select value={reason} onChange={(e) => setReason(e.target.value as DisputeReason)} className={INPUT}>
          <option value="">Choose a reason…</option>
          {DISPUTE_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="What happened">
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Say what you expected, what you got, and what you already tried with the other side." className={INPUT} />
      </Field>
      <ErrorLine text={error} />
    </Sheet>
  );
}

function EvidenceSheet({ order, actions, onClose, onDone }: SheetContext) {
  const { addEvidence, loading, error } = useAddDisputeEvidence();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const disputeId = actions?.dispute?.id;

  const submit = async () => {
    if (!disputeId) return;
    setUploadError(null);
    setUploading(true);
    try {
      const uploaded = await uploadOrderFiles(order.id, "evidence", files);
      const result = await addEvidence(disputeId, text, uploaded);
      if (result) onDone("Evidence added to the dispute");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload the files");
    } finally {
      setUploading(false);
    }
  };

  const busy = loading || uploading;
  return (
    <Sheet isOpen onClose={onClose} busy={busy} title="Add evidence" subtitle="Visible to the other side and to Pinkquill."
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>Not now</Button><Button onClick={submit} disabled={(!text.trim() && files.length === 0) || busy} loading={busy} loadingText="Adding…">Add to dispute</Button></>}
    >
      <Field label="Your statement">
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} className={INPUT} />
      </Field>
      <FilePicker files={files} onChange={setFiles} label="Attach screenshots or files" />
      <ErrorLine text={uploadError || error} />
    </Sheet>
  );
}

function TrackingSheet({ order, onClose, onDone }: SheetContext) {
  const { addTracking, adding, error } = useAddTracking();
  const [carrier, setCarrier] = useState("");
  const [number, setNumber] = useState("");

  const submit = async () => {
    const ok = await addTracking(order.id, number.trim(), carrier.trim() || undefined);
    if (ok) onDone("Marked as shipped");
  };

  return (
    <Sheet isOpen onClose={onClose} busy={adding} title="Add tracking" subtitle="The buyer gets the tracking details and a “Shipped” notification."
      footer={<><Button variant="secondary" onClick={onClose} disabled={adding}>Not now</Button><Button onClick={submit} disabled={!number.trim() || adding} loading={adding} loadingText="Saving…">Mark as shipped</Button></>}
    >
      <Field label="Carrier" hint="optional">
        <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Canada Post, UPS, DHL…" className={INPUT} />
      </Field>
      <Field label="Tracking number">
        <input value={number} onChange={(e) => setNumber(e.target.value)} className={`${INPUT} tabular-nums`} />
      </Field>
      <ErrorLine text={error} />
    </Sheet>
  );
}

function DeclineSheet({ order, onClose, onDone }: SheetContext) {
  const { declineOrder, declining, error } = useDeclineOrder();
  const [reason, setReason] = useState("");
  const submit = async () => {
    const ok = await declineOrder(order.id, reason.trim() || undefined);
    if (ok) onDone("Request declined");
  };
  return (
    <Sheet isOpen onClose={onClose} busy={declining} title="Decline this request?" subtitle={`${personName(order.buyer, "The buyer")} is told right away. Nothing was charged.`}
      footer={<><Button variant="secondary" onClick={onClose} disabled={declining}>Keep it</Button><Button variant="danger" onClick={submit} loading={declining} loadingText="Declining…">Decline</Button></>}
    >
      <Field label="Reason" hint="optional · the buyer sees it">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Booked through October, sorry!" className={INPUT} />
      </Field>
      <ErrorLine text={error} />
    </Sheet>
  );
}

function BriefSheet({ order, onClose, onDone }: SheetContext) {
  const { updateDraft, updating, error } = useUpdateOrderDraft();
  const [brief, setBrief] = useState(order.brief ?? "");
  const submit = async () => {
    const ok = await updateDraft({ order_id: order.id, brief: brief.trim() });
    if (ok) onDone("Brief updated");
  };
  return (
    <Sheet isOpen onClose={onClose} busy={updating} title="Edit your brief" subtitle="You can change this until you pay."
      footer={<><Button variant="secondary" onClick={onClose} disabled={updating}>Cancel</Button><Button onClick={submit} disabled={!brief.trim() || updating} loading={updating} loadingText="Saving…">Save brief</Button></>}
    >
      <Field label="Brief">
        <textarea rows={6} value={brief} onChange={(e) => setBrief(e.target.value)} className={INPUT} />
      </Field>
      <ErrorLine text={error} />
    </Sheet>
  );
}

const DAY = 86_400_000;
const EXTENSION_CHIPS = [2, 3, 5, 7, 14];

/** Seller asks for more time (2d). The buyer accepts or declines; the due date only moves on accept. */
function ExtensionSheet({ order, onClose, onDone }: SheetContext) {
  const { requestExtension, loading, error } = useRequestExtension();
  // Extensions count from the current due date; an order with none counts from now.
  const [base] = useState(() => Math.max(order.due_date ? new Date(order.due_date).getTime() : 0, Date.now()));
  const [days, setDays] = useState<number>(3);
  const [reason, setReason] = useState("");
  const newDue = new Date(base + days * DAY);
  const minDate = new Date(base + DAY).toISOString().slice(0, 10);
  const maxDate = new Date(base + 90 * DAY).toISOString().slice(0, 10);
  const setFromDate = (value: string) => {
    if (!value) return;
    const picked = new Date(`${value}T${new Date(base).toISOString().slice(11, 19)}Z`).getTime();
    const d = Math.round((picked - base) / DAY);
    if (d >= 1 && d <= 90) setDays(d);
  };
  const submit = async () => {
    const r = await requestExtension(order.id, newDue.toISOString(), reason);
    if (r) onDone(`Asked for ${r.days} more day${r.days === 1 ? "" : "s"}`);
  };
  return (
    <Sheet isOpen onClose={onClose} busy={loading} title="Ask for more time" subtitle={`${personName(order.buyer, "The buyer")} sees the new date and your note, and can accept or decline. The due date only moves if they accept.`}
      footer={<><Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button><Button onClick={submit} loading={loading} loadingText="Sending…">Send request</Button></>}
    >
      <Field label="How much longer?">
        <div className="flex flex-wrap gap-2">
          {EXTENSION_CHIPS.map((n) => (
            <button key={n} type="button" onClick={() => setDays(n)} aria-pressed={days === n}
              className={`px-3.5 py-2 rounded-full border text-sm font-ui font-medium transition-colors ${days === n ? "bg-purple-primary/10 border-purple-primary/40 text-purple-800" : "bg-surface border-border-light text-ink hover:border-border-strong"}`}>
              +{n} day{n === 1 ? "" : "s"}
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-3 flex-wrap">
          <input type="date" value={newDue.toISOString().slice(0, 10)} min={minDate} max={maxDate} onChange={(e) => setFromDate(e.target.value)} className={`${INPUT} sm:w-48`} aria-label="New due date" />
          <p className="text-sm font-body text-muted">
            {order.due_date ? `Due ${shortDate(order.due_date)} → ` : "New due date "}<span className="font-ui font-semibold text-ink">{shortDate(newDue.toISOString())}</span> · +{days} day{days === 1 ? "" : "s"}
          </p>
        </div>
      </Field>
      <Field label="Why" hint="optional · the buyer sees it">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The linework took longer than planned — I want to get the colours right." className={INPUT} />
      </Field>
      <ErrorLine text={error} />
    </Sheet>
  );
}
