"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

export interface MediaPreview {
  id?: string;
  file?: File | null;
  url: string;
  isPrimary: boolean;
  mediaType?: "image" | "video";
}

interface MediaPickerProps {
  previews: MediaPreview[];
  onChange: (previews: MediaPreview[]) => void;
  onError: (message: string | null) => void;
  max: number;
  accept: string[];
  maxImageBytes: number;
  maxVideoBytes?: number;
  hint: string;
}

export function isVideoMedia(preview: { file?: File | null; mediaType?: string; url: string }): boolean {
  if (preview.mediaType) return preview.mediaType === "video";
  if (preview.file?.type) return preview.file.type.startsWith("video/");
  return /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(preview.url);
}

/**
 * The upload circle from the product wizard plus the cover/remove tiles from
 * the commission wizard. Object URLs are minted here; the wizard that owns
 * the state revokes them when it unmounts (removal revokes right away).
 */
export default function MediaPicker({ previews, onChange, onError, max, accept, maxImageBytes, maxVideoBytes, hint }: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const full = previews.length >= max;

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    onError(null);
    const accepted: MediaPreview[] = [];
    for (const file of Array.from(files)) {
      if (!accept.includes(file.type)) { onError("That file type isn't supported here."); continue; }
      const isVideo = file.type.startsWith("video/");
      const limit = isVideo ? (maxVideoBytes ?? maxImageBytes) : maxImageBytes;
      if (file.size > limit) { onError(`${isVideo ? "Videos" : "Images"} must be under ${Math.round(limit / 1048576)} MB.`); continue; }
      if (previews.length + accepted.length >= max) { onError(`Up to ${max} files.`); break; }
      accepted.push({ file, url: URL.createObjectURL(file), isPrimary: previews.length === 0 && accepted.length === 0, mediaType: isVideo ? "video" : "image" });
    }
    if (accepted.length) onChange([...previews, ...accepted]);
  }, [accept, max, maxImageBytes, maxVideoBytes, onChange, onError, previews]);

  const setCover = (index: number) => onChange(previews.map((m, i) => ({ ...m, isPrimary: i === index })));
  const remove = (index: number) => {
    const item = previews[index];
    if (item?.file) URL.revokeObjectURL(item.url);
    const next = previews.filter((_, i) => i !== index);
    if (next.length && !next.some((m) => m.isPrimary)) next[0].isPrimary = true;
    onChange(next);
  };

  const onDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); if (!full) addFiles(e.dataTransfer.files); };

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept.join(",")} multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} className="sr-only" />
      <div className="flex flex-col items-center">
        <button
          type="button"
          onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          disabled={full}
          aria-label="Upload"
          className={`w-40 h-40 rounded-full flex items-center justify-center transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-vivid/40 ${dragActive ? "bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20" : "bg-pink-vivid/5 hover:bg-pink-vivid/10"} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-colors duration-300 ${dragActive ? "bg-gradient-to-br from-orange-warm/30 to-pink-vivid/30" : "bg-pink-vivid/10"}`}>
            <svg className={`w-9 h-9 mb-1 ${dragActive ? "text-pink-vivid" : "text-pink-vivid/60"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-xs font-ui font-semibold ${dragActive ? "text-pink-vivid" : "text-pink-vivid/70"}`}>{dragActive ? "Drop here" : "Upload"}</span>
          </span>
        </button>
        <p className="text-sm font-body text-ink mt-4">Click or drag to upload</p>
        <p className="text-xs font-body text-muted mt-1">{hint}</p>
        <p className="text-sm font-body text-muted mt-2"><span className={previews.length ? "text-pink-vivid font-semibold" : ""}>{previews.length}</span> / {max}</p>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-5">
          {previews.map((media, index) => (
            <div key={media.id || media.url} className={`relative rounded-xl overflow-hidden bg-subtle aspect-square group ${media.isPrimary ? "ring-2 ring-pink-vivid ring-offset-2" : ""}`}>
              {isVideoMedia(media)
                ? <video src={media.url} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                : <Image src={media.url} alt="" fill unoptimized className="object-cover" sizes="200px" />}
              <button type="button" onClick={() => setCover(index)} className={`absolute left-2 top-2 px-2 py-0.5 rounded-full text-2xs font-ui transition-opacity ${media.isPrimary ? "pq-dot font-semibold" : "bg-surface/90 text-ink opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`}>
                {media.isPrimary ? "Cover" : "Set cover"}
              </button>
              <button type="button" onClick={() => remove(index)} aria-label="Remove" className="absolute right-2 top-2 w-6 h-6 rounded-full bg-surface/90 text-ink text-xs inline-flex items-center justify-center hover:bg-surface">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
