"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerProfile, useUpdateSellerProfile } from "@/lib/hooks/useSellerProfile";
import { useSellerOnboarding } from "@/lib/hooks/usePayments";
import { SELLER_COUNTRIES } from "@/lib/payments";
import TagInput from "@/components/store/CreateProduct/fields/TagInput";
import Button from "@/components/ui/Button";
import { TONE_CLASSES } from "@/lib/utils/orderStatus";
import { showToast } from "@/lib/utils/toast";
import type { SellerProfile } from "@/lib/hooks/useSellerProfile";

/**
 * Seller settings (Phase 3e): one page, three cards — Studio, Requests,
 * Payouts. The payout card replaces the separate onboarding page. The
 * self-reported response time is gone (nothing public shows it since 3b;
 * the real number comes from completed orders).
 */

const INPUT = "w-full px-3.5 py-2.5 rounded-xl border border-border-light bg-surface text-sm font-body text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-purple-primary/25 transition-shadow";

function Card({ id, title, children, right }: { id?: string; title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-border-light bg-surface scroll-mt-24">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-light">
        <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Switch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-ui font-medium text-ink">{label}</p>
        <p className="text-xs font-body text-muted mt-0.5">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`w-10 h-6 rounded-full relative shrink-0 transition-colors ${checked ? "bg-purple-primary" : "bg-skeleton"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
        <span className="sr-only">{label}</span>
      </button>
    </div>
  );
}

function PayoutsCard() {
  const searchParams = useSearchParams();
  const { account, loading, error, startOnboarding, checkStatus, openDashboard } = useSellerOnboarding();
  const [country, setCountry] = useState("CA");
  const [starting, setStarting] = useState(false);
  const connected = Boolean(account?.payouts_enabled);

  // Stripe sends the seller back to /seller/onboarding?success=true, which redirects here.
  useEffect(() => {
    if (searchParams.get("stripe") === "returned") void checkStatus();
  }, [searchParams, checkStatus]);

  const connect = async () => {
    setStarting(true);
    try { await startOnboarding(country); } finally { setStarting(false); }
  };

  const status = loading
    ? null
    : connected
      ? { label: "Payouts enabled", tone: "emerald" as const }
      : account?.stripe_account_id
        ? { label: "Setup incomplete", tone: "amber" as const }
        : { label: "Not connected", tone: "amber" as const };

  return (
    <Card id="payouts" title="Payouts" right={status ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-2xs font-ui font-semibold ${TONE_CLASSES[status.tone].chip}`}>{status.label}</span> : undefined}>
      {loading ? (
        <div className="h-16 rounded-xl bg-skeleton/50 animate-pulse" />
      ) : connected ? (
        <div className="space-y-3">
          <p className="text-sm font-body text-muted">Stripe{account?.country ? ` · ${account.country.toUpperCase()}` : ""}{account?.default_currency ? ` · ${account.default_currency.toUpperCase()}` : ""}. Money moves from Pinkquill to your Stripe balance 7 days after an order is approved, then to your bank on Stripe&apos;s schedule.</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={openDashboard}>Open Stripe dashboard</Button>
            <Button variant="ghost" size="sm" onClick={() => void checkStatus()}>Refresh status</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-body text-muted">
            {account?.stripe_account_id
              ? "Stripe still needs some details before it can pay you. Continue where you left off."
              : "Pick your country and Stripe walks you through identity and bank details. Sellers outside Canada get a full Stripe account; some countries aren't supported by Stripe."}
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            {!account?.stripe_account_id && (
              <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className="h-10 rounded-xl border border-border-light bg-surface px-3 text-sm font-body text-ink focus:outline-none focus:ring-2 focus:ring-purple-primary/25">
                {SELLER_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            )}
            <Button onClick={connect} loading={starting} loadingText="Opening Stripe…">{account?.stripe_account_id ? "Continue setup" : "Connect payouts"}</Button>
          </div>
          {error && <p className="text-sm font-body text-red-600">{error}</p>}
        </div>
      )}
    </Card>
  );
}

function SettingsForm({ userId, profile }: { userId: string; profile: SellerProfile }) {
  const { update, updating, error } = useUpdateSellerProfile();
  const [storeName, setStoreName] = useState(profile.store_name || "");
  const [tagline, setTagline] = useState(profile.store_tagline || "");
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [services, setServices] = useState<string[]>(profile.services || []);
  const [accepting, setAccepting] = useState(profile.is_accepting_commissions);
  const [requireApproval, setRequireApproval] = useState(profile.require_approval);
  const [autoDeclineHours, setAutoDeclineHours] = useState(profile.auto_decline_hours || 72);

  const save = async () => {
    if (storeName.trim().length < 2) { showToast.error("Give your studio a name", "At least 2 characters"); return; }
    const ok = await update(userId, {
      store_name: storeName.trim(),
      store_tagline: tagline.trim() || null,
      skills,
      services,
      is_accepting_commissions: accepting,
      require_approval: requireApproval,
      auto_decline_hours: Math.min(168, Math.max(1, Math.round(autoDeclineHours))),
    });
    if (ok) showToast.success("Settings saved");
    else showToast.error("Couldn't save", error ?? "Please try again");
  };

  return (
    <>
      <Card title="Studio">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="store-name" className="block text-xs font-ui font-semibold text-ink mb-1">Studio name</label>
            <input id="store-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} maxLength={80} className={INPUT} />
          </div>
          <div>
            <label htmlFor="store-tagline" className="block text-xs font-ui font-semibold text-ink mb-1">Tagline <span className="font-normal text-muted">optional</span></label>
            <input id="store-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} placeholder="Painterly character work" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <p className="block text-xs font-ui font-semibold text-ink mb-1">Skills</p>
            <TagInput values={skills} onChange={setSkills} placeholder="Add a skill and press Enter" max={12} />
          </div>
          <div className="sm:col-span-2">
            <p className="block text-xs font-ui font-semibold text-ink mb-1">Services</p>
            <TagInput values={services} onChange={setServices} placeholder="Add a service and press Enter" max={12} />
          </div>
        </div>
      </Card>

      <Card title="Requests">
        <div className="divide-y divide-border-light">
          <Switch label="Taking commissions" description="Off pauses every listing at once; buyers see “Not taking orders”." checked={accepting} onChange={setAccepting} />
          <Switch label="Approve requests first" description="Review each request before the buyer pays. Otherwise they pay right away." checked={requireApproval} onChange={setRequireApproval} />
          <div className="py-3">
            <label htmlFor="auto-decline" className="block text-xs font-ui font-semibold text-ink mb-1">Hours to respond</label>
            <input id="auto-decline" type="number" min={1} max={168} value={autoDeclineHours} onChange={(e) => setAutoDeclineHours(Number(e.target.value))} disabled={!requireApproval} className={`${INPUT} w-28 tabular-nums disabled:opacity-50`} />
            <p className="text-xs font-body text-muted mt-1">Requests you don&apos;t answer in time are declined automatically.</p>
          </div>
        </div>
      </Card>

      <PayoutsCard />

      <div className="flex justify-end">
        <Button onClick={save} loading={updating} loadingText="Saving…">Save changes</Button>
      </div>
    </>
  );
}

export default function SellerSettings() {
  const { user } = useAuth();
  const { profile, loading, error } = useSellerProfile(user?.id);

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>
      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-40 rounded-2xl bg-skeleton/60 animate-pulse" />)}</div>
      ) : error || !profile || !user ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-6 text-sm font-body text-red-700">{error || "Seller profile not found. Finish the setup first."}</div>
      ) : (
        <SettingsForm userId={user.id} profile={profile} />
      )}
    </div>
  );
}
