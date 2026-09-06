"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { getTimeAgo as formatTimeAgo } from "@/lib/utils/time";
import type { Report, ResolutionAction } from "@/lib/types";
import Button from "@/components/ui/Button";
import { FieldLabel } from "@/components/create/pieces";
import { PersonAvatar, personName } from "@/components/communities/pieces";

interface ReportCardProps {
  report: Report;
  onResolve: (action: ResolutionAction, notes?: string) => void;
  onDismiss: (notes?: string) => void;
  resolving?: boolean;
}

const STATUS_WORD: Record<string, string> = { pending: "Open", reviewed: "Reviewed", resolved: "Resolved" };

const ACTIONS: { value: ResolutionAction; label: string; desc: string }[] = [
  { value: "warning_sent", label: "Send a warning", desc: "They get a note pointing to the rules. Nothing is removed." },
  { value: "content_deleted", label: "Remove the content", desc: "The post comes down and is logged." },
  { value: "user_muted", label: "Mute for 7 days", desc: "They stay a member but can't post or comment." },
  { value: "user_banned", label: "Ban", desc: "They're removed from the community." },
];

function plain(content: string): string {
  return content.replace(/<[^>]*>/g, "");
}

/**
 * One report: who flagged what and why, the content, and a deliberate way to
 * resolve it. Actions open in place with the lightest option first.
 */
export default function ReportCard({ report, onResolve, onDismiss, resolving = false }: ReportCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedAction, setSelectedAction] = useState<ResolutionAction | null>(null);
  const notesId = useId();

  const reset = () => {
    setShowActions(false);
    setNotes("");
    setSelectedAction(null);
  };

  const target = report.type === "user" && report.reported_user
    ? <Link href={`/studio/${report.reported_user.username}`} className="font-semibold">@{report.reported_user.username}</Link>
    : report.type === "comment" ? "a comment" : "a post";

  const content = report.reported_post?.content ? plain(report.reported_post.content) : "";
  const isLong = content.length > 200;

  return (
    <article className="pq-report" aria-label={`Report by ${personName(report.reporter)}`}>
      <div className="flex items-start gap-3">
        <PersonAvatar person={report.reporter} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="pq-report__head">
            <span className="font-semibold">{personName(report.reporter)}</span>
            <span>reported</span>
            <span>{target}</span>
            <span className="pq-report__when">{formatTimeAgo(report.created_at)}</span>
            <span aria-hidden="true">·</span>
            <span className="pq-report__status">{STATUS_WORD[report.status] || report.status}</span>
          </p>
        </div>
      </div>

      <div>
        <span className="pq-report__label">Reason</span>
        <p className="pq-report__text">{report.reason}</p>
        {report.details && <p className="pq-report__text text-subdued mt-1">{report.details}</p>}
      </div>

      {report.reported_post && (
        <div className="pq-report__quote">
          {report.reported_post.title && <strong>{report.reported_post.title}</strong>}
          {isExpanded || !isLong ? content : `${content.slice(0, 200)}…`}
          {isLong && (
            <div className="mt-1">
              <button type="button" className="pq-side-card__link" style={{ minBlockSize: "2rem" }} onClick={() => setIsExpanded((v) => !v)}>
                {isExpanded ? "Show less" : "Show all"}
              </button>
            </div>
          )}
        </div>
      )}

      {report.status === "resolved" && report.resolver && (
        <p className="pq-report__text text-subdued">
          {(report.resolution_action || "resolved").replace(/_/g, " ")} by {personName(report.resolver)}
          {report.resolved_at ? `, ${formatTimeAgo(report.resolved_at)}` : ""}
          {report.resolution_notes ? ` · ${report.resolution_notes}` : ""}
        </p>
      )}

      {report.status !== "resolved" && (
        !showActions ? (
          <div className="pq-report__actions">
            <Button variant="primary" size="sm" onClick={() => setShowActions(true)}>Decide</Button>
            <Button variant="ghost" size="sm" onClick={() => onDismiss()} disabled={resolving}>Dismiss</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <div>
              <p className="pq-label">What happens</p>
              <div className="pq-choice-grid" role="radiogroup" aria-label="What happens">
                {ACTIONS.map((action) => (
                  <button key={action.value} type="button" role="radio" aria-checked={selectedAction === action.value} className="pq-choice" onClick={() => setSelectedAction(action.value)}>
                    <span>
                      <strong className="block font-semibold">{action.label}</strong>
                      <span className="text-sm text-subdued">{action.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel htmlFor={notesId} hint="(optional, shown to them where it applies)">Note</FieldLabel>
              <textarea id={notesId} className="pq-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you saw and why this is the outcome." />
            </div>
            <div className="pq-report__actions">
              <Button
                variant={selectedAction === "user_banned" || selectedAction === "content_deleted" ? "danger" : "primary"}
                size="sm"
                onClick={() => { if (selectedAction) onResolve(selectedAction, notes || undefined); reset(); }}
                disabled={!selectedAction}
                loading={resolving}
                loadingText="Applying…"
              >
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { onDismiss(notes || undefined); reset(); }} disabled={resolving}>Dismiss instead</Button>
              <Button variant="ghost" size="sm" onClick={reset} disabled={resolving}>Cancel</Button>
            </div>
          </div>
        )
      )}
    </article>
  );
}
