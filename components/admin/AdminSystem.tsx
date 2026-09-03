"use client";

import Link from "next/link";
import { adminFetch, useAdminQuery } from "@/lib/hooks/useAdmin";
import { showToast } from "@/lib/utils/toast";
import { ArmedButton, Chip, dt, Empty, Panel, Rows, Skeleton } from "./ui";

interface Health { cron_jobs_scheduled: Array<{ name: string; schedule: string; active: boolean }> | null; cron: Record<string, { last_started: string; ok: boolean | null; result: unknown; error: string | null }> | null }
interface Run { id: number; job: string; started_at: string; finished_at: string | null; ok: boolean | null; result: unknown; error: string | null }
interface StripeEvent { event_id: string; event_type: string; order_id: string | null; status: string; attempts: number; error: string | null; received_at: string; processed_at: string | null }
interface Alert { id: number; kind: string; severity: string; message: string; context: Record<string, unknown>; order_id: string | null; created_at: string; resolved_at?: string | null }

const JOBS: Array<{ key: string; label: string; what: string }> = [
  { key: "auto_decline", label: "Auto-decline", what: "declines requests the seller didn't answer in time; clears old rate-limit rows" },
  { key: "hourly", label: "Hourly", what: "auto-approves stale deliveries, reveals reviews, releases eligible payouts, sends due-date reminders" },
  { key: "payout_worker", label: "Payout worker", what: "posts to /api/payouts/run, which executes approved refunds and pays sellers" },
];

export default function AdminSystem() {
  const { data, loading, error, refetch } = useAdminQuery<{ health: Health; runs: Run[]; stripe_events: StripeEvent[]; alerts: Alert[]; history: Alert[] }>("/api/admin/system");

  const post = async (json: Record<string, unknown>, success: string) => {
    const r = await adminFetch<{ result?: unknown }>("/api/admin/system", { json });
    if (!r.ok) { showToast.error("That didn't go through", r.error); return; }
    showToast.success(success, r.data.result ? JSON.stringify(r.data.result).slice(0, 120) : undefined);
    await refetch();
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-ink">System</h1>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm font-body text-ink">{error}</div>}

      <Panel title="Cron jobs" right={<span className="text-2xs font-body text-muted">pg_cron inside the database</span>}>
        {loading || !data ? <Skeleton /> : (
          <Rows>
            {JOBS.map((j) => {
              const sched = data.health.cron_jobs_scheduled?.find((s) => s.name.endsWith(j.key.replace(/_/g, "-")));
              const last = data.health.cron?.[j.key];
              return (
                <div key={j.key} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="text-sm font-ui text-ink">{j.label}</p><Chip label={!sched ? "not scheduled" : !sched.active ? "paused" : last?.ok === false ? "failed" : last ? "ok" : "no runs"} tone={!sched || !sched.active ? "red" : last?.ok === false ? "red" : last ? "emerald" : "amber"} /></div>
                    <p className="text-2xs font-body text-muted">{j.what}{sched ? ` · ${sched.schedule}` : ""}{last ? ` · last ${dt(last.last_started)}` : ""}</p>
                    {last?.error && <p className="text-2xs font-body text-red-700 mt-0.5">{last.error}</p>}
                  </div>
                  <ArmedButton label="Run now" confirmLabel="Run" onConfirm={() => post({ action: "run_job", job: j.key }, `${j.label} ran`)} />
                </div>
              );
            })}
          </Rows>
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Recent runs">
          {loading || !data ? <Skeleton /> : !data.runs.length ? <Empty text="No runs recorded." /> : (
            <div className="max-h-[360px] overflow-y-auto"><Rows>
              {data.runs.map((r) => (
                <div key={r.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                  <Chip label={r.ok === false ? "failed" : r.finished_at ? "ok" : "running"} tone={r.ok === false ? "red" : r.finished_at ? "emerald" : "amber"} />
                  <span className="font-ui text-ink">{r.job}</span>
                  <span className="text-2xs font-body text-muted">{dt(r.started_at)}</span>
                  <span className="text-2xs font-body text-muted truncate ml-auto max-w-[45%]">{r.error ?? (r.result ? JSON.stringify(r.result) : "")}</span>
                </div>
              ))}
            </Rows></div>
          )}
        </Panel>
        <Panel title="Stripe events needing attention">
          {loading || !data ? <Skeleton /> : !data.stripe_events.length ? <Empty text="Every webhook event was processed." /> : (
            <div className="max-h-[360px] overflow-y-auto"><Rows>
              {data.stripe_events.map((e) => (
                <div key={e.event_id} className="px-4 py-2 text-sm">
                  <div className="flex items-center gap-2"><Chip label={e.status} tone={e.status === "failed" ? "red" : "amber"} /><span className="font-ui text-ink">{e.event_type}</span><span className="text-2xs font-body text-muted">{dt(e.received_at)} · {e.attempts} attempt{e.attempts === 1 ? "" : "s"}</span></div>
                  <p className="text-2xs font-body text-muted tabular-nums">{e.event_id}{e.order_id ? <> · <Link href={`/orders/${e.order_id}`} className="text-purple-primary hover:underline">order</Link></> : null}</p>
                  {e.error && <p className="text-2xs font-body text-red-700">{e.error}</p>}
                </div>
              ))}
            </Rows></div>
          )}
        </Panel>
      </div>

      <Panel title={`Open alerts · ${data?.alerts.length ?? 0}`}>
        {loading || !data ? <Skeleton /> : !data.alerts.length ? <Empty text="Nothing open." /> : (
          <Rows>
            {data.alerts.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                <Chip label={a.severity} tone={a.severity === "critical" || a.severity === "error" ? "red" : a.severity === "warning" ? "amber" : "neutral"} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-ui text-ink">{a.kind.replace(/_/g, " ")} <span className="font-body text-muted">· {a.message}</span></p>
                  <p className="text-2xs font-body text-muted">{dt(a.created_at)}{a.order_id ? <> · <Link href={`/orders/${a.order_id}`} className="text-purple-primary hover:underline">order</Link></> : null}{a.context && Object.keys(a.context).length ? ` · ${JSON.stringify(a.context).slice(0, 160)}` : ""}</p>
                </div>
                <ArmedButton label="Resolve" confirmLabel="Mark resolved" onConfirm={() => post({ action: "resolve_alert", alert_id: a.id }, "Alert resolved")} />
              </div>
            ))}
          </Rows>
        )}
      </Panel>

      <Panel title="History" right={<span className="text-2xs font-body text-muted">resolved alerts and every console action</span>}>
        {loading || !data ? <Skeleton /> : !data.history.length ? <Empty text="Nothing yet." /> : (
          <div className="max-h-[420px] overflow-y-auto"><Rows>
            {data.history.map((a) => (
              <div key={a.id} className="px-4 py-2 text-sm flex gap-3 flex-wrap">
                <span className="text-2xs font-body text-muted w-32 shrink-0">{dt(a.created_at)}</span>
                <span className="font-ui text-ink">{a.kind === "admin_action" ? a.message.replace(/_/g, " ") : a.kind.replace(/_/g, " ")}</span>
                <span className="text-2xs font-body text-muted min-w-0 truncate flex-1">{a.kind === "admin_action" ? JSON.stringify(a.context).slice(0, 200) : a.message}</span>
              </div>
            ))}
          </Rows></div>
        )}
      </Panel>
    </div>
  );
}
