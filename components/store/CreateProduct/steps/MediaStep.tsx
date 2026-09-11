"use client";

import { useCallback, useRef, useState } from "react";
import { ProductDelivery } from "@/lib/types/store";
import { Section } from "@/components/listing/form";
import MediaPicker, { type MediaPreview } from "@/components/listing/MediaPicker";
import Button from "@/components/ui/Button";

interface DigitalFileDraft {
  id?: string;
  file?: File | null;
  name: string;
  type?: string;
  size: number;
  url?: string;
}

interface MediaStepProps {
  deliveryType: ProductDelivery;
  mediaPreviews: MediaPreview[];
  digitalFiles: DigitalFileDraft[];
  onMediaChange: (previews: MediaPreview[]) => void;
  onDigitalFilesChange: (files: DigitalFileDraft[]) => void;
  onError: (message: string | null) => void;
}

export const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Digital downloads: generous for design/audio bundles, but nothing that
// smells like an executable. Bucket policies enforce this server-side too.
const MAX_DIGITAL_FILES = 20;
const MAX_DIGITAL_FILE_BYTES = 500 * 1024 * 1024;
const MAX_DIGITAL_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const FORBIDDEN_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "js", "jse", "wsf", "wsh", "sh", "bash", "zsh", "ksh", "csh", "fish",
  "app", "dmg", "pkg", "deb", "rpm", "apk", "ipa", "jar", "war", "dll", "so", "dylib", "sys", "lnk", "url", "html", "htm", "svg",
]);

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function bytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function MediaStep({ deliveryType, mediaPreviews, digitalFiles, onMediaChange, onDigitalFilesChange, onError }: MediaStepProps) {
  const digitalInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const addDigital = useCallback((files: FileList | null) => {
    if (!files) return;
    onError(null);
    const accepted: DigitalFileDraft[] = [];
    let total = digitalFiles.reduce((sum, f) => sum + (f.size || 0), 0);
    for (const file of Array.from(files)) {
      if (digitalFiles.length + accepted.length >= MAX_DIGITAL_FILES) { onError(`Up to ${MAX_DIGITAL_FILES} files per listing.`); break; }
      const e = ext(file.name);
      if (FORBIDDEN_EXTENSIONS.has(e)) { onError(`.${e} files can't be sold here.`); continue; }
      if (file.size <= 0) { onError(`"${file.name}" is empty.`); continue; }
      if (file.size > MAX_DIGITAL_FILE_BYTES) { onError(`"${file.name}" is ${bytes(file.size)}; the limit is ${bytes(MAX_DIGITAL_FILE_BYTES)} per file.`); continue; }
      if (total + file.size > MAX_DIGITAL_TOTAL_BYTES) { onError(`All files together must stay under ${bytes(MAX_DIGITAL_TOTAL_BYTES)}.`); break; }
      total += file.size;
      accepted.push({ file, name: file.name, size: file.size, type: file.type });
    }
    if (accepted.length) onDigitalFilesChange([...digitalFiles, ...accepted]);
  }, [digitalFiles, onDigitalFilesChange, onError]);

  const onDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === "dragenter" || e.type === "dragover"); };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); addDigital(e.dataTransfer.files); };

  return (
    <>
      <Section title="Photos" description={`Up to ${MAX_IMAGES}. The cover is what people see first.`}>
        <MediaPicker previews={mediaPreviews} onChange={onMediaChange} onError={onError} max={MAX_IMAGES} accept={ACCEPTED_IMAGE_TYPES} maxImageBytes={MAX_IMAGE_BYTES} hint="PNG, JPG, GIF or WebP up to 10 MB" />
      </Section>

      {(deliveryType === "digital" || deliveryType === "both") && (
        <Section title="Files buyers download" description="Delivered right after payment. Add them now or when you publish.">
          <input ref={digitalInputRef} type="file" multiple onChange={(e) => { addDigital(e.target.files); e.target.value = ""; }} className="sr-only" />
          <button type="button" onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop} onClick={() => digitalInputRef.current?.click()}
            className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragActive ? "border-pink-vivid/50 bg-pink-vivid/10" : "border-pink-vivid/25 bg-pink-vivid/5 hover:border-pink-vivid/50"}`}>
            <p className="text-sm font-ui font-medium text-ink">Drop files or tap to choose</p>
            <p className="text-2xs font-body text-muted mt-0.5">Up to {MAX_DIGITAL_FILES} files · {bytes(MAX_DIGITAL_FILE_BYTES)} each · {bytes(MAX_DIGITAL_TOTAL_BYTES)} total</p>
          </button>
          {digitalFiles.length > 0 && (
            <ul className="mt-3 space-y-2">
              {digitalFiles.map((file, index) => (
                <li key={`${file.id || file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-subtle/70 px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg pq-dot flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-ui text-ink truncate">{file.name}</p>
                      <p className="text-2xs font-body text-muted">{bytes(file.size)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onDigitalFilesChange(digitalFiles.filter((_, i) => i !== index))}>Remove</Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </>
  );
}
