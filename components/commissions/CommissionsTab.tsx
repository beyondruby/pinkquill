"use client";

import Link from "next/link";
import { useState } from "react";
import { useSellerCommissions } from "@/lib/hooks/useCommissions";
import type { Product } from "@/lib/types/store";

interface CommissionsTabProps {
  userId: string;
  isOwnProfile: boolean;
  pageLoaded: boolean;
}

export default function CommissionsTab({ userId, isOwnProfile, pageLoaded }: CommissionsTabProps) {
  const { commissions, loading, error } = useSellerCommissions(userId);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const filtered = commissions.filter((item) => {
    if (filter === "all") return true;
    if (filter === "active") return item.status === "active";
    return ["draft", "paused", "archived"].includes(item.status);
  });

  if (loading) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 rounded-full border-2 border-pink-vivid/20 border-t-pink-vivid animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="text-center py-14">
          <p className="font-ui text-red-500">Failed to load commissions</p>
          <p className="text-sm font-body text-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (commissions.length === 0) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="rounded-3xl border border-pink-100 bg-gradient-to-br from-pink-50/70 via-white to-orange-50/50 p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-primary/15 to-pink-vivid/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 7h8m-8 4h5m-5 4h6m6 2a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8z" />
            </svg>
          </div>

          <h3 className="font-display text-2xl text-ink mb-3">
            {isOwnProfile ? "Launch your first commission" : "No commissions yet"}
          </h3>
          <p className="font-body text-muted max-w-md mx-auto">
            {isOwnProfile
              ? "Package your process into clear tiers and start getting hired directly from your studio."
              : "This creator has not published commission services yet."}
          </p>

          {isOwnProfile && (
            <Link
              href="/sell/service"
              className="inline-flex mt-7 items-center gap-2 px-6 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm hover:shadow-lg hover:shadow-pink-vivid/20 transition-all"
            >
              Add Service
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
      <div className="flex items-center justify-between gap-3 mb-7">
        <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-gradient-to-r from-orange-50 to-pink-50">
          {[
            { id: "all", label: "All", count: commissions.length },
            { id: "active", label: "Active", count: commissions.filter((item) => item.status === "active").length },
            { id: "inactive", label: "Inactive", count: commissions.filter((item) => ["draft", "paused", "archived"].includes(item.status)).length },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id as typeof filter)}
              className={`px-4 py-2 rounded-xl text-sm font-ui transition-all ${
                filter === item.id ? "bg-white text-pink-vivid shadow-sm font-medium" : "text-muted hover:text-ink"
              }`}
            >
              {item.label}
              <span className="ml-1.5 text-xs">{item.count}</span>
            </button>
          ))}
        </div>

        {isOwnProfile && (
          <Link
            href="/sell/service"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Service
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((commission) => (
          <CommissionCard key={commission.id} commission={commission} />
        ))}
      </div>
    </div>
  );
}

function CommissionCard({ commission }: { commission: Product }) {
  const cover = commission.primary_image_url;

  return (
    <Link
      href={`/commissions/${commission.id}`}
      className="group rounded-2xl border border-black/[0.06] overflow-hidden bg-white hover:shadow-xl hover:shadow-pink-vivid/10 hover:-translate-y-1 transition-all"
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-pink-50 to-orange-50 relative overflow-hidden">
        {cover ? (
          <img src={cover} alt={commission.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-pink-vivid/40">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h8m-8 4h5m-5 4h6m6 2a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8z" />
            </svg>
          </div>
        )}

        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[11px] font-ui font-semibold bg-white/90 text-purple-primary">
          Commission
        </div>
      </div>

      <div className="p-4">
        <p className="text-xs font-ui uppercase tracking-wider text-muted mb-1">{commission.category}</p>
        <h3 className="font-display text-lg leading-snug text-ink mb-2 line-clamp-2 group-hover:text-pink-vivid transition-colors">
          {commission.title}
        </h3>

        {commission.min_price !== undefined ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-body text-muted">Starting at</span>
            <span className="font-display text-xl font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
              ${commission.min_price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </span>
          </div>
        ) : (
          <p className="text-sm font-body text-muted">Price on request</p>
        )}
      </div>
    </Link>
  );
}
