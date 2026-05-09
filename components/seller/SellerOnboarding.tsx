"use client";

import { useSellerOnboarding } from "@/lib/hooks/usePayments";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStore,
  faCheckCircle,
  faSpinner,
  faExternalLinkAlt,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import Loading from "@/components/ui/Loading";

const PROVIDER_LABELS: Record<string, string> = {
  stripe: "Stripe",
  placeholder: "Placeholder",
};

function getProviderLabel(provider?: string): string {
  return PROVIDER_LABELS[provider || "placeholder"] || "Payment";
}

export default function SellerOnboarding() {
  const { account, loading, error, startOnboarding, checkStatus, openDashboard } =
    useSellerOnboarding();

  const providerLabel = getProviderLabel(account?.provider);
  const isSetupComplete = Boolean(
    account
    && account.onboarding_complete
    && account.payouts_enabled
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loading size="small" text="" />
      </div>
    );
  }

  // Not yet started
  if (!account) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 px-6">
        <div className="w-16 h-16 bg-purple-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <FontAwesomeIcon icon={faStore} className="text-2xl text-[var(--color-purple-primary)]" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Start Selling on Quill</h2>
        <p className="text-ink/60 mb-2">
          Share your art, offer commissions, and earn from your creative work.
        </p>
        <p className="text-sm text-muted mb-8">
          Complete setup to receive payouts for your sales.
          Quill charges a 5% platform fee on all sales.
        </p>

        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}

        <button
          onClick={startOnboarding}
          className="px-8 py-3 bg-[var(--color-purple-primary)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
        >
          Set Up Seller Account
        </button>
      </div>
    );
  }

  // Onboarding incomplete
  if (!isSetupComplete) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 px-6">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-yellow-600" />
        </div>
        <h2 className="text-xl font-bold mb-3">Complete Your Setup</h2>
        <p className="text-ink/60 mb-6">
          Your seller account is almost ready. Complete the {providerLabel} onboarding to start receiving payouts.
        </p>

        <div className="bg-subtle rounded-lg p-4 mb-6 text-left space-y-2">
          <StatusRow label="Account created" done />
          <StatusRow label="Identity verified" done={account.onboarding_complete} />
          <StatusRow label="Payouts enabled" done={account.payouts_enabled} />
        </div>

        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={startOnboarding}
            className="px-6 py-2.5 bg-[var(--color-purple-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Continue Setup
          </button>
          <button
            onClick={checkStatus}
            className="px-6 py-2.5 border border-border-strong rounded-lg text-sm font-medium text-ink/70 hover:bg-subtle"
          >
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  // Fully set up
  return (
    <div className="max-w-lg mx-auto text-center py-12 px-6">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <FontAwesomeIcon icon={faCheckCircle} className="text-2xl text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold mb-3">Seller Account Active</h2>
      <p className="text-ink/60 mb-6">
        {account.placeholder_mode
          ? "Placeholder payments are active while payment setup is pending."
          : `Your ${providerLabel} account is set up and ready to receive payouts.`}
      </p>

      <div className="bg-subtle rounded-lg p-4 mb-6 text-left space-y-2">
        <StatusRow label="Identity verified" done />
        <StatusRow label="Payouts enabled" done={account.payouts_enabled} />
        {account.country && (
          <div className="text-sm text-muted pt-1">
            Country: {account.country.toUpperCase()}
          </div>
        )}
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-4">{error}</p>
      )}

      <button
        onClick={openDashboard}
        className="px-6 py-2.5 bg-[var(--color-purple-primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
      >
        <span>{account.placeholder_mode ? "Open Placeholder Setup" : `Open ${providerLabel} Dashboard`}</span>
        <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs" />
      </button>
    </div>
  );
}

function StatusRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <FontAwesomeIcon
        icon={faCheckCircle}
        className={done ? "text-emerald-500" : "text-muted/40"}
      />
      <span className={done ? "text-ink" : "text-muted"}>{label}</span>
    </div>
  );
}
