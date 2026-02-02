"use client";

import { useState, useCallback } from "react";
import { ProductMedia } from "@/lib/types/store";

interface ProductGalleryProps {
  media: ProductMedia[];
  title: string;
  isLiked?: boolean;
  onLike?: () => void;
}

export default function ProductGallery({
  media,
  title,
  isLiked = false,
  onLike
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sort media by position, primary first
  const sortedMedia = [...media].sort((a, b) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return a.position - b.position;
  });

  const selectedImage = sortedMedia[selectedIndex];

  const handlePrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : sortedMedia.length - 1));
  }, [sortedMedia.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < sortedMedia.length - 1 ? prev + 1 : 0));
  }, [sortedMedia.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      handlePrevious();
    } else if (e.key === "ArrowRight") {
      handleNext();
    } else if (e.key === "Escape") {
      setIsFullscreen(false);
    }
  }, [handlePrevious, handleNext]);

  if (sortedMedia.length === 0) {
    return (
      <div className="aspect-square rounded-2xl bg-gradient-to-br from-pink-50 to-orange-50 flex items-center justify-center border border-pink-100/30">
        <div className="text-center text-pink-vivid/40">
          <svg className="w-20 h-20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-body">No images available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4" onKeyDown={handleKeyDown} tabIndex={0}>
        {/* Vertical Thumbnails - LEFT side */}
        {sortedMedia.length > 1 && (
          <div className="hidden md:flex flex-col gap-3 w-20 flex-shrink-0">
            {sortedMedia.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setSelectedIndex(index)}
                className={`relative w-20 h-20 rounded-xl overflow-hidden
                  transition-all duration-300 flex-shrink-0
                  ${index === selectedIndex
                    ? "ring-2 ring-pink-vivid ring-offset-2 shadow-lg shadow-pink-vivid/20"
                    : "opacity-50 hover:opacity-100 border border-pink-vivid/10"
                  }`}
                aria-label={`View image ${index + 1}`}
                aria-current={index === selectedIndex}
              >
                <img
                  src={item.media_url}
                  alt={`${title} thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Main Image */}
        <div className="flex-1">
          <div
            className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-pink-50/50 to-orange-50/50 group
              cursor-pointer shadow-lg shadow-black/5"
            onClick={() => setIsFullscreen(true)}
          >
            {selectedImage && (
              <img
                src={selectedImage.media_url}
                alt={`${title} - Image ${selectedIndex + 1}`}
                className="w-full h-full object-contain"
              />
            )}

            {/* Like button - top right */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLike?.();
              }}
              className={`absolute top-4 right-4 w-12 h-12 rounded-full
                backdrop-blur-sm flex items-center justify-center
                transition-all duration-300 z-10
                ${isLiked
                  ? "bg-pink-vivid text-white shadow-lg shadow-pink-vivid/30"
                  : "bg-white/90 text-muted hover:bg-white hover:text-pink-vivid hover:shadow-lg"
                }`}
            >
              <svg
                className="w-6 h-6"
                fill={isLiked ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>

            {/* Navigation arrows */}
            {sortedMedia.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevious();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                    bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center
                    opacity-0 group-hover:opacity-100 transition-all duration-200
                    hover:bg-white hover:scale-105 border border-pink-vivid/10"
                  aria-label="Previous image"
                >
                  <svg className="w-5 h-5 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNext();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                    bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center
                    opacity-0 group-hover:opacity-100 transition-all duration-200
                    hover:bg-white hover:scale-105 border border-pink-vivid/10"
                  aria-label="Next image"
                >
                  <svg className="w-5 h-5 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            {/* Dot indicators - bottom center */}
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
                        ? "bg-pink-vivid"
                        : "bg-white/60 hover:bg-white"
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Mobile thumbnails - horizontal below image */}
          {sortedMedia.length > 1 && (
            <div className="flex md:hidden gap-3 mt-4 overflow-x-auto pb-2 scrollbar-hide">
              {sortedMedia.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedIndex(index)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden
                    transition-all duration-200
                    ${index === selectedIndex
                      ? "ring-2 ring-pink-vivid ring-offset-2"
                      : "opacity-60 hover:opacity-100"
                    }`}
                  aria-label={`View image ${index + 1}`}
                >
                  <img
                    src={item.media_url}
                    alt={`${title} thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10
              text-white flex items-center justify-center
              hover:bg-white/20 transition-colors z-10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Navigation */}
          {sortedMedia.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full
                  bg-white/10 text-white flex items-center justify-center
                  hover:bg-white/20 transition-colors"
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
                className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full
                  bg-white/10 text-white flex items-center justify-center
                  hover:bg-white/20 transition-colors"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Image */}
          <img
            src={selectedImage.media_url}
            alt={title}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full
            bg-white/10 text-white text-sm font-ui">
            {selectedIndex + 1} / {sortedMedia.length}
          </div>
        </div>
      )}
    </>
  );
}
