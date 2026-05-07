"use client";

import { useOrderDownloads } from "@/lib/hooks/useDownloads";
import DigitalDownloadCard from "./DigitalDownloadCard";

export default function DigitalDownloadSection({ orderId }: { orderId: string }) {
  const { tokens, loading, error } = useOrderDownloads(orderId);

  if (loading) {
    return (
      <section className="rounded-2xl border border-border-light bg-surface p-5">
        <h3 className="font-display text-lg text-ink mb-3">Your Downloads</h3>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-skeleton/70 rounded-xl animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200/50 bg-red-50 p-5">
        <p className="text-sm font-body text-red-600">Failed to load downloads: {error}</p>
      </section>
    );
  }

  if (tokens.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border-light bg-surface p-5">
      <h3 className="font-display text-lg text-ink mb-1">Your Downloads</h3>
      <p className="text-xs font-body text-muted mb-4">
        Download your files below. Each file has a limited number of downloads.
      </p>
      <div className="space-y-3">
        {tokens.map((token) => (
          <DigitalDownloadCard key={token.id} token={token} />
        ))}
      </div>
    </section>
  );
}
