"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerEarnings, useTransactionHistory, useSellerOnboarding } from "@/lib/hooks/usePayments";
import type { Transaction } from "@/lib/types/store";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";

function EarningCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${
      accent
        ? "border-purple-primary/20 bg-gradient-to-br from-purple-50 to-pink-50"
        : "border-black/[0.06] bg-white"
    }`}>
      <p className="text-xs font-ui uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-2xl font-display font-bold mt-1 ${
        accent ? "text-purple-primary" : "text-ink"
      }`}>
        {value}
      </p>
    </div>
  );
}

const TX_TYPE_LABELS: Record<string, string> = {
  payment: "Payment received",
  platform_fee: "Platform fee",
  seller_payout: "Payout",
  refund: "Refund",
};

const TX_TYPE_COLORS: Record<string, string> = {
  payment: "text-green-600",
  platform_fee: "text-red-500",
  seller_payout: "text-blue-600",
  refund: "text-orange-600",
};

function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-black/[0.04] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm font-medium text-ink">
          {TX_TYPE_LABELS[tx.type] || tx.type}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {new Date(tx.created_at).toLocaleDateString()} &middot; {tx.status}
        </p>
      </div>
      <span className={`font-ui text-sm font-semibold ${TX_TYPE_COLORS[tx.type] || "text-ink"}`}>
        {tx.type === "platform_fee" || tx.type === "refund" ? "-" : "+"}${Number(tx.amount).toFixed(2)}
      </span>
    </div>
  );
}

export default function EarningsOverview() {
  const { user } = useAuth();
  const { earnings, loading: earningsLoading } = useSellerEarnings(user?.id);
  const { transactions, loading: txLoading, hasMore, loadMore } = useTransactionHistory(user?.id);
  const { openDashboard } = useSellerOnboarding();

  if (earningsLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-display text-2xl text-ink">Earnings</h1>
        <button
          onClick={openDashboard}
          className="px-4 py-2 bg-white border border-black/[0.08] rounded-xl text-sm font-ui font-medium text-ink hover:bg-black/[0.02] transition-colors inline-flex items-center gap-2"
        >
          Stripe Dashboard
          <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs text-muted" />
        </button>
      </div>

      {/* Earnings Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <EarningCard
          label="Total Earned"
          value={`$${(earnings?.total_earned ?? 0).toFixed(2)}`}
          accent
        />
        <EarningCard
          label="Pending"
          value={`$${(earnings?.pending_earnings ?? 0).toFixed(2)}`}
        />
        <EarningCard
          label="Completed Orders"
          value={`${earnings?.completed_orders ?? 0}`}
        />
        <EarningCard
          label="Avg. Order Value"
          value={`$${(earnings?.avg_order_value ?? 0).toFixed(2)}`}
        />
      </div>

      {/* Fee Info */}
      <div className="rounded-xl bg-purple-50 border border-purple-100 p-4 text-sm font-body text-purple-900">
        <strong>Fee structure:</strong> 8% on product sales, 10% on commissions. Stripe processing fees (2.9% + $0.30) are additional.
        Payouts are managed through your Stripe Express dashboard.
      </div>

      {/* Transaction History */}
      <section className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.04]">
          <h2 className="font-display text-lg text-ink">Transaction History</h2>
        </div>

        {txLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-purple-primary mx-auto" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-body text-muted text-sm">No transactions yet.</p>
          </div>
        ) : (
          <>
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={loadMore}
                  className="text-sm font-ui text-purple-primary hover:underline"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
