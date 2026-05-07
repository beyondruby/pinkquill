"use client";

import { useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faPaperPlane, faFileAlt, faImage, faVideo, faMusic, faCheck, faUndo } from "@fortawesome/free-solid-svg-icons";
import type { Order } from "@/lib/types/store";
import { useUpdateOrderStatus } from "@/lib/hooks/useOrders";
import { useSendOrderMessage } from "@/lib/hooks/useOrders";
import { supabase } from "@/lib/supabase";

function fileTypeIcon(url: string) {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return faImage;
  if (["mp4", "webm", "mov", "avi"].includes(ext)) return faVideo;
  if (["mp3", "wav", "ogg", "aac"].includes(ext)) return faMusic;
  return faFileAlt;
}

function isImageUrl(url: string): boolean {
  const ext = url.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
}

interface DeliverySectionProps {
  order: Order;
  isSeller: boolean;
  onUpdate?: () => void;
}

export default function DeliverySection({ order, isSeller, onUpdate }: DeliverySectionProps) {
  const { updateStatus, updating } = useUpdateOrderStatus();
  const { sendMessage, sending } = useSendOrderMessage();
  const [deliveryNote, setDeliveryNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const isDelivered = ["submitted", "completed", "delivered"].includes(order.status);
  const canDeliver = isSeller && ["paid", "in_progress", "revision_requested"].includes(order.status);
  const canAcceptOrRevise = !isSeller && order.status === "submitted";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDeliver = async () => {
    if (!deliveryNote.trim() && files.length === 0) return;
    setUploading(true);

    try {
      // Upload files to storage
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `orders/${order.id}/delivery/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("order-files")
          .upload(path, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("order-files")
          .getPublicUrl(path);

        uploadedUrls.push(urlData.publicUrl);
      }

      // Send delivery message with attachments
      if (deliveryNote.trim() || uploadedUrls.length > 0) {
        await sendMessage(
          order.id,
          deliveryNote.trim() || "Delivery files attached",
          uploadedUrls.length > 0
            ? uploadedUrls.map((url) => ({
                url,
                name: url.split("/").pop() || "file",
                type: "",
                size: 0,
              }))
            : undefined
        );
      }

      // Update order status to submitted
      await updateStatus(order.id, "submitted");

      setDeliveryNote("");
      setFiles([]);
      onUpdate?.();
    } catch (err) {
      console.error("Delivery error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleAccept = async () => {
    await updateStatus(order.id, "completed");
    onUpdate?.();
  };

  const handleRequestRevision = async () => {
    await updateStatus(order.id, "revision_requested");
    onUpdate?.();
  };

  return (
    <section className="rounded-2xl border border-border-light bg-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-border-light">
        <h3 className="font-display text-lg text-ink">
          {canDeliver ? "Submit Delivery" : "Delivery"}
        </h3>
        {order.revision_count > 0 && (
          <p className="text-xs font-body text-muted mt-0.5">
            Revisions: {order.revision_count}
            {order.max_revisions != null ? ` / ${order.max_revisions}` : ""}
          </p>
        )}
      </div>

      {/* Existing delivery assets */}
      {order.delivery_assets && order.delivery_assets.length > 0 && (
        <div className="p-5 border-b border-border-light">
          <p className="text-xs font-ui text-muted uppercase tracking-wider mb-3">
            Delivered Files
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {order.delivery_assets.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border-light overflow-hidden hover:border-accent/30 transition-colors group"
              >
                {isImageUrl(url) ? (
                  <Image
                    src={url}
                    alt=""
                    width={200}
                    height={150}
                    className="w-full h-28 object-cover"
                  />
                ) : (
                  <div className="w-full h-28 bg-subtle flex flex-col items-center justify-center gap-2">
                    <FontAwesomeIcon
                      icon={fileTypeIcon(url)}
                      className="text-2xl text-muted group-hover:text-accent transition-colors"
                    />
                    <span className="text-[10px] font-ui text-muted truncate max-w-[90%] px-2">
                      {url.split("/").pop()}
                    </span>
                  </div>
                )}
              </a>
            ))}
          </div>
          {order.delivery_note && (
            <div className="mt-3 p-3 rounded-lg bg-subtle">
              <p className="text-xs font-ui text-muted mb-1">Seller note:</p>
              <p className="text-sm font-body text-ink">{order.delivery_note}</p>
            </div>
          )}
        </div>
      )}

      {/* Seller: deliver form */}
      {canDeliver && (
        <div className="p-5 space-y-3">
          <textarea
            value={deliveryNote}
            onChange={(e) => setDeliveryNote(e.target.value)}
            placeholder="Add a note about this delivery..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface text-sm font-body text-ink placeholder:text-muted focus:ring-2 focus:ring-purple-primary/30 focus:border-purple-primary outline-none resize-none"
          />

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border-strong cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-colors">
              <FontAwesomeIcon icon={faUpload} className="text-muted text-sm" />
              <span className="text-sm font-ui text-muted">
                {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""} selected` : "Attach files"}
              </span>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={handleDeliver}
            disabled={uploading || sending || updating || (!deliveryNote.trim() && files.length === 0)}
            className="w-full py-3 rounded-xl text-sm font-ui font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
            {uploading ? "Uploading..." : sending || updating ? "Submitting..." : "Submit Delivery"}
          </button>
        </div>
      )}

      {/* Buyer: accept or request revision */}
      {canAcceptOrRevise && (
        <div className="p-5 space-y-3">
          <p className="text-sm font-body text-muted">
            The seller has submitted their delivery. Please review the work above.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              disabled={updating}
              className="flex-1 py-3 rounded-xl text-sm font-ui font-semibold bg-gradient-to-r from-emerald-500 to-emerald-500 text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              <FontAwesomeIcon icon={faCheck} className="mr-2" />
              {updating ? "..." : "Accept Delivery"}
            </button>
            {(order.max_revisions == null || order.revision_count < order.max_revisions) && (
              <button
                onClick={handleRequestRevision}
                disabled={updating}
                className="flex-1 py-3 rounded-xl text-sm font-ui font-semibold border border-orange-300 bg-orange-50 text-orange-700 disabled:opacity-60 hover:bg-orange-100 transition-colors"
              >
                <FontAwesomeIcon icon={faUndo} className="mr-2" />
                {updating ? "..." : "Request Revision"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status messages */}
      {isDelivered && !canAcceptOrRevise && !canDeliver && (
        <div className="p-5">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faCheck} className="text-emerald-500" />
            <p className="text-sm font-ui font-medium text-emerald-700">
              {order.status === "completed" ? "Delivery accepted and order completed." : "Delivery submitted, awaiting buyer review."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
