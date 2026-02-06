"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModQueue, useResolveReport, useModerationActions } from "@/lib/hooks/useModQueue";
import ReportCard from "./ReportCard";
import type { ReportStatus, ReportType, ResolutionAction } from "@/lib/types";

interface ModQueuePageProps {
  communityId: string;
}

export default function ModQueuePage({ communityId }: ModQueuePageProps) {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | undefined>("pending");
  const [typeFilter, setTypeFilter] = useState<ReportType | undefined>(undefined);
  const pendingResolveRef = useRef(false);
  const pendingDismissRef = useRef(false);

  const { reports, stats, loading, error, refetch } = useModQueue(communityId, {
    status: statusFilter,
    type: typeFilter,
  });

  const { resolve, dismiss, loading: resolving } = useResolveReport();
  const { deleteContent, muteUser, banUser } = useModerationActions(communityId);

  const handleResolve = async (reportId: string, action: ResolutionAction, notes?: string) => {
    if (!user || pendingResolveRef.current) return;
    pendingResolveRef.current = true;

    try {
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
          }
        }
        refetch();
      }
    } finally {
      pendingResolveRef.current = false;
    }
  };

  const handleDismiss = async (reportId: string, notes?: string) => {
    if (!user || pendingDismissRef.current) return;
    pendingDismissRef.current = true;

    try {
      const success = await dismiss(reportId, user.id, notes);
      if (success) {
        refetch();
      }
    } finally {
      pendingDismissRef.current = false;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-black/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{stats.pending}</p>
              <p className="text-sm text-muted">Pending Reports</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-black/[0.06] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-ink">{stats.resolvedThisWeek}</p>
              <p className="text-sm text-muted">Resolved This Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-black/[0.06]">
          {[
            { value: "pending" as ReportStatus, label: "Pending" },
            { value: "reviewed" as ReportStatus, label: "Reviewed" },
            { value: "resolved" as ReportStatus, label: "Resolved" },
            { value: undefined, label: "All" },
          ].map((option) => (
            <button
              key={option.label}
              onClick={() => setStatusFilter(option.value)}
              className={`px-3 py-1.5 rounded-md font-ui text-sm transition-colors ${
                statusFilter === option.value
                  ? "bg-purple-primary text-white"
                  : "text-muted hover:text-ink hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-white rounded-lg border border-black/[0.06]">
          {[
            { value: undefined, label: "All Types" },
            { value: "post" as ReportType, label: "Posts" },
            { value: "comment" as ReportType, label: "Comments" },
            { value: "user" as ReportType, label: "Users" },
          ].map((option) => (
            <button
              key={option.label}
              onClick={() => setTypeFilter(option.value)}
              className={`px-3 py-1.5 rounded-md font-ui text-sm transition-colors ${
                typeFilter === option.value
                  ? "bg-purple-primary text-white"
                  : "text-muted hover:text-ink hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => refetch()}
          className="ml-auto p-2 text-muted hover:text-purple-primary hover:bg-purple-50 rounded-lg transition-colors"
          title="Refresh"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-purple-primary/20 border-t-purple-primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <p className="text-muted text-lg">No reports found</p>
          <p className="text-sm text-muted mt-1">
            {statusFilter === "pending"
              ? "All caught up! No pending reports."
              : "No reports match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
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
