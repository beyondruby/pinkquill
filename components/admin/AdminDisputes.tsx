"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminQuery } from "@/lib/hooks/useAdmin";
import { DISPUTE_REASON_LABELS, type DisputeReason } from "@/lib/types/store";
import { cents, Chip, dt, Empty, Panel, Rows, Skeleton } from "./ui";

interface Dispute {
  id: string; order_id: string; kind: "dispute" | "chargeback"; reason: string; description: string | null; status: string; stripe_status: string | null;
  evidence: unknown[]; evidence_due_by: string | null; amount_cents: number | null; currency: string | null; resolution: string | null; resolved_at: string | null; created_at: string;
  orders: { order_number: string; status: string; payment_status: string; listing_type: string; amount: number; currency: string; product: { title: string } | null; buyer: { username: string } | null; seller: { username: string } | null } | null;
}

export default function AdminDisputes() {
  const [scope, setScope] = useState<"open" | "all">("open");
  const [now] = useState(() => Date.now());
  const { data, loading, error } = useAdminQuery<{ disputes: Dispute[] }>(`/api/admin/disputes?scope=${scope}`);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-ink">Disputes</h1>
        <div className="flex gap-1.5">
          {(["open", "all"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)} className={`px-3 py-1.5 rounded-full border text-xs font-ui font-semibold ${scope === s ? "bg-purple-primary/10 border-purple-primary/40 text-purple-800" : "bg-surface border-border-light text-muted"}`}>{s === "open" ? "Open" : "Everything"}</button>
          ))}
        </div>
      </div>
      <p className="text-sm font-body text-muted">Platform disputes are decided here. Chargebacks are decided by the card network: gather evidence and send it to Stripe before the due date.</p>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm font-body text-ink">{error}</div>}
      <Panel title={`${data?.disputes.length ?? 0} dispute${data?.disputes.length === 1 ? "" : "s"}`}>
        {loading ? <Skeleton /> : !data?.disputes.length ? <Empty text={scope === "open" ? "No open disputes." : "No disputes yet."} /> : (
          <Rows>
            {data.disputes.map((d) => {
              const due = d.evidence_due_by ? new Date(d.evidence_due_by).getTime() - now : null;
              const dueSoon = due != null && due < 3 * 86_400_000;
              return (
                <Link key={d.id} href={`/admin/disputes/${d.id}`} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 hover:bg-subtle transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip label={d.kind === "chargeback" ? "Chargeback" : "Dispute"} tone={d.kind === "chargeback" ? "red" : "amber"} />
                      <Chip label={d.status.replace(/_/g, " ")} tone={d.status === "resolved" ? "emerald" : d.status === "cancelled" ? "neutral" : "purple"} />
                      <span className="text-sm font-ui text-ink tabular-nums">{d.orders?.order_number ?? d.order_id.slice(0, 8)}</span>
                      <span className="text-sm font-body text-muted truncate">{d.orders?.product?.title ?? ""}</span>
                    </div>
                    <p className="text-2xs font-body text-muted mt-1">
                      {DISPUTE_REASON_LABELS[d.reason as DisputeReason] ?? d.reason} · {d.amount_cents != null ? cents(d.amount_cents, d.currency ?? "usd") : d.orders ? `${Number(d.orders.amount).toFixed(2)} ${d.orders.currency.toUpperCase()}` : ""} · @{d.orders?.buyer?.username ?? "?"} vs @{d.orders?.seller?.username ?? "?"} · opened {dt(d.created_at)}
                      {" · "}{Array.isArray(d.evidence) ? d.evidence.length : 0} evidence item{Array.isArray(d.evidence) && d.evidence.length === 1 ? "" : "s"}
                      {d.resolution ? ` · ${d.resolution.replace(/_/g, " ")}` : ""}
                    </p>
                  </div>
                  {d.kind === "chargeback" && d.evidence_due_by && d.status !== "resolved" && (
                    <Chip label={`evidence due ${dt(d.evidence_due_by, false)}`} tone={dueSoon ? "red" : "amber"} />
                  )}
                  {d.stripe_status && <span className="text-2xs font-body text-muted">Stripe: {d.stripe_status.replace(/_/g, " ")}</span>}
                </Link>
              );
            })}
          </Rows>
        )}
      </Panel>
    </div>
  );
}
