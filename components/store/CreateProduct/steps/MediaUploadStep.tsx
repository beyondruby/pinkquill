"use client";

import { useRef, useCallback, useState } from "react";
import { ProductDelivery } from "@/lib/types/store";

interface MediaPreview {
  file: File;
  url: string;
  isPrimary: boolean;
}

interface MediaUploadStepProps {
  deliveryType: ProductDelivery;
  mediaPreviews: MediaPreview[];
  digitalFiles: File[];
  onMediaChange: (previews: MediaPreview[]) => void;
  onDigitalFilesChange: (files: File[]) => void;
}

const MAX_IMAGES = 8;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export default function MediaUploadStep({
  deliveryType,
  mediaPreviews,
  digitalFiles,
  onMediaChange,
  onDigitalFilesChange,
}: MediaUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const digitalFileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      setError(null);
      const newPreviews: MediaPreview[] = [];

      Array.from(files).forEach((file) => {
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          setError("Please upload only JPG, PNG, GIF, or WebP images");
          return;
        }

        if (file.size > MAX_FILE_SIZE) {
          setError("File size must be less than 10MB");
          return;
        }

        if (mediaPreviews.length + newPreviews.length >= MAX_IMAGES) {
          setError(`Maximum ${MAX_IMAGES} images allowed`);
          return;
        }

        const url = URL.createObjectURL(file);
        newPreviews.push({
          file,
          url,
          isPrimary: mediaPreviews.length === 0 && newPreviews.length === 0,
        });
      });

      if (newPreviews.length > 0) {
        onMediaChange([...mediaPreviews, ...newPreviews]);
      }
    },
    [mediaPreviews, onMediaChange]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const removed = mediaPreviews[index];
      URL.revokeObjectURL(removed.url);

      const newPreviews = mediaPreviews.filter((_, i) => i !== index);
      if (removed.isPrimary && newPreviews.length > 0) {
        newPreviews[0].isPrimary = true;
      }
      onMediaChange(newPreviews);
    },
    [mediaPreviews, onMediaChange]
  );

  const handleSetPrimary = useCallback(
    (index: number) => {
      const newPreviews = mediaPreviews.map((preview, i) => ({
        ...preview,
        isPrimary: i === index,
      }));
      onMediaChange(newPreviews);
    },
    [mediaPreviews, onMediaChange]
  );

  const handleDigitalFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      onDigitalFilesChange([...digitalFiles, ...Array.from(files)]);
    },
    [digitalFiles, onDigitalFilesChange]
  );

  const removeDigitalFile = useCallback(
    (index: number) => {
      onDigitalFilesChange(digitalFiles.filter((_, i) => i !== index));
    },
    [digitalFiles, onDigitalFilesChange]
  );

  return (
    <div className="py-4">
      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center py-16 px-6
          rounded-3xl cursor-pointer transition-all duration-300
          ${dragActive
            ? "bg-purple-primary/5 ring-2 ring-purple-primary/30"
            : "bg-white/40 ring-1 ring-gray-200/50 hover:ring-purple-primary/20 hover:bg-white/60"
          }
          ${mediaPreviews.length >= MAX_IMAGES ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <div
          className={`
            w-16 h-16 rounded-2xl flex items-center justify-center mb-5
            transition-all duration-300
            ${dragActive
              ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white"
              : "bg-gray-100/80 text-gray-400"
            }
          `}
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>

        <p className={`font-display font-medium mb-1 ${dragActive ? "text-purple-primary" : "text-ink"}`}>
          {dragActive ? "Drop here" : "Click or drag to upload"}
        </p>
        <p className="text-sm text-muted font-body">
          PNG, JPG, GIF or WebP • Max 10MB
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Count */}
      <div className="mt-4 text-center">
        <span className="text-sm text-muted font-body">
          <span className={mediaPreviews.length > 0 ? "text-purple-primary font-medium" : ""}>
            {mediaPreviews.length}
          </span>
          {" / "}{MAX_IMAGES} images
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 text-center">
          <p className="text-sm text-red-500 font-body">{error}</p>
        </div>
      )}

      {/* Preview Grid */}
      {mediaPreviews.length > 0 && (
        <div className="mt-8 grid grid-cols-4 gap-3">
          {mediaPreviews.map((preview, index) => (
            <div key={preview.url} className="relative group">
              <div
                className={`
                  aspect-square rounded-2xl overflow-hidden transition-all duration-300
                  ${preview.isPrimary ? "ring-2 ring-purple-primary ring-offset-2" : ""}
                `}
              >
                <img
                  src={preview.url}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover"
                />

                {preview.isPrimary && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-gradient-to-r from-purple-primary to-pink-vivid text-white text-xs font-ui rounded-full">
                    Main
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!preview.isPrimary && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSetPrimary(index); }}
                      className="px-2 py-1 bg-white/90 rounded-lg text-xs font-ui text-purple-primary"
                    >
                      Set main
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(index); }}
                    className="p-1.5 bg-white/90 rounded-lg text-red-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add more */}
          {mediaPreviews.length < MAX_IMAGES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-2xl bg-white/40 ring-1 ring-gray-200/50
                hover:ring-purple-primary/20 hover:bg-white/60 transition-all
                flex flex-col items-center justify-center gap-1"
            >
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs text-gray-400 font-ui">Add</span>
            </button>
          )}
        </div>
      )}

      {/* Digital Files Section */}
      {(deliveryType === "digital" || deliveryType === "both") && (
        <div className="mt-10 pt-10 border-t border-gray-100/80">
          <h3 className="text-sm font-ui font-medium text-ink mb-4">Digital Files</h3>
          <p className="text-sm text-muted font-body mb-6">
            Files buyers will download after purchase
          </p>

          <div
            onClick={() => digitalFileInputRef.current?.click()}
            className="flex items-center justify-center py-10 px-6 rounded-2xl cursor-pointer
              bg-white/40 ring-1 ring-gray-200/50 hover:ring-purple-primary/20 hover:bg-white/60 transition-all"
          >
            <div className="text-center">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-body text-muted">Click to upload files</p>
            </div>

            <input
              ref={digitalFileInputRef}
              type="file"
              multiple
              onChange={(e) => handleDigitalFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Files list */}
          {digitalFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              {digitalFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-3 bg-white/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-ui text-ink truncate max-w-[180px]">{file.name}</p>
                      <p className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDigitalFile(index)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
