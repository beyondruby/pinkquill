"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerEarnings, useTransactionHistory, useSellerOnboarding } from "@/lib/hooks/usePayments";
import Loading from "@/components/ui/Loading";
import type { Transaction } from "@/lib/types/store";

// ---------------------------------------------------------------------------
// Transaction type config
// ---------------------------------------------------------------------------

const TX_CONFIG: Record<string, { label: string; color: string; sign: string; icon: React.ReactNode }> = {
  payment: {
    label: "Payment received",
    color: "text-emerald-600",
    sign: "+",
    icon: (
      <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  platform_fee: {
    label: "Platform fee",
    color: "text-muted",
    sign: "-",
    icon: (
      <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 0 0-8 0v2" />
      </svg>
    ),
  },
  seller_payout: {
    label: "Payout",
    color: "text-purple-primary",
    sign: "+",
    icon: (
      <svg className="w-4 h-4 text-purple-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  refund: {
    label: "Refund",
    color: "text-orange-600",
    sign: "-",
    icon: (
      <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    ),
  },
};

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 sm:p-5 ${
      accent
        ? "border-purple-primary/15 bg-gradient-to-br from-purple-50/80 to-pink-50/60"
        : "border-border-light bg-surface"
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-ui uppercase tracking-wider text-muted">{label}</p>
          <p className={`text-2xl font-display font-bold mt-1 ${accent ? "text-purple-primary" : "text-ink"}`}>
            {value}
          </p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          accent ? "bg-purple-primary/10 text-purple-primary" : "bg-skeleton/70 text-muted"
        }`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction Row
// ---------------------------------------------------------------------------

function TransactionRow({ tx }: { tx: Transaction }) {
  const config = TX_CONFIG[tx.type] || { label: tx.type, color: "text-ink", sign: "", icon: null };

  return (
    <div className="flex items-center gap-3 py-3 px-4 sm:px-5 border-b border-border-light last:border-0">
      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-subtle flex items-center justify-center shrink-0">
        {config.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm font-medium text-ink">{config.label}</p>
        <p className="text-xs text-muted mt-0.5">
          {new Date(tx.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          {tx.status !== "completed" && (
            <> · <span className="capitalize">{tx.status}</span></>
          )}
        </p>
      </div>

      {/* Amount */}
      <span className={`font-ui text-sm font-semibold ${config.color}`}>
        {config.sign}${Number(tx.amount).toFixed(2)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function EarningsOverview() {
  const { user } = useAuth();
  const { earnings, loading: earningsLoading } = useSellerEarnings(user?.id);
  const { transactions, loading: txLoading, hasMore, loadMore } = useTransactionHistory(user?.id);
  const { openDashboard, account } = useSellerOnboarding();
  const isPlaceholder = Boolean(account?.placeholder_mode);
  const providerLabel = account?.provider === "stripe" ? "Stripe" : "Payment";

  // Loading
  if (earningsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-32 bg-skeleton/70 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[100px] bg-subtle rounded-xl animate-pulse border border-border-light" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Earnings</h1>
          <p className="text-sm font-body text-muted mt-0.5">Track your revenue and payouts</p>
        </div>
        <button
          onClick={openDashboard}
          className="inline-flex items-center gap-2 px-4 py-2 border border-border-light bg-surface rounded-lg text-sm font-ui font-medium text-ink hover:bg-subtle transition-colors"
        >
          {isPlaceholder ? "Payment Setup" : `${providerLabel} Dashboard`}
          <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Total Earned"
          value={`$${(earnings?.total_earned ?? 0).toFixed(2)}`}
          accent
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <MetricCard
          label="Pending"
          value={`$${(earnings?.pending_earnings ?? 0).toFixed(2)}`}
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <MetricCard
          label="Completed Orders"
          value={`${earnings?.completed_orders ?? 0}`}
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
        <MetricCard
          label="Avg. Order Value"
          value={`$${(earnings?.avg_order_value ?? 0).toFixed(2)}`}
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
          }
        />
      </div>

      {/* Fee Info */}
      <div className="flex items-start gap-3 rounded-lg bg-purple-50/60 border border-purple-100 p-4">
        <svg className="w-4.5 h-4.5 text-purple-primary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p className="text-sm font-body text-purple-900">
          <strong>Fee structure:</strong> 5% on all sales.
          {isPlaceholder
            ? " Payments are currently in placeholder mode while live provider setup is pending."
            : " Payment processing fees depend on your Stripe account and region."}
        </p>
      </div>

      {/* Transaction History */}
      <section className="rounded-xl border border-border-light bg-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-light">
          <h2 className="font-display text-base font-bold text-ink">Transaction History</h2>
        </div>

        {txLoading ? (
          <div className="py-12 flex justify-center">
            <Loading size="small" text="" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center">
            <svg className="w-10 h-10 text-muted/40 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <p className="font-body text-sm text-muted">No transactions yet.</p>
          </div>
        ) : (
          <>
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
            {hasMore && (
              <div className="p-4 text-center border-t border-border-light">
                <button
                  onClick={loadMore}
                  className="px-5 py-2 rounded-lg text-sm font-ui font-medium text-purple-primary border border-purple-primary/20 bg-accent/5 hover:bg-purple-50 transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
