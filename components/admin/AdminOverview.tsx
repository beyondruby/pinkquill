"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminQuery } from "@/lib/hooks/useAdmin";
import { Chip, dt, Empty, Panel, Rows, Tile } from "./ui";

interface Health {
  checked_at: string;
  cron: Record<string, { last_started: string; ok: boolean | null; result: unknown; error: string | null }> | null;
  cron_jobs_scheduled: Array<{ name: string; schedule: string; active: boolean }> | null;
  stripe_events: { failed: number; processing_stale: number; last_received: string | null };
  payouts: { pending: number; blocked: number; failed: number; sent_last_7d: number };
  refunds: { requested: number; approved_unexecuted: number; needs_review: number };
  disputes_open: number; chargebacks_open: number; ops_alerts_open: number; orders_pending_payment: number; orders_active: number;
  fx: Array<{ pair: string; rate: number; age_minutes: number }> | null;
  ledger: Record<string, number> | null;
}
interface Alert { id: number; kind: string; severity: string; message: string; order_id: string | null; created_at: string }

export default function AdminOverview() {
  const { data, loading, error } = useAdminQuery<{ health: Health; open_alerts: Alert[] }>("/api/admin/health");
  const [now] = useState(() => Date.now());
  const h = data?.health;
  const cronProblem = h?.cron ? Object.entries(h.cron).filter(([, c]) => c.ok === false) : [];
  const cronStale = h?.cron ? Object.entries(h.cron).filter(([, c]) => now - new Date(c.last_started).getTime() > 2 * 3_600_000) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-ink">Overview</h1>
        {h && <p className="text-2xs font-body text-muted">Checked {dt(h.checked_at)}</p>}
      </div>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm font-body text-ink">{error}</div>}
      {loading || !h ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="h-24 rounded-2xl bg-skeleton/60 animate-pulse" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Refunds to review" value={h.refunds.needs_review} tone={h.refunds.needs_review ? "red" : undefined} sub={`${h.refunds.requested} waiting on sellers · ${h.refunds.approved_unexecuted} approved, not yet sent`} href="/admin/refunds" />
            <Tile label="Payouts failed / held" value={`${h.payouts.failed} / ${h.payouts.blocked}`} tone={h.payouts.failed ? "red" : h.payouts.blocked ? "amber" : undefined} sub={`${h.payouts.pending} on the way · ${h.payouts.sent_last_7d} sent this week`} href="/admin/payouts" />
            <Tile label="Disputes open" value={h.disputes_open} tone={h.disputes_open ? "amber" : undefined} sub={`${h.chargebacks_open} chargeback${h.chargebacks_open === 1 ? "" : "s"} from card networks`} href="/admin/disputes" />
            <Tile label="Alerts open" value={h.ops_alerts_open} tone={h.ops_alerts_open ? "amber" : undefined} sub={cronProblem.length ? `${cronProblem.length} cron job${cronProblem.length === 1 ? "" : "s"} failing` : cronStale.length ? `${cronStale.length} cron job${cronStale.length === 1 ? "" : "s"} silent > 2 h` : "cron healthy"} href="/admin/system" />
            <Tile label="Orders active" value={h.orders_active} sub={`${h.orders_pending_payment} awaiting payment`} href="/admin/orders" />
            <Tile label="Stripe events" value={h.stripe_events.failed + h.stripe_events.processing_stale} tone={h.stripe_events.failed + h.stripe_events.processing_stale ? "red" : undefined} sub={h.stripe_events.last_received ? `last received ${dt(h.stripe_events.last_received)}` : "none received yet"} href="/admin/system" />
            <Tile label="FX" value={h.fx?.[0] ? h.fx[0].rate.toFixed(4) : "—"} sub={h.fx?.[0] ? `${h.fx[0].pair.toUpperCase()} · ${h.fx[0].age_minutes} min old` : "no rate cached"} tone={h.fx?.[0] && h.fx[0].age_minutes > 360 ? "amber" : undefined} href="/admin/settings" />
            <Tile label="Owed to sellers" value={h.ledger?.seller_liability != null ? new Intl.NumberFormat("en-US", { style: "currency", currency: "CAD" }).format(h.ledger.seller_liability / 100) : "—"} sub={h.ledger?.stripe_balance != null ? `Stripe balance ${new Intl.NumberFormat("en-US", { style: "currency", currency: "CAD" }).format(h.ledger.stripe_balance / 100)}` : "ledger empty"} href="/admin/payouts" />
          </div>

          <Panel title="Open alerts" right={<Link href="/admin/system" className="text-xs font-ui font-semibold text-purple-primary hover:underline">System</Link>}>
            {data?.open_alerts.length ? (
              <Rows>
                {data.open_alerts.slice(0, 8).map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                    <Chip label={a.severity} tone={a.severity === "critical" || a.severity === "error" ? "red" : a.severity === "warning" ? "amber" : "neutral"} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-ui text-ink truncate">{a.kind.replace(/_/g, " ")} · <span className="font-body text-muted">{a.message}</span></p>
                      <p className="text-2xs font-body text-muted">{dt(a.created_at)}{a.order_id ? <> · <Link href={`/orders/${a.order_id}`} className="text-purple-primary hover:underline">order</Link></> : null}</p>
                    </div>
                  </div>
                ))}
              </Rows>
            ) : <Empty text="Nothing needs attention." />}
          </Panel>

          <Panel title="Cron">
            <Rows>
              {(h.cron_jobs_scheduled ?? []).map((j) => {
                const key = j.name.replace("marketplace-", "").replace(/-/g, "_");
                const last = h.cron?.[key];
                return (
                  <div key={j.name} className="px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 items-center text-sm">
                    <div className="min-w-0"><p className="font-ui text-ink">{key.replace(/_/g, " ")}</p><p className="text-2xs font-body text-muted">{j.schedule}{last ? ` · last ${dt(last.last_started)}` : " · never ran"}</p></div>
                    <Chip label={!j.active ? "paused" : last?.ok === false ? "failed" : last ? "ok" : "no runs"} tone={!j.active ? "neutral" : last?.ok === false ? "red" : last ? "emerald" : "amber"} />
                    <span className="text-2xs font-body text-muted truncate max-w-[220px]">{last?.error ?? (last?.result ? JSON.stringify(last.result) : "")}</span>
                  </div>
                );
              })}
            </Rows>
          </Panel>
        </>
      )}
    </div>
  );
}
