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
      {/* Circular Upload Area */}
      <div className="flex flex-col items-center">
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative w-48 h-48 rounded-full cursor-pointer
            transition-all duration-300 flex items-center justify-center
            ${dragActive
              ? "bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20"
              : "bg-pink-vivid/5 hover:bg-pink-vivid/10"
            }
            ${mediaPreviews.length >= MAX_IMAGES ? "opacity-50 pointer-events-none" : ""}
          `}
        >
          {/* Inner circle */}
          <div
            className={`
              w-36 h-36 rounded-full flex flex-col items-center justify-center
              transition-all duration-300
              ${dragActive
                ? "bg-gradient-to-br from-orange-warm/30 to-pink-vivid/30"
                : "bg-pink-vivid/10"
              }
            `}
          >
            <svg
              className={`w-12 h-12 mb-2 transition-colors ${dragActive ? "text-pink-vivid" : "text-pink-vivid/50"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-sm font-ui font-medium ${dragActive ? "text-pink-vivid" : "text-pink-vivid/60"}`}>
              {dragActive ? "Drop here" : "Upload"}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
        </div>

        {/* Helper text */}
        <p className="text-sm text-muted font-body mt-4">
          Click or drag to upload
        </p>
        <p className="text-xs text-muted/70 font-body mt-1">
          PNG, JPG, GIF or WebP • Max 10MB
        </p>

        {/* Count */}
        <div className="mt-3">
          <span className="text-sm text-muted font-body">
            <span className={mediaPreviews.length > 0 ? "text-pink-vivid font-medium" : ""}>
              {mediaPreviews.length}
            </span>
            {" / "}{MAX_IMAGES} images
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 text-center">
          <p className="text-sm text-red-500 font-body">{error}</p>
        </div>
      )}

      {/* Preview Grid - 8 slots */}
      <div className="mt-8 grid grid-cols-4 gap-3">
        {/* Filled slots */}
        {mediaPreviews.map((preview, index) => (
          <div key={preview.url} className="relative group">
            <div
              className={`
                aspect-square rounded-xl overflow-hidden transition-all duration-300
                border-2
                ${preview.isPrimary ? "border-pink-vivid" : "border-transparent"}
              `}
            >
              <img
                src={preview.url}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {preview.isPrimary && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-gradient-to-r from-orange-warm to-pink-vivid text-white text-xs font-ui rounded-full">
                  Main
                </div>
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!preview.isPrimary && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSetPrimary(index); }}
                    className="px-2 py-1 bg-white/90 rounded-lg text-xs font-ui text-pink-vivid"
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

        {/* Empty slots */}
        {Array.from({ length: MAX_IMAGES - mediaPreviews.length }).map((_, index) => (
          <button
            key={`empty-${index}`}
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-200
              hover:border-pink-vivid/30 hover:bg-pink-vivid/5 transition-all
              flex flex-col items-center justify-center gap-1"
          >
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        ))}
      </div>

      {/* Digital Files Section */}
      {(deliveryType === "digital" || deliveryType === "both") && (
        <div className="mt-12 pt-10 border-t border-gray-100">
          <h3 className="text-sm font-ui font-semibold text-ink mb-2">Digital Files</h3>
          <p className="text-sm text-muted font-body mb-6">
            Files buyers will download after purchase
          </p>

          {/* Digital upload zone */}
          <div
            onClick={() => digitalFileInputRef.current?.click()}
            className="flex items-center justify-center py-10 px-6 rounded-xl cursor-pointer
              border-2 border-dashed border-gray-200 bg-gray-50/50
              hover:border-pink-vivid/30 hover:bg-pink-vivid/5 transition-all"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-pink-vivid/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-pink-vivid/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
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
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-warm to-pink-vivid flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-ui text-ink truncate max-w-[200px]">{file.name}</p>
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
