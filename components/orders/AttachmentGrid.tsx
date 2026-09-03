"use client";

import Image from "next/image";
import type { OrderAttachment } from "@/lib/types/store";
import { useOrderFileUrls } from "@/lib/hooks/useOrderFiles";

function isImage(att: Pick<OrderAttachment, "file_name" | "mime_type">): boolean {
  if (att.mime_type?.startsWith("image/")) return true;
  const ext = att.file_name.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function extLabel(name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() || "FILE";
  return ext.length > 5 ? "FILE" : ext;
}

export interface AttachmentLike {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
}

interface AttachmentGridProps {
  orderId: string;
  attachments: AttachmentLike[];
  /** Tile height; deliveries use the tall one so the work is the first thing you see. */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const HEIGHTS = { sm: "h-20", md: "h-28", lg: "h-40 sm:h-48" };

/** Photo-first grid of order files resolved to short-lived signed URLs. Shared by deliveries, revisions, references and evidence. */
export default function AttachmentGrid({ orderId, attachments, size = "md", className = "" }: AttachmentGridProps) {
  const urls = useOrderFileUrls(orderId, attachments.map((a) => a.storage_path));
  if (attachments.length === 0) return null;
  const cols = size === "lg" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3";
  return (
    <div className={`grid ${cols} gap-3 ${className}`}>
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
            className={`rounded-xl border border-border-light overflow-hidden group transition-colors ${url ? "hover:border-border-strong" : "opacity-60 pointer-events-none"}`}
          >
            {isImage(att) && url ? (
              <Image src={url} alt={att.file_name} width={400} height={300} className={`w-full ${HEIGHTS[size]} object-cover`} unoptimized />
            ) : (
              <div className={`w-full ${HEIGHTS[size]} bg-subtle flex items-center justify-center`}>
                {isImage(att) ? (
                  <span className="w-8 h-8 rounded-lg bg-skeleton animate-pulse" />
                ) : (
                  <span className="px-2 py-1 rounded-md bg-surface border border-border-light text-2xs font-ui font-semibold text-muted tracking-wider">{extLabel(att.file_name)}</span>
                )}
              </div>
            )}
            <div className="px-2 py-1.5 flex items-center justify-between gap-2">
              <span className="text-2xs font-ui text-ink truncate">{att.file_name}</span>
              <span className="text-3xs font-ui text-muted shrink-0 tabular-nums">{formatBytes(att.size_bytes)}</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
