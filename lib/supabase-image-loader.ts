/**
 * Optional image loader for Supabase Storage Image Transformations.
 *
 * This file is kept for components that explicitly opt into Supabase edge
 * transformations. The global Next.js image config uses the default optimizer
 * so non-Supabase and local images still get normal Next image handling.
 *
 * This loader automatically:
 * - Resizes images to the requested width on Supabase's edge
 * - Converts to WebP/AVIF based on browser support (automatic)
 * - Applies quality optimization
 *
 * URL transformation:
 * From: https://xxx.supabase.co/storage/v1/object/public/bucket/path.jpg
 * To:   https://xxx.supabase.co/storage/v1/render/image/public/bucket/path.jpg?width=X&quality=Y
 */

interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

export default function supabaseImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  // For non-Supabase URLs, return as-is. This helper should only be used
  // explicitly for Supabase storage images.
  if (!src.includes('supabase.co/storage/v1/object/public/')) {
    return src;
  }

  // Convert Supabase object URL to render URL for image transformation
  const renderUrl = src.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  // Build optimization parameters
  const params = new URLSearchParams();
  params.set('width', String(width));
  params.set('quality', String(quality || 75));
  // Use contain mode to preserve full image without cropping
  params.set('resize', 'contain');

  return `${renderUrl}?${params.toString()}`;
}
