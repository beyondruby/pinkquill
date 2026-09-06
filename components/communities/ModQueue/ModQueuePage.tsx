"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModQueue, useResolveReport, useModerationActions } from "@/lib/hooks/useModQueue";
import { createNotification } from "@/lib/hooks/useNotifications";
import ReportCard from "./ReportCard";
import type { ReportStatus, ReportType, ResolutionAction } from "@/lib/types";
import { Spinner } from "@/components/ui/Loading";
import "@/components/communities/communities.css";

interface ModQueuePageProps {
  communityId: string;
}

export default function ModQueuePage({ communityId }: ModQueuePageProps) {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | undefined>("pending");
  const [typeFilter, setTypeFilter] = useState<ReportType | undefined>(undefined);

  const { reports, stats, loading, error, refetch } = useModQueue(communityId, {
    status: statusFilter,
    type: typeFilter,
  });

  const { resolve, dismiss, loading: resolving } = useResolveReport();
  const { deleteContent, muteUser, banUser } = useModerationActions(communityId);

  const handleResolve = async (reportId: string, action: ResolutionAction, notes?: string) => {
    if (!user) return;

    const success = await resolve(reportId, user.id, action, notes);
    if (success) {
      // Perform the moderation action
      const report = reports.find((r) => r.id === reportId);
      if (report) {
        if (action === "content_deleted" && report.reported_post_id) {
          await deleteContent(report.reported_post_id);
        } else if (action === "user_muted" && report.reported_user_id) {
          await muteUser(report.reported_user_id, notes || "Violated community guidelines", 7);
        } else if (action === "user_banned" && report.reported_user_id) {
          await banUser(report.reported_user_id, notes || "Violated community guidelines");
        } else if (action === "warning_sent" && report.reported_user_id) {
          await createNotification(
            report.reported_user_id,
            user.id,
            "community_warning",
            report.reported_post_id || undefined,
            notes || "Your content was reported and reviewed by a moderator. Please review the community guidelines.",
            communityId
          );
        }
      }
      refetch();
    }
  };

  const handleDismiss = async (reportId: string, notes?: string) => {
    if (!user) return;
    const success = await dismiss(reportId, user.id, notes);
    if (success) {
      refetch();
    }
  };

  const statusOptions: { value: ReportStatus | undefined; label: string }[] = [
    { value: "pending", label: "Open" },
    { value: "reviewed", label: "Reviewed" },
    { value: "resolved", label: "Resolved" },
    { value: undefined, label: "All" },
  ];
  const typeOptions: { value: ReportType | undefined; label: string }[] = [
    { value: undefined, label: "Everything" },
    { value: "post", label: "Posts" },
    { value: "comment", label: "Comments" },
    { value: "user", label: "People" },
  ];

  return (
    <div className="grid gap-5">
      <div className="pq-stat-row">
        <div className="pq-stat"><span className="pq-stat__value">{stats.pending}</span><span className="pq-stat__label">Open reports</span></div>
        <div className="pq-stat"><span className="pq-stat__value">{stats.resolvedThisWeek}</span><span className="pq-stat__label">Resolved this week</span></div>
      </div>

      <div className="pq-community-sort">
        <div className="pq-community-sort__left">
          <div className="pq-segmented" role="radiogroup" aria-label="Status">
            {statusOptions.map((option) => (
              <button key={option.label} type="button" role="radio" aria-checked={statusFilter === option.value} className="pq-segmented__option" onClick={() => setStatusFilter(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="pq-chip-row" role="group" aria-label="Kind">
            {typeOptions.map((option) => (
              <button key={option.label} type="button" className="pq-chip" aria-pressed={typeFilter === option.value} onClick={() => setTypeFilter(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="pq-icon-button" onClick={() => refetch()} aria-label="Refresh reports" title="Refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-[18px] h-[18px]">
            <path d="M4 4v5h5M20 20v-5h-5" />
            <path d="M19.4 9A8 8 0 0 0 5.6 6.2L4 9M4.6 15a8 8 0 0 0 13.8 2.8L20 15" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="pq-feed-state" role="status" aria-label="Loading reports"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="pq-feed-state pq-feed-state--card" role="alert">
          <p className="pq-feed-state__title">Reports didn&rsquo;t load</p>
          <p className="pq-feed-state__text">{error}</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">{statusFilter === "pending" ? "Nothing waiting" : "No reports here"}</p>
          <p className="pq-feed-state__text">{statusFilter === "pending" ? "Every report has been looked at." : "Nothing matches these filters."}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onResolve={(action, notes) => handleResolve(report.id, action, notes)}
              onDismiss={(notes) => handleDismiss(report.id, notes)}
              resolving={resolving}
            />
          ))}
        </div>
      )}
    </div>
  );
}
