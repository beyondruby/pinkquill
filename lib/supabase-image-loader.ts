/**
 * Custom image loader for Next.js that uses Supabase Storage Image Transformations
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
  // For non-Supabase URLs, return as-is (let Next.js handle them)
  if (!src.includes('supabase.co/storage/v1/object/public/')) {
    // For relative URLs or other hosts, just return the src
    // Next.js will handle these through its default optimization
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

  return `${renderUrl}?${params.toString()}`;
}
