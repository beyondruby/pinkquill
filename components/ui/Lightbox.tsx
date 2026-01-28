"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  position: number;
}

interface LightboxProps {
  images: MediaItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function Lightbox({ images, initialIndex, isOpen, onClose }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
  }, [initialIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft") setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    if (e.key === "ArrowRight") setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [isOpen, images.length, onClose]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className={`fixed inset-0 z-[3000] transition-all duration-400 ${
        isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
      }`}
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-xl"
        onClick={onClose}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-6 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
        {/* Counter */}
        {images.length > 1 && (
          <div className="flex items-center">
            <span className="text-white font-ui text-sm px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
              {currentIndex + 1}/{images.length}
            </span>
          </div>
        )}
        {images.length <= 1 && <div />}

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-red-500/80 hover:text-white transition-all duration-300 hover:rotate-90"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="absolute inset-0 flex items-center justify-center p-16">
        {/* Image/Video */}
        <div
          className={`relative transition-transform duration-500 ${isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (currentImage.media_type !== "video") {
              setIsZoomed(!isZoomed);
            }
          }}
        >
          {currentImage.media_type === "video" ? (
            <video
              src={currentImage.media_url}
              className="max-w-[85vw] max-h-[80vh] object-contain rounded-xl shadow-2xl"
              controls
              autoPlay
              playsInline
              preload="auto"
            />
          ) : (
            <Image
              src={currentImage.media_url}
              alt=""
              width={1920}
              height={1080}
              className="max-w-[85vw] max-h-[80vh] object-contain rounded-xl shadow-2xl"
              priority
            />
          )}
        </div>
      </div>

      {/* Bottom Bar - Caption only */}
      {currentImage.caption && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/70 to-transparent">
          <div className="text-center">
            <p className="text-white/90 font-body text-lg italic">
              {currentImage.caption}
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

// Global lightbox state management
export function LightboxProvider({ children }: { children: React.ReactNode }) {
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    images: MediaItem[];
    index: number;
  }>({
    isOpen: false,
    images: [],
    index: 0,
  });

  useEffect(() => {
    const handleOpenLightbox = (e: CustomEvent<{ images: MediaItem[]; index: number }>) => {
      setLightboxState({
        isOpen: true,
        images: e.detail.images,
        index: e.detail.index,
      });
    };

    window.addEventListener("openLightbox", handleOpenLightbox as EventListener);
    return () => window.removeEventListener("openLightbox", handleOpenLightbox as EventListener);
  }, []);

  const closeLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <>
      {children}
      <Lightbox
        images={lightboxState.images}
        initialIndex={lightboxState.index}
        isOpen={lightboxState.isOpen}
        onClose={closeLightbox}
      />
    </>
  );
}
