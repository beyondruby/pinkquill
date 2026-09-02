"use client";

import { useFreshMediaUrl } from "@/lib/hooks/useMedia";

interface MessageMediaBodyProps {
  url: string;
  mediaType?: "image" | "video" | string | null;
  onOpenImage?: (url: string) => void;
}

/**
 * Renders a DM image/video attachment. The stored URL may be an expired
 * signed link or a legacy public link into a now-private bucket; the hook
 * re-signs it for the current participant before anything is requested.
 */
export default function MessageMediaBody({ url, mediaType, onOpenImage }: MessageMediaBodyProps) {
  const freshUrl = useFreshMediaUrl(url);

  if (!freshUrl) {
    return <div className="w-[240px] h-[160px] bg-skeleton animate-pulse" aria-hidden="true" />;
  }

  if (mediaType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; next/image cannot cache it
      <img
        src={freshUrl}
        alt="Shared image"
        className="w-full max-h-[300px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
        onClick={() => onOpenImage?.(freshUrl)}
      />
    );
  }

  return (
    <video
      src={freshUrl}
      className="w-full max-h-[300px] rounded-t-xl"
      controls
      preload="metadata"
      playsInline
    />
  );
}
