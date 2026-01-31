"use client";

import Image from "next/image";
import { useState } from "react";
import {
  getOptimizedAvatarUrl,
  getAvatarSrcSet,
  isSupabaseStorageUrl,
  AVATAR_SIZES,
  AVATAR_BLUR_DATA_URL,
  DEFAULT_AVATAR,
  type AvatarSize,
} from "@/lib/utils/image";

interface AvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: AvatarSize | number;
  className?: string;
  priority?: boolean;
  // Additional styling
  ring?: boolean;
  ringColor?: string;
  shadow?: boolean;
}

/**
 * Optimized Avatar component
 *
 * Features:
 * - Automatic image optimization via Supabase transformations
 * - Proper srcSet for retina displays
 * - Lazy loading by default
 * - Graceful fallback to default avatar
 * - Blur placeholder while loading
 */
export default function Avatar({
  src,
  alt,
  size = "md",
  className = "",
  priority = false,
  ring = false,
  ringColor = "border-white",
  shadow = false,
}: AvatarProps) {
  const [error, setError] = useState(false);
  const pixelSize = typeof size === "number" ? size : AVATAR_SIZES[size];

  // Determine the actual image URL to use
  const isSupabaseUrl = src && isSupabaseStorageUrl(src);
  const optimizedSrc = error || !src
    ? DEFAULT_AVATAR
    : isSupabaseUrl
      ? getOptimizedAvatarUrl(src, size)
      : src;

  // Build class names
  const containerClasses = [
    "relative rounded-full overflow-hidden flex-shrink-0",
    ring && `border-2 ${ringColor}`,
    shadow && "shadow-sm",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // For Supabase images, use standard img with srcSet for best performance
  // For other images (including default), use Next.js Image
  if (isSupabaseUrl && !error) {
    const srcSet = getAvatarSrcSet(src, pixelSize);

    return (
      <div
        className={containerClasses}
        style={{ width: pixelSize, height: pixelSize }}
      >
        <img
          src={optimizedSrc}
          srcSet={srcSet || undefined}
          alt={alt}
          width={pixelSize}
          height={pixelSize}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setError(true)}
          className="w-full h-full object-cover"
          style={{ backgroundColor: "#e2d8f3" }} // Fallback color while loading
        />
      </div>
    );
  }

  // For non-Supabase URLs or fallback, use Next.js Image
  return (
    <div
      className={containerClasses}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <Image
        src={optimizedSrc}
        alt={alt}
        width={pixelSize}
        height={pixelSize}
        priority={priority}
        placeholder="blur"
        blurDataURL={AVATAR_BLUR_DATA_URL}
        onError={() => setError(true)}
        className="w-full h-full object-cover"
        sizes={`${pixelSize}px`}
      />
    </div>
  );
}

/**
 * Avatar Group - for displaying multiple overlapping avatars
 */
interface AvatarGroupProps {
  avatars: Array<{ src: string | null | undefined; alt: string }>;
  size?: AvatarSize | number;
  max?: number;
  className?: string;
}

export function AvatarGroup({
  avatars,
  size = "sm",
  max = 3,
  className = "",
}: AvatarGroupProps) {
  const pixelSize = typeof size === "number" ? size : AVATAR_SIZES[size];
  const displayAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className={`flex -space-x-2 ${className}`}>
      {displayAvatars.map((avatar, index) => (
        <div
          key={index}
          className="relative"
          style={{ zIndex: displayAvatars.length - index }}
        >
          <Avatar
            src={avatar.src}
            alt={avatar.alt}
            size={size}
            ring
            ringColor="border-white"
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className="relative flex items-center justify-center rounded-full bg-purple-primary/10 text-purple-primary font-ui text-xs border-2 border-white"
          style={{ width: pixelSize, height: pixelSize, zIndex: 0 }}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
