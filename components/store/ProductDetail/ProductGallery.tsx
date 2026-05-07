"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { ProductMedia } from "@/lib/types/store";

interface ProductGalleryProps {
  media: ProductMedia[];
  title: string;
  variant?: "product" | "service";
}

export default function ProductGallery({
  media,
  title,
  variant = "product",
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const sortedMedia = [...media].sort((a, b) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return a.position - b.position;
  });

  const selectedImage = sortedMedia[selectedIndex];
  const isService = variant === "service";

  const handlePrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : sortedMedia.length - 1));
  }, [sortedMedia.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < sortedMedia.length - 1 ? prev + 1 : 0));
  }, [sortedMedia.length]);

  // Keyboard nav while the fullscreen lightbox is open. Listening on
  // `document` (instead of an outer div with tabIndex) means users don't
  // have to click the wrapper first to activate keyboard control.
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFullscreen, handlePrevious, handleNext]);

  if (sortedMedia.length === 0) {
    return (
      <div
        className={`aspect-square rounded-[28px] flex items-center justify-center border ${
          isService
            ? "bg-gradient-to-br from-orange-50/70 to-pink-50/50 border-orange-100/70"
            : "bg-gradient-to-br from-pink-50 to-orange-50 border-pink-100/50"
        }`}
      >
        <div className={`text-center ${isService ? "text-orange-warm/45" : "text-pink-vivid/40"}`}>
          <svg className="w-20 h-20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm font-body">No images available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4">
        {sortedMedia.length > 1 && (
          <div className="hidden md:flex flex-col gap-3 w-20 flex-shrink-0">
            {sortedMedia.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setSelectedIndex(index)}
                className={`relative w-20 h-20 rounded-2xl overflow-hidden transition-all duration-300 flex-shrink-0 ${
                  index === selectedIndex
                    ? isService
                      ? "ring-2 ring-orange-warm ring-offset-2 shadow-lg shadow-orange-warm/15"
                      : "ring-2 ring-pink-vivid ring-offset-2 shadow-lg shadow-pink-vivid/20"
                    : isService
                    ? "opacity-55 hover:opacity-100 border border-orange-100"
                    : "opacity-55 hover:opacity-100 border border-pink-vivid/10"
                }`}
                aria-label={`View image ${index + 1}`}
                aria-current={index === selectedIndex}
              >
                <Image
                  src={item.media_url}
                  alt={`${title} thumbnail ${index + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <div className="flex-1">
          <div
            className={`relative aspect-square rounded-[28px] overflow-hidden group cursor-pointer border ${
              isService
                ? "bg-canvas border-orange-100/70 shadow-[0_18px_48px_-28px_rgba(255,159,67,0.45)]"
                : "bg-gradient-to-br from-pink-50/40 to-orange-50/40 border-border-light shadow-lg shadow-black/5"
            }`}
            onClick={() => setIsFullscreen(true)}
          >
            {selectedImage && (
              <Image
                src={selectedImage.media_url}
                alt={`${title} - Image ${selectedIndex + 1}`}
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 720px"
                className="object-contain"
              />
            )}

            {sortedMedia.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevious();
                  }}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full backdrop-blur-sm shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 ${
                    isService
                      ? "bg-surface/95 hover:bg-surface border border-orange-100"
                      : "bg-surface/95 hover:bg-surface border border-pink-vivid/10"
                  }`}
                  aria-label="Previous image"
                >
                  <svg
                    className={`w-5 h-5 ${isService ? "text-orange-warm" : "text-pink-vivid"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full backdrop-blur-sm shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 ${
                    isService
                      ? "bg-surface/95 hover:bg-surface border border-orange-100"
                      : "bg-surface/95 hover:bg-surface border border-pink-vivid/10"
                  }`}
                  aria-label="Next image"
                >
                  <svg
                    className={`w-5 h-5 ${isService ? "text-orange-warm" : "text-pink-vivid"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {sortedMedia.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                {sortedMedia.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex(index);
                    }}
                    className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                      index === selectedIndex
                        ? isService
                          ? "bg-orange-warm"
                          : "bg-pink-vivid"
                        : "bg-surface/60 hover:bg-surface"
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {sortedMedia.length > 1 && (
            <div className="flex md:hidden gap-3 mt-4 overflow-x-auto pb-2 scrollbar-hide">
              {sortedMedia.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedIndex(index)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden transition-all duration-200 ${
                    index === selectedIndex
                      ? isService
                        ? "ring-2 ring-orange-warm ring-offset-2"
                        : "ring-2 ring-pink-vivid ring-offset-2"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  aria-label={`View image ${index + 1}`}
                >
                  <Image
                    src={item.media_url}
                    alt={`${title} thumbnail ${index + 1}`}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isFullscreen && selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-surface/10 text-white flex items-center justify-center hover:bg-surface/20 transition-colors z-10"
            aria-label="Close fullscreen"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {sortedMedia.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-surface/10 text-white flex items-center justify-center hover:bg-surface/20 transition-colors"
                aria-label="Previous image"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-surface/10 text-white flex items-center justify-center hover:bg-surface/20 transition-colors"
                aria-label="Next image"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          <Image
            src={selectedImage.media_url}
            alt={`${title} fullscreen ${selectedIndex + 1}`}
            width={1920}
            height={1920}
            sizes="90vw"
            priority
            className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {sortedMedia.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/45 text-white text-sm font-ui">
              {selectedIndex + 1} / {sortedMedia.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
