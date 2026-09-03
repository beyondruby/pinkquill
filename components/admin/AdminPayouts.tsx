"use client";

import Link from "next/link";
import { useState } from "react";
import { adminFetch, useAdminQuery } from "@/lib/hooks/useAdmin";
import { showToast } from "@/lib/utils/toast";
import type { StatusTone } from "@/lib/utils/orderStatus";
import { ArmedButton, cents, Chip, dt, Empty, Panel, Rows, Skeleton } from "./ui";

interface Payout {
  id: string; order_id: string; seller_id: string; amount_cents: number; currency: string; listing_amount_cents: number | null; listing_currency: string | null; status: string; block_reason: string | null;
  last_error: string | null; attempts: number; transfer_id: string | null; destination_account_id: string | null; reversed_cents: number | null; eligible_at: string; sent_at: string | null; created_at: string;
  order: { order_number: string; status: string; payment_status: string; product: { title: string } | null } | null;
  seller: { username: string; display_name: string | null } | null;
}
interface Account { user_id: string; stripe_account_id: string | null; payouts_enabled: boolean; disabled_reason: string | null; requirements_currently_due: string[] }

const TONE: Record<string, StatusTone> = { failed: "red", blocked: "amber", pending: "purple", processing: "purple", sent: "emerald", reversed: "red", cancelled: "neutral" };
const LABEL: Record<string, string> = { failed: "Failed", blocked: "Held", pending: "On the way", processing: "Sending", sent: "Sent", reversed: "Reversed", cancelled: "Cancelled" };
const BLOCK: Record<string, string> = { dispute_open: "dispute open", no_account: "no Stripe account", onboarding: "Stripe setup unfinished", payouts_disabled: "payouts disabled by Stripe" };

export default function AdminPayouts() {
  const [scope, setScope] = useState<"open" | "all">("open");
  const { data, loading, error, refetch } = useAdminQuery<{ payouts: Payout[]; accounts: Account[] }>(`/api/admin/payouts?scope=${scope}`);
  const accounts = new Map((data?.accounts ?? []).map((a) => [a.user_id, a]));

  const post = async (json: Record<string, unknown>, success: string) => {
    const r = await adminFetch("/api/admin/payouts", { json });
    if (!r.ok) { showToast.error("That didn't go through", r.error); return; }
    showToast.success(success);
    await refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-ink">Payouts</h1>
        <div className="flex gap-1.5">
          {(["open", "all"] as const).map((s) => (
            <button key={s} type="button" onClick={() => setScope(s)} className={`px-3 py-1.5 rounded-full border text-xs font-ui font-semibold ${scope === s ? "bg-purple-primary/10 border-purple-primary/40 text-purple-800" : "bg-surface border-border-light text-muted"}`}>{s === "open" ? "Not sent yet" : "Everything"}</button>
          ))}
        </div>
      </div>
      <p className="text-sm font-body text-muted">Retry re-queues a failed or held payout; the payout worker (every 15 minutes) moves the money. Unblock releases every held payout of a seller whose Stripe account is ready.</p>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm font-body text-ink">{error}</div>}
      <Panel title={`${data?.payouts.length ?? 0} payout${data?.payouts.length === 1 ? "" : "s"}`}>
        {loading ? <Skeleton /> : !data?.payouts.length ? <Empty text={scope === "open" ? "Nothing waiting." : "No payouts yet."} /> : (
          <Rows>
            {data.payouts.map((p) => {
              const acct = accounts.get(p.seller_id);
              const ready = Boolean(acct?.payouts_enabled);
              return (
                <div key={p.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Chip label={LABEL[p.status] ?? p.status} tone={TONE[p.status] ?? "neutral"} />
                      <Link href={`/seller/payouts/${p.id}`} className="text-sm font-ui font-semibold text-ink hover:text-purple-primary tabular-nums">{cents(p.amount_cents, p.currency)}</Link>
                      <Link href={`/orders/${p.order_id}`} className="text-sm font-body text-muted hover:text-purple-primary tabular-nums">{p.order?.order_number ?? ""}</Link>
                      <span className="text-sm font-body text-muted truncate">{p.order?.product?.title ?? ""}</span>
                    </div>
                    <p className="text-2xs font-body text-muted mt-1">
                      @{p.seller?.username ?? "?"} · {acct ? (ready ? `Stripe ready · ${acct.stripe_account_id ?? ""}` : `Stripe not ready${acct.disabled_reason ? ` · ${acct.disabled_reason}` : ""}${acct.requirements_currently_due?.length ? ` · needs ${acct.requirements_currently_due.slice(0, 3).join(", ")}` : ""}`) : "no Stripe account"}
                      {" · "}{p.status === "sent" ? `sent ${dt(p.sent_at)}` : `releases ${dt(p.eligible_at)}`}{p.attempts ? ` · ${p.attempts} attempt${p.attempts === 1 ? "" : "s"}` : ""}
                    </p>
                    {p.block_reason && <p className="text-2xs font-body text-amber-700 mt-0.5">Held: {BLOCK[p.block_reason] ?? p.block_reason}</p>}
                    {p.last_error && <p className="text-2xs font-body text-red-700 mt-0.5">Stripe: {p.last_error}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {(p.status === "failed" || p.status === "blocked") && <ArmedButton label="Retry" confirmLabel="Queue it" variant="primary" disabled={p.block_reason === "dispute_open"} onConfirm={() => post({ payout_id: p.id, action: "retry" }, "Payout queued for the next run")} />}
                    {p.status === "blocked" && ready && <ArmedButton label="Unblock seller" confirmLabel="Unblock all" onConfirm={() => post({ seller_id: p.seller_id, action: "unblock" }, "Seller's payouts released")} />}
                  </div>
                </div>
              );
            })}
          </Rows>
        )}
      </Panel>
    </div>
  );
}
