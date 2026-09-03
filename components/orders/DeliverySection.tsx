"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faPaperPlane, faFileAlt, faImage, faVideo, faMusic, faCheck, faUndo } from "@fortawesome/free-solid-svg-icons";
import type { Order, OrderAttachment, OrderDelivery, OrderRevision, OrderWorkroom } from "@/lib/types/store";
import { useUpdateOrderStatus } from "@/lib/hooks/useOrders";
import { useRequestRevision, useSubmitDelivery } from "@/lib/hooks/useOrderWorkroom";
import { useOrderFileUrls } from "@/lib/hooks/useOrderFiles";

function fileTypeIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return faImage;
  if (["mp4", "webm", "mov", "avi"].includes(ext)) return faVideo;
  if (["mp3", "wav", "ogg", "aac"].includes(ext)) return faMusic;
  return faFileAlt;
}

function isImage(att: OrderAttachment): boolean {
  if (att.mime_type?.startsWith("image/")) return true;
  const ext = att.file_name.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Grid of attachments resolved to signed URLs. Shared by deliveries, revisions and references. */
export function AttachmentGrid({ orderId, attachments }: { orderId: string; attachments: OrderAttachment[] }) {
  const urls = useOrderFileUrls(orderId, attachments.map((a) => a.storage_path));
  if (attachments.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {attachments.map((att) => {
        const url = urls[att.storage_path];
        return (
          <a
            key={att.id}
            href={url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!url}
            title={att.file_name}
            className={`rounded-xl border border-border-light overflow-hidden transition-colors group ${url ? "hover:border-accent/30" : "opacity-50 pointer-events-none"}`}
          >
            {isImage(att) ? (
              url ? (
                <Image src={url} alt={att.file_name} width={200} height={150} className="w-full h-28 object-cover" unoptimized />
              ) : (
                <div className="w-full h-28 bg-subtle animate-pulse" />
              )
            ) : (
              <div className="w-full h-28 bg-subtle flex flex-col items-center justify-center gap-2">
                <FontAwesomeIcon icon={fileTypeIcon(att.file_name)} className="text-2xl text-muted group-hover:text-accent transition-colors" />
              </div>
            )}
            <div className="px-2 py-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] font-ui text-ink truncate">{att.file_name}</span>
              <span className="text-[10px] font-ui text-muted shrink-0">{formatBytes(att.size_bytes)}</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

const DELIVERY_STATUS: Record<OrderDelivery["status"], { label: string; className: string }> = {
  submitted: { label: "Awaiting review", className: "bg-indigo-50 text-indigo-700" },
  revision_requested: { label: "Revision requested", className: "bg-orange-50 text-orange-700" },
  accepted: { label: "Accepted", className: "bg-emerald-50 text-emerald-700" },
  superseded: { label: "Superseded", className: "bg-subtle text-muted" },
};

interface DeliverySectionProps {
  order: Order;
  isSeller: boolean;
  workroom: OrderWorkroom | null;
  onUpdate?: () => void;
  onWorkroomChange?: () => void;
}

export default function DeliverySection({ order, isSeller, workroom, onUpdate, onWorkroomChange }: DeliverySectionProps) {
  const { updateStatus, updating } = useUpdateOrderStatus();
  const { submitDelivery, loading: delivering, error: deliverError } = useSubmitDelivery();
  const { requestRevision, loading: revising, error: reviseError } = useRequestRevision();

  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);
  const [isFinal, setIsFinal] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionFiles, setRevisionFiles] = useState<File[]>([]);

  const canDeliver = isSeller && ["paid", "in_progress", "revision_requested"].includes(order.status);
  const canAcceptOrRevise = !isSeller && order.status === "submitted";
  const revisionsLeft = order.max_revisions == null ? null : Math.max(order.max_revisions - order.revision_count, 0);
  const canRequestRevision = canAcceptOrRevise && (revisionsLeft === null || revisionsLeft > 0);

  const deliveries = useMemo(() => [...(workroom?.deliveries ?? [])].sort((a, b) => b.version - a.version), [workroom]);
  const revisionsById = useMemo(() => {
    const map = new Map<string, OrderRevision>();
    for (const r of workroom?.revisions ?? []) map.set(r.id, r);
    return map;
  }, [workroom]);
  const openRevision = useMemo(() => (workroom?.revisions ?? []).find((r) => r.status === "open") ?? null, [workroom]);

  const refreshAll = () => {
    onUpdate?.();
    onWorkroomChange?.();
  };

  const handleDeliver = async () => {
    if (!deliveryNote.trim() && deliveryFiles.length === 0) return;
    const result = await submitDelivery(order.id, deliveryNote, deliveryFiles, isFinal);
    if (result) {
      setDeliveryNote("");
      setDeliveryFiles([]);
      setIsFinal(false);
      refreshAll();
    }
  };

  const handleAccept = async () => {
    const result = await updateStatus(order.id, "completed");
    if (result) refreshAll();
  };

  const handleRequestRevision = async () => {
    if (!revisionNote.trim()) return;
    const result = await requestRevision(order.id, revisionNote, revisionFiles);
    if (result) {
      setRevisionNote("");
      setRevisionFiles([]);
      setShowRevisionForm(false);
      refreshAll();
    }
  };

  return (
    <section className="rounded-2xl border border-border-light bg-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-border-light flex items-center justify-between gap-3">
        <h3 className="font-display text-lg text-ink">{canDeliver ? "Deliver your work" : "Deliveries"}</h3>
        <p className="text-xs font-body text-muted">
          {deliveries.length} version{deliveries.length === 1 ? "" : "s"}
          {order.max_revisions != null ? ` · ${order.revision_count} / ${order.max_revisions} revisions used` : order.revision_count > 0 ? ` · ${order.revision_count} revisions` : ""}
        </p>
      </div>

      {/* The open revision the seller must address */}
      {canDeliver && openRevision && (
        <div className="p-5 border-b border-border-light bg-orange-50/60">
          <p className="text-[11px] font-ui uppercase tracking-wider text-orange-700 mb-1">Revision {openRevision.number} requested</p>
          <p className="text-sm font-body text-ink whitespace-pre-wrap">{openRevision.note || "No note was added."}</p>
          {openRevision.attachments.length > 0 && (
            <div className="mt-3"><AttachmentGrid orderId={order.id} attachments={openRevision.attachments} /></div>
          )}
        </div>
      )}

      {/* Delivery history, newest first */}
      {deliveries.length > 0 && (
        <div className="divide-y divide-border-light">
          {deliveries.map((delivery) => {
            const status = DELIVERY_STATUS[delivery.status];
            const addressed = delivery.revision_id ? revisionsById.get(delivery.revision_id) : null;
            const followedBy = (workroom?.revisions ?? []).find((r) => r.addressed_by_delivery_id !== delivery.id && r.number === delivery.version && r.status !== "withdrawn");
            return (
              <div key={delivery.id} className="p-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-ui font-semibold text-ink">Delivery v{delivery.version}</span>
                  {delivery.is_final && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-ui font-medium">Final</span>}
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-ui font-medium ${status.className}`}>{status.label}</span>
                  {addressed && <span className="text-[11px] font-ui text-muted">addresses revision {addressed.number}</span>}
                  <span className="ml-auto text-[11px] font-body text-muted">{new Date(delivery.delivered_at).toLocaleString()}</span>
                </div>
                {delivery.note && <p className="text-sm font-body text-ink whitespace-pre-wrap">{delivery.note}</p>}
                <AttachmentGrid orderId={order.id} attachments={delivery.attachments} />
                {followedBy && !canDeliver && (
                  <div className="mt-2 p-3 rounded-lg bg-orange-50/70">
                    <p className="text-[11px] font-ui uppercase tracking-wider text-orange-700 mb-1">Revision {followedBy.number} requested</p>
                    <p className="text-sm font-body text-ink whitespace-pre-wrap">{followedBy.note || "No note was added."}</p>
                    {followedBy.attachments.length > 0 && <div className="mt-2"><AttachmentGrid orderId={order.id} attachments={followedBy.attachments} /></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Seller: deliver form */}
      {canDeliver && (
        <div className="p-5 space-y-3 border-t border-border-light">
          <textarea
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            placeholder={openRevision ? "What changed in this version…" : "Describe what you're delivering…"}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface text-sm font-body text-ink placeholder:text-muted focus:ring-2 focus:ring-purple-primary/30 focus:border-purple-primary outline-none resize-none"
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border-strong cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-colors">
              <FontAwesomeIcon icon={faUpload} className="text-muted text-sm" />
              <span className="text-sm font-ui text-muted">
                {deliveryFiles.length > 0 ? `${deliveryFiles.length} file${deliveryFiles.length > 1 ? "s" : ""} selected` : "Attach files"}
              </span>
              <input type="file" multiple onChange={(e) => setDeliveryFiles(Array.from(e.target.files ?? []).slice(0, 25))} className="hidden" />
            </label>
            <label className="flex items-center gap-2 text-sm font-ui text-ink cursor-pointer">
              <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} className="accent-[var(--color-purple-primary)]" />
              This is the final delivery
            </label>
          </div>
          {deliverError && <p className="text-sm font-body text-red-500">{deliverError}</p>}
          <button
            onClick={handleDeliver}
            disabled={delivering || (!deliveryNote.trim() && deliveryFiles.length === 0)}
            className="w-full py-3 rounded-xl text-sm font-ui font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
            {delivering ? "Uploading…" : `Submit Delivery${deliveries.length > 0 ? ` v${deliveries[0].version + 1}` : ""}`}
          </button>
        </div>
      )}

      {/* Buyer: accept or request revision */}
      {canAcceptOrRevise && (
        <div className="p-5 space-y-3 border-t border-border-light">
          {!showRevisionForm ? (
            <>
              <p className="text-sm font-body text-muted">Review the delivery above. Accepting completes the order and releases payment to the creator after the protection window.</p>
              <div className="flex gap-3">
                <button
                  onClick={handleAccept}
                  disabled={updating}
                  className="flex-1 py-3 rounded-xl text-sm font-ui font-semibold bg-emerald-500 text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
                >
                  <FontAwesomeIcon icon={faCheck} className="mr-2" />
                  {updating ? "…" : "Accept Delivery"}
                </button>
                {canRequestRevision && (
                  <button
                    onClick={() => setShowRevisionForm(true)}
                    disabled={updating}
                    className="flex-1 py-3 rounded-xl text-sm font-ui font-semibold border border-orange-200 bg-orange-50 text-orange-700 disabled:opacity-60 hover:bg-orange-100 transition-colors"
                  >
                    <FontAwesomeIcon icon={faUndo} className="mr-2" />
                    Request Revision{revisionsLeft !== null ? ` (${revisionsLeft} left)` : ""}
                  </button>
                )}
              </div>
              {!canRequestRevision && order.max_revisions != null && (
                <p className="text-xs font-body text-muted">All {order.max_revisions} included revisions have been used. Message the creator if you need more.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-sm font-ui font-semibold text-ink">What should change?</p>
              <textarea
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Be specific — what to keep, what to change, and any references."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface text-sm font-body text-ink placeholder:text-muted focus:ring-2 focus:ring-orange-300/40 focus:border-orange-300 outline-none resize-none"
              />
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border-strong cursor-pointer hover:border-accent/40 transition-colors">
                <FontAwesomeIcon icon={faUpload} className="text-muted text-sm" />
                <span className="text-sm font-ui text-muted">
                  {revisionFiles.length > 0 ? `${revisionFiles.length} file${revisionFiles.length > 1 ? "s" : ""} selected` : "Attach markups or references"}
                </span>
                <input type="file" multiple onChange={(e) => setRevisionFiles(Array.from(e.target.files ?? []).slice(0, 25))} className="hidden" />
              </label>
              {reviseError && <p className="text-sm font-body text-red-500">{reviseError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={handleRequestRevision}
                  disabled={revising || !revisionNote.trim()}
                  className="flex-1 py-3 rounded-xl text-sm font-ui font-semibold bg-orange-500 text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
                >
                  {revising ? "Sending…" : `Send Revision ${order.revision_count + 1}`}
                </button>
                <button
                  onClick={() => setShowRevisionForm(false)}
                  disabled={revising}
                  className="px-4 py-3 rounded-xl text-sm font-ui font-medium border border-border-light text-muted hover:bg-subtle"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Status line */}
      {!canAcceptOrRevise && !canDeliver && (
        <div className="p-5 border-t border-border-light">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faCheck} className={order.status === "completed" ? "text-emerald-500" : "text-muted"} />
            <p className="text-sm font-ui font-medium text-ink">
              {order.status === "completed"
                ? "Delivery accepted and order completed."
                : order.status === "submitted"
                  ? "Delivery submitted, awaiting the buyer's review."
                  : order.status === "revision_requested"
                    ? "Revision requested — waiting on the creator."
                    : deliveries.length === 0
                      ? "Nothing delivered yet."
                      : "Work in progress."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
