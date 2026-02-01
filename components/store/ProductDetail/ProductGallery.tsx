"use client";

import { useState, useCallback } from "react";
import { ProductMedia } from "@/lib/types/store";

interface ProductGalleryProps {
  media: ProductMedia[];
  title: string;
}

export default function ProductGallery({ media, title }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });

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

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  }, [isZoomed]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      handlePrevious();
    } else if (e.key === "ArrowRight") {
      handleNext();
    } else if (e.key === "Escape") {
      setIsZoomed(false);
    }
  }, [handlePrevious, handleNext]);

  if (sortedMedia.length === 0) {
    return (
      <div className="aspect-square rounded-2xl bg-gray-100 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">No images</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Main Image */}
      <div
        className={`relative aspect-square rounded-2xl overflow-hidden bg-gray-100 group
          ${isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"}`}
        onClick={() => setIsZoomed(!isZoomed)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setIsZoomed(false)}
      >
        {selectedImage && (
          <>
            {/* Normal view */}
            <img
              src={selectedImage.media_url}
              alt={`${title} - Image ${selectedIndex + 1}`}
              className={`w-full h-full object-contain transition-opacity duration-300
                ${isZoomed ? "opacity-0" : "opacity-100"}`}
            />

            {/* Zoomed view */}
            {isZoomed && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `url(${selectedImage.media_url})`,
                  backgroundPosition: `${zoomPosition.x}% ${zoomPosition.y}%`,
                  backgroundSize: "200%",
                  backgroundRepeat: "no-repeat",
                }}
              />
            )}
          </>
        )}

        {/* Navigation arrows */}
        {sortedMedia.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center
                opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              aria-label="Previous image"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full
                bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center
                opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              aria-label="Next image"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Image counter */}
        {sortedMedia.length > 1 && (
          <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full
            bg-black/50 backdrop-blur-sm text-white text-sm">
            {selectedIndex + 1} / {sortedMedia.length}
          </div>
        )}

        {/* Zoom hint */}
        <div className="absolute bottom-4 left-4 px-3 py-1 rounded-full
          bg-black/50 backdrop-blur-sm text-white text-xs
          opacity-0 group-hover:opacity-100 transition-opacity">
          {isZoomed ? "Click to zoom out" : "Click to zoom in"}
        </div>
      </div>

      {/* Thumbnails */}
      {sortedMedia.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {sortedMedia.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setSelectedIndex(index)}
              className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden
                transition-all duration-200
                ${index === selectedIndex
                  ? "ring-2 ring-purple-primary ring-offset-2"
                  : "opacity-70 hover:opacity-100"
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
    </div>
  );
}
