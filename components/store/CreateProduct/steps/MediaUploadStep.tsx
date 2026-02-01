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
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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

  // Handle file selection
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      setError(null);
      const newPreviews: MediaPreview[] = [];

      Array.from(files).forEach((file) => {
        // Validate file type
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
          setError("Please upload only JPG, PNG, GIF, or WebP images");
          return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          setError("File size must be less than 10MB");
          return;
        }

        // Check if we've reached the limit
        if (mediaPreviews.length + newPreviews.length >= MAX_IMAGES) {
          setError(`Maximum ${MAX_IMAGES} images allowed`);
          return;
        }

        // Create preview URL
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

  // Handle drag and drop
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

  // Remove an image
  const handleRemove = useCallback(
    (index: number) => {
      const removed = mediaPreviews[index];
      URL.revokeObjectURL(removed.url);

      const newPreviews = mediaPreviews.filter((_, i) => i !== index);

      // If we removed the primary, make the first one primary
      if (removed.isPrimary && newPreviews.length > 0) {
        newPreviews[0].isPrimary = true;
      }

      onMediaChange(newPreviews);
    },
    [mediaPreviews, onMediaChange]
  );

  // Set an image as primary
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

  // Handle digital file selection
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
      {/* Product Images Section */}
      <div className="mb-8">
        <h2 className="text-xl font-display font-semibold text-center mb-2 text-ink">
          Upload your product images
        </h2>
        <p className="text-muted text-center mb-6 font-body">
          Drag and drop the images or choose them from your device
        </p>

        {/* Upload Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center py-16 px-6
            border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
            ${dragActive
              ? "border-purple-primary bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg shadow-purple-primary/10"
              : "border-gray-200 hover:border-purple-primary/50 hover:bg-gradient-to-br hover:from-purple-50/30 hover:to-pink-50/30"
            }
            ${mediaPreviews.length >= MAX_IMAGES ? "opacity-50 pointer-events-none" : ""}`}
        >
          {/* Decorative elements */}
          {dragActive && (
            <>
              <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-pink-vivid/40 animate-pulse" />
              <div className="absolute bottom-6 left-6 w-3 h-3 rounded-full bg-purple-primary/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
            </>
          )}

          {/* Upload Icon */}
          <div
            className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-4
              transition-all duration-300 ${dragActive
                ? "bg-gradient-to-br from-purple-primary to-pink-vivid shadow-lg"
                : "bg-gradient-to-br from-gray-100 to-gray-50"
              }`}
          >
            <svg
              className={`w-12 h-12 transition-colors ${
                dragActive ? "text-white" : "text-gray-400"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          <p className={`text-base font-medium transition-colors ${
            dragActive ? "text-purple-primary" : "text-gray-600"
          }`}>
            {dragActive ? "Drop your images here" : "Click or drag to upload"}
          </p>
          <p className="text-sm text-muted mt-1">
            PNG, JPG, GIF or WebP up to 10MB
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

        {/* Upload count hint */}
        <p className="text-xs text-center text-muted mt-3 font-body">
          {mediaPreviews.length} of {MAX_IMAGES} images uploaded
        </p>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-gradient-to-r from-red-50 to-pink-50 border border-red-100 rounded-xl text-red-600 text-sm font-body flex items-center gap-2 justify-center">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* Preview Grid */}
        {mediaPreviews.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-display font-semibold text-center mb-4 text-ink">
              Preview
            </h3>

            <div className="grid grid-cols-4 gap-4">
              {mediaPreviews.map((preview, index) => (
                <div key={preview.url} className="relative group">
                  {/* Image */}
                  <div
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-200
                      shadow-sm hover:shadow-md
                      ${preview.isPrimary
                        ? "border-purple-primary ring-2 ring-purple-primary/20 shadow-lg shadow-purple-primary/10"
                        : "border-gray-200 hover:border-purple-primary/30"
                      }`}
                  >
                    <img
                      src={preview.url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Primary badge */}
                    {preview.isPrimary && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-gradient-to-r from-purple-primary to-pink-vivid
                        text-white text-xs font-medium rounded-full shadow-sm">
                        Main
                      </div>
                    )}

                    {/* Overlay on hover */}
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        flex items-end justify-center pb-3 gap-2"
                    >
                      {/* Set as main button */}
                      {!preview.isPrimary && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPrimary(index);
                          }}
                          className="px-2 py-1 rounded-lg bg-white/90 hover:bg-white text-purple-primary text-xs font-medium
                            transition-colors"
                          title="Set as main"
                        >
                          Set as main
                        </button>
                      )}
                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(index);
                        }}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-red-500
                          transition-colors"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add more placeholder */}
              {mediaPreviews.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200
                    hover:border-purple-primary/50 hover:bg-gradient-to-br hover:from-purple-50/30 hover:to-pink-50/30
                    transition-all duration-200 flex flex-col items-center justify-center gap-2 group"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-gradient-to-br group-hover:from-purple-100 group-hover:to-pink-100
                    flex items-center justify-center transition-colors">
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-purple-primary transition-colors">Add more</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Digital Files Section (for digital products) */}
      {(deliveryType === "digital" || deliveryType === "both") && (
        <div className="mt-8 pt-8 border-t border-gray-100">
          <h2 className="text-xl font-display font-semibold text-center mb-2 text-ink">
            Upload your digital files
          </h2>
          <p className="text-muted text-center mb-6 font-body">
            These are the files buyers will download after purchase
          </p>

          {/* Digital file upload area */}
          <div
            onClick={() => digitalFileInputRef.current?.click()}
            className="flex flex-col items-center justify-center py-10 px-6
              border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer
              hover:border-purple-primary/50 hover:bg-gradient-to-br hover:from-purple-50/30 hover:to-pink-50/30
              transition-all duration-300 group"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50
              group-hover:from-purple-100 group-hover:to-pink-100 flex items-center justify-center mb-4 transition-colors">
              <svg className="w-8 h-8 text-gray-400 group-hover:text-purple-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-600 group-hover:text-purple-primary transition-colors">
              Click to upload digital files
            </p>
            <p className="text-xs text-muted mt-1">ZIP, PDF, MP3, WAV, PSD, etc.</p>

            <input
              ref={digitalFileInputRef}
              type="file"
              multiple
              onChange={(e) => handleDigitalFiles(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Digital files list */}
          {digitalFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              {digitalFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50/50 to-pink-50/50
                    border border-purple-100/50 rounded-xl transition-all hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-primary to-pink-vivid
                      flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-muted">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDigitalFile(index)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
