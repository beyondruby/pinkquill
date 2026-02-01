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
        <h2 className="text-xl font-semibold text-center mb-2">
          Upload your product images
        </h2>
        <p className="text-muted text-center mb-6">
          Drag and drop the images or choose them from your device
        </p>

        {/* Upload Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center py-12 px-6
            border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200
            ${dragActive
              ? "border-purple-primary bg-purple-50"
              : "border-gray-300 hover:border-purple-primary/50 hover:bg-gray-50"
            }
            ${mediaPreviews.length >= MAX_IMAGES ? "opacity-50 pointer-events-none" : ""}`}
        >
          {/* Upload Icon */}
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center mb-4
              transition-colors ${dragActive ? "bg-purple-100" : "bg-gray-100"}`}
          >
            <svg
              className={`w-10 h-10 transition-colors ${
                dragActive ? "text-purple-primary" : "text-gray-400"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </div>

          <p className="text-sm text-muted">
            {dragActive ? "Drop images here" : "Click or drag to upload"}
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

        {/* Format hint */}
        <p className="text-xs text-center text-muted mt-3">
          *The images should be in PNG or JPEG formats
        </p>

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-500 text-center mt-3">{error}</p>
        )}

        {/* Preview Grid */}
        {mediaPreviews.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-center mb-4">Preview</h3>

            <div className="grid grid-cols-4 gap-3">
              {mediaPreviews.map((preview, index) => (
                <div key={preview.url} className="relative group">
                  {/* Image */}
                  <div
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all
                      ${preview.isPrimary
                        ? "border-purple-primary ring-2 ring-purple-primary/20"
                        : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <img
                      src={preview.url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Overlay on hover */}
                    <div
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100
                        transition-opacity flex items-center justify-center gap-2"
                    >
                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(index);
                        }}
                        className="p-2 rounded-full bg-white/90 hover:bg-white text-red-500
                          transition-colors"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Label */}
                  <button
                    onClick={() => handleSetPrimary(index)}
                    className={`mt-2 text-xs text-center w-full transition-colors
                      ${preview.isPrimary
                        ? "text-purple-primary font-medium"
                        : "text-muted hover:text-purple-primary cursor-pointer"
                      }`}
                  >
                    {preview.isPrimary ? "Main photo" : "Set as a main photo"}
                  </button>
                </div>
              ))}

              {/* Add more placeholder */}
              {mediaPreviews.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-300
                    hover:border-purple-primary/50 transition-colors flex items-center justify-center"
                >
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Digital Files Section (for digital products) */}
      {(deliveryType === "digital" || deliveryType === "both") && (
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-xl font-semibold text-center mb-2">
            Upload your digital files
          </h2>
          <p className="text-muted text-center mb-6">
            These are the files buyers will download after purchase
          </p>

          {/* Digital file upload area */}
          <div
            onClick={() => digitalFileInputRef.current?.click()}
            className="flex flex-col items-center justify-center py-8 px-6
              border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer
              hover:border-purple-primary/50 hover:bg-gray-50 transition-all"
          >
            <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-muted">Click to upload digital files</p>
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
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-muted">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDigitalFile(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
