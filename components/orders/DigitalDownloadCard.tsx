"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faFile, faFileImage, faFileAudio, faFileVideo, faFilePdf, faFileZipper, faCheck, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import type { DownloadToken } from "@/lib/types/store";
import { useDownloadFile } from "@/lib/hooks/useDownloads";

function fileIcon(type: string | null | undefined) {
  if (!type) return faFile;
  if (type.startsWith("image/")) return faFileImage;
  if (type.startsWith("audio/")) return faFileAudio;
  if (type.startsWith("video/")) return faFileVideo;
  if (type.includes("pdf")) return faFilePdf;
  if (type.includes("zip") || type.includes("rar") || type.includes("tar")) return faFileZipper;
  return faFile;
}

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DigitalDownloadCard({ token }: { token: DownloadToken }) {
  const { download, downloading } = useDownloadFile();
  const [downloaded, setDownloaded] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const file = token.file;
  const remaining = token.download_limit != null
    ? token.download_limit - token.downloads_used
    : null;
  const exhausted = remaining != null && remaining <= 0;
  const expired = token.expires_at ? new Date(token.expires_at) < new Date() : false;
  const disabled = exhausted || expired || downloading;

  const handleDownload = async () => {
    setLocalError(null);
    const result = await download(token.token);
    if (result) {
      setDownloaded(true);
      // Trigger browser download
      const a = document.createElement("a");
      a.href = result.file_url;
      a.download = result.file_name;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => setDownloaded(false), 3000);
    } else {
      setLocalError("Failed to download. Please try again.");
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border-light bg-surface">
      {/* File icon */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center shrink-0">
        <FontAwesomeIcon
          icon={fileIcon(file?.file_type)}
          className="text-purple-primary text-lg"
        />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="font-ui font-medium text-ink text-sm truncate">
          {file?.file_name || "File"}
        </p>
        <div className="flex items-center gap-2 text-xs font-body text-muted mt-0.5">
          {file?.file_size && <span>{formatSize(file.file_size)}</span>}
          {remaining != null && (
            <>
              <span>&middot;</span>
              <span className={exhausted ? "text-red-500" : ""}>
                {remaining} download{remaining !== 1 ? "s" : ""} left
              </span>
            </>
          )}
          {expired && (
            <>
              <span>&middot;</span>
              <span className="text-red-500">Expired</span>
            </>
          )}
        </div>
        {localError && (
          <p className="text-xs text-red-500 mt-1">{localError}</p>
        )}
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={disabled}
        className={`shrink-0 px-4 py-2 rounded-xl text-sm font-ui font-semibold transition-all ${
          downloaded
            ? "bg-emerald-100 text-emerald-700"
            : disabled
              ? "bg-skeleton/70 text-muted/60 cursor-not-allowed"
              : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white hover:opacity-90"
        }`}
      >
        <FontAwesomeIcon
          icon={downloaded ? faCheck : exhausted || expired ? faExclamationTriangle : faDownload}
          className="mr-1.5"
        />
        {downloading
          ? "..."
          : downloaded
            ? "Done"
            : exhausted
              ? "Limit reached"
              : expired
                ? "Expired"
                : "Download"}
      </button>
    </div>
  );
}
