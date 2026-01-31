/**
 * Image optimization utilities for Supabase Storage
 *
 * Supabase Storage supports image transformations that:
 * - Automatically serve WebP to supported browsers
 * - Resize images on the fly
 * - Control quality/compression
 *
 * URL format: https://{project}.supabase.co/storage/v1/render/image/public/{bucket}/{path}?width={w}&quality={q}
 */

const SUPABASE_PROJECT_ID = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
  /https:\/\/([^.]+)\.supabase\.co/
)?.[1] || '';

const SUPABASE_STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1`
  : '';

// Standard avatar sizes used across the app (in pixels)
export const AVATAR_SIZES = {
  xs: 24,    // Tiny avatars in lists
  sm: 32,    // Small avatars in compact views
  md: 40,    // Default avatar size
  lg: 48,    // Larger avatars
  xl: 64,    // Profile headers
  '2xl': 80, // Large profile displays
  '3xl': 128, // Full profile page
  '4xl': 160, // Hero sections
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

interface TransformOptions {
  width?: number;
  height?: number;
  quality?: number; // 20-100, default 75
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Check if a URL is a Supabase Storage URL
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('supabase.co/storage/v1/object/public/');
}

/**
 * Transform a Supabase Storage URL to use image optimization
 *
 * Converts: https://xxx.supabase.co/storage/v1/object/public/avatars/...
 * To: https://xxx.supabase.co/storage/v1/render/image/public/avatars/...?width=X&quality=Y
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  options: TransformOptions = {}
): string {
  if (!url) return '';

  // If not a Supabase URL, return as-is (let Next.js handle it)
  if (!isSupabaseStorageUrl(url)) {
    return url;
  }

  const { width, height, quality = 75, resize = 'cover' } = options;

  // Convert object URL to render URL
  // From: /storage/v1/object/public/...
  // To:   /storage/v1/render/image/public/...
  const renderUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  // Build query params
  const params = new URLSearchParams();
  if (width) params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(quality));
  if (resize !== 'cover') params.set('resize', resize);

  return `${renderUrl}?${params.toString()}`;
}

/**
 * Get optimized avatar URL for a specific size
 *
 * Note: We only specify width (not height) to avoid server-side cropping.
 * The CSS object-fit:cover + border-radius handles the circular display.
 * This preserves the original image composition and avoids "zoomed in" faces.
 */
export function getOptimizedAvatarUrl(
  url: string | null | undefined,
  size: AvatarSize | number = 'md'
): string {
  const pixelSize = typeof size === 'number' ? size : AVATAR_SIZES[size];

  // Request 2x size for retina displays
  const requestSize = pixelSize * 2;

  return getOptimizedImageUrl(url, {
    width: requestSize,
    // Don't set height - let the image scale proportionally
    // CSS object-fit:cover will handle the circular crop on the client
    quality: 80,
  });
}

/**
 * Generate srcSet for responsive images
 * Returns srcset string for 1x, 2x, and 3x pixel densities
 */
export function getAvatarSrcSet(
  url: string | null | undefined,
  baseSize: number
): string {
  if (!url || !isSupabaseStorageUrl(url)) {
    return '';
  }

  const sizes = [1, 2, 3]; // 1x, 2x, 3x
  return sizes
    .map(scale => {
      const scaledSize = baseSize * scale;
      const optimizedUrl = getOptimizedImageUrl(url, {
        width: scaledSize,
        // Don't set height - preserve aspect ratio
        quality: scale === 1 ? 80 : 70, // Lower quality for larger sizes
      });
      return `${optimizedUrl} ${scale}x`;
    })
    .join(', ');
}

/**
 * Default avatar URL (optimized)
 */
export const DEFAULT_AVATAR = '/defaultprofile.png';

/**
 * Get avatar URL with fallback
 */
export function getAvatarUrl(
  url: string | null | undefined,
  size: AvatarSize | number = 'md'
): string {
  if (!url) return DEFAULT_AVATAR;
  return getOptimizedAvatarUrl(url, size);
}

/**
 * Placeholder blur data URL for avatars (small purple gradient)
 */
export const AVATAR_BLUR_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiNlMmQ4ZjMiLz48L3N2Zz4=';
