"use client";

import { useState } from "react";
import { adminFetch, useAdminQuery } from "@/lib/hooks/useAdmin";
import { showToast } from "@/lib/utils/toast";
import Button from "@/components/ui/Button";
import { dt, Empty, Panel, Rows } from "./ui";

interface Setting { key: string; value: unknown; updated_at: string }
interface Change { id: number; message: string; context: { key?: string; from?: unknown; to?: unknown; admin_id?: string }; created_at: string }

const META: Record<string, { label: string; help: string; kind: "rate" | "money" | "int" | "text" | "list" | "json" }> = {
  platform_fee_rate: { label: "Pinkquill fee", help: "Share of the listing price kept from the seller. 0.05 = 5%. Applies to orders created after the change.", kind: "rate" },
  buyer_fee_rate: { label: "Buyer processing fee rate", help: "Added on top of the price for the buyer. 0.035 = 3.5%.", kind: "rate" },
  buyer_fee_fixed: { label: "Buyer processing fee, fixed part", help: "In the listing currency, added per order.", kind: "money" },
  min_service_price: { label: "Minimum commission price", help: "The wizard refuses packages below this.", kind: "money" },
  release_window_hours: { label: "Payout hold", help: "Hours between approval and payout release. 168 = 7 days.", kind: "int" },
  payout_batch_size: { label: "Payouts per worker run", help: "How many transfers one run of the payout worker attempts.", kind: "int" },
  payout_max_attempts: { label: "Payout attempts before failing", help: "After this many Stripe errors the payout is marked failed for review.", kind: "int" },
  fx_buffer_rate: { label: "FX buffer", help: "Added to the exchange rate when charging in the settlement currency. 0.015 = 1.5%.", kind: "rate" },
  fx_max_age_hours: { label: "FX rate max age", help: "Hours a cached rate stays valid.", kind: "int" },
  fx_source: { label: "FX source", help: "Rate provider. Only frankfurter is wired.", kind: "text" },
  settlement_currency: { label: "Settlement currency", help: "What Stripe charges and pays out in. cad today; usd once the platform account allows it.", kind: "text" },
  supported_currencies: { label: "Listing currencies", help: "Currencies sellers may price in.", kind: "list" },
  app_base_url: { label: "App base URL", help: "Where the database posts cron and email jobs. https origin, no trailing slash.", kind: "text" },
  invoice_issuer: { label: "Invoice issuer", help: "Printed in the FROM block of every tax invoice as JSON: {\"name\", \"lines\": [address lines, tax number], \"tax_note\"}.", kind: "json" },
};

function display(value: unknown): string {
  return typeof value === "string" ? value : Array.isArray(value) ? value.join(", ") : JSON.stringify(value);
}

export default function AdminSettings() {
  const { data, loading, error, refetch } = useAdminQuery<{ settings: Setting[]; history: Change[] }>("/api/admin/settings");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const save = async (s: Setting) => {
    const meta = META[s.key];
    const raw = (drafts[s.key] ?? display(s.value)).trim();
    let value: unknown = raw;
    if (meta?.kind === "rate" || meta?.kind === "money" || meta?.kind === "int") { value = Number(raw); if (!Number.isFinite(value as number)) { showToast.error("Enter a number"); return; } }
    if (meta?.kind === "list") value = raw.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);
    if (meta?.kind === "json") { try { value = JSON.parse(raw); } catch { showToast.error("Enter valid JSON"); return; } }
    setSaving(s.key);
    const r = await adminFetch("/api/admin/settings", { json: { key: s.key, value } });
    setSaving(null);
    if (!r.ok) { showToast.error("Not saved", r.error); return; }
    showToast.success(`${meta?.label ?? s.key} updated`);
    setDrafts((d) => { const n = { ...d }; delete n[s.key]; return n; });
    await refetch();
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
      <p className="text-sm font-body text-muted">Money settings apply to orders created after the change; existing orders keep the numbers they were created with. Every change is logged below.</p>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm font-body text-ink">{error}</div>}
      <Panel title="Platform settings">
        {loading ? <div className="h-48 bg-skeleton/40 animate-pulse" /> : (
          <Rows>
            {(data?.settings ?? []).map((s) => {
              const meta = META[s.key];
              const editable = Boolean(meta);
              const draft = drafts[s.key];
              const dirty = draft !== undefined && draft.trim() !== display(s.value);
              return (
                <div key={s.key} className="px-4 py-3 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px_auto] gap-3 md:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-ui text-ink">{meta?.label ?? s.key} <span className="text-2xs font-body text-muted">· {s.key}</span></p>
                    <p className="text-2xs font-body text-muted">{meta?.help ?? "Read-only."} Changed {dt(s.updated_at)}.</p>
                  </div>
                  <input value={draft ?? display(s.value)} onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))} disabled={!editable} className="px-3 py-2 rounded-xl border border-border-light bg-surface text-sm font-body text-ink tabular-nums disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-purple-primary/25" aria-label={meta?.label ?? s.key} />
                  <Button size="sm" disabled={!editable || !dirty || saving === s.key} loading={saving === s.key} onClick={() => save(s)}>Save</Button>
                </div>
              );
            })}
          </Rows>
        )}
      </Panel>
      <Panel title="Recent changes">
        {!data?.history.length ? <Empty text="No changes from the console yet." /> : (
          <Rows>
            {data.history.map((c) => (
              <div key={c.id} className="px-4 py-2.5 text-sm font-body text-ink flex gap-3 flex-wrap">
                <span className="text-2xs font-body text-muted w-32 shrink-0">{dt(c.created_at)}</span>
                <span className="min-w-0"><span className="font-ui">{META[c.context.key ?? ""]?.label ?? c.context.key}</span>: {display(c.context.from)} → {display(c.context.to)}</span>
              </div>
            ))}
          </Rows>
        )}
      </Panel>
    </div>
  );
}
