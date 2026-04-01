"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { Report, ResolutionAction } from "@/lib/types";

interface ReportCardProps {
  report: Report;
  onResolve: (action: ResolutionAction, notes?: string) => void;
  onDismiss: (notes?: string) => void;
  resolving?: boolean;
}

// Format date as relative time
function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// Get status badge styles
function getStatusStyles(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "reviewed":
      return "bg-purple-primary/10 text-purple-primary";
    case "resolved":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-black/[0.04] text-ink/70";
  }
}

// Truncate content
function truncateContent(content: string, maxLength: number = 200): string {
  const stripped = content.replace(/<[^>]*>/g, "");
  if (stripped.length <= maxLength) return stripped;
  return stripped.substring(0, maxLength) + "...";
}

export default function ReportCard({
  report,
  onResolve,
  onDismiss,
  resolving = false,
}: ReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedAction, setSelectedAction] = useState<ResolutionAction | null>(null);

  const handleAction = () => {
    if (selectedAction) {
      onResolve(selectedAction, notes || undefined);
    }
    setShowActions(false);
    setNotes("");
    setSelectedAction(null);
  };

  const handleDismiss = () => {
    onDismiss(notes || undefined);
    setShowActions(false);
    setNotes("");
  };

  return (
    <div className="bg-white rounded-xl border border-black/[0.06] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-black/[0.06]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Reporter Avatar */}
            {report.reporter?.avatar_url ? (
              <img
                src={report.reporter.avatar_url}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white font-bold text-sm">
                {report.reporter?.username?.charAt(0).toUpperCase() || "?"}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">
                  {report.reporter?.display_name || report.reporter?.username || "Anonymous"}
                </span>
                <span className="text-xs text-muted">reported</span>
                {report.type === "user" && report.reported_user && (
                  <Link
                    href={`/studio/${report.reported_user.username}`}
                    className="font-medium text-purple-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{report.reported_user.username}
                  </Link>
                )}
                {report.type === "post" && (
                  <span className="text-muted">a post</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                <span>{formatTimeAgo(report.created_at)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyles(report.status)}`}>
                  {report.status}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/[0.04] text-ink/60 text-xs">
                  {report.type}
                </span>
              </div>
            </div>
          </div>

          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-muted hover:text-ink transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="p-4">
        {/* Reason */}
        <div className="mb-3">
          <span className="text-xs text-muted uppercase tracking-wide">Reason</span>
          <p className="text-ink font-medium mt-1">{report.reason}</p>
        </div>

        {/* Additional details */}
        {report.details && (
          <div className="mb-3">
            <span className="text-xs text-muted uppercase tracking-wide">Details</span>
            <p className="text-ink text-sm mt-1">{report.details}</p>
          </div>
        )}

        {/* Reported content preview */}
        {report.reported_post && (
          <div className="mt-4 p-3 bg-black/[0.02] rounded-lg">
            <span className="text-xs text-muted uppercase tracking-wide">Reported Content</span>
            <div className="mt-2">
              {report.reported_post.title && (
                <p className="font-medium text-ink text-sm mb-1">{report.reported_post.title}</p>
              )}
              <p className="text-sm text-muted">
                {isExpanded
                  ? report.reported_post.content.replace(/<[^>]*>/g, "")
                  : truncateContent(report.reported_post.content)}
              </p>
              {!isExpanded && report.reported_post.content.length > 200 && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="text-purple-primary text-sm mt-1 hover:underline"
                >
                  Show more
                </button>
              )}
            </div>
          </div>
        )}

        {/* Resolution info if resolved */}
        {report.status === "resolved" && report.resolver && (
          <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
            <span className="text-xs text-emerald-700 uppercase tracking-wide">Resolved</span>
            <p className="text-sm text-emerald-800 mt-1">
              {report.resolution_action?.replace(/_/g, " ")} by {report.resolver.display_name || report.resolver.username}
              {report.resolved_at && ` • ${formatTimeAgo(report.resolved_at)}`}
            </p>
            {report.resolution_notes && (
              <p className="text-sm text-emerald-700 mt-1 italic">{report.resolution_notes}</p>
            )}
          </div>
        )}
      </div>

      {/* Actions (only for pending/reviewed reports) */}
      {report.status !== "resolved" && (
        <div className="px-4 pb-4">
          {!showActions ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowActions(true)}
                className="flex-1 px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-primary/90 transition-colors font-ui text-sm"
              >
                Take Action
              </button>
              <button
                onClick={() => onDismiss()}
                disabled={resolving}
                className="px-4 py-2 text-muted hover:text-ink border border-black/[0.08] rounded-lg hover:border-black/[0.12] transition-colors font-ui text-sm"
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Action Selection */}
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-2">
                  Select Action
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "content_deleted" as ResolutionAction, label: "Delete Content", color: "red" },
                    { value: "user_muted" as ResolutionAction, label: "Mute User", color: "amber" },
                    { value: "user_banned" as ResolutionAction, label: "Ban User", color: "red" },
                    { value: "warning_sent" as ResolutionAction, label: "Send Warning", color: "blue" },
                  ].map((action) => (
                    <button
                      key={action.value}
                      onClick={() => setSelectedAction(action.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedAction === action.value
                          ? action.color === "red"
                            ? "bg-red-500 text-white"
                            : action.color === "amber"
                              ? "bg-amber-500 text-white"
                              : "bg-purple-primary text-white"
                          : "bg-black/[0.04] text-ink/70 hover:bg-black/[0.06]"
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-muted uppercase tracking-wide block mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this action..."
                  className="w-full px-3 py-2 border border-black/[0.08] rounded-lg text-sm focus:border-purple-primary focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleAction}
                  disabled={!selectedAction || resolving}
                  className="flex-1 px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-primary/90 transition-colors font-ui text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resolving ? "Processing..." : "Confirm Action"}
                </button>
                <button
                  onClick={handleDismiss}
                  disabled={resolving}
                  className="px-4 py-2 text-muted hover:text-ink transition-colors font-ui text-sm"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    setShowActions(false);
                    setSelectedAction(null);
                    setNotes("");
                  }}
                  className="px-4 py-2 text-muted hover:text-ink transition-colors font-ui text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
