/**
 * Image utilities for avatar handling
 */

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

/**
 * Check if a URL is a Supabase Storage URL
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('supabase.co/storage/v1/object/public/');
}

/**
 * Get optimized avatar URL for a specific size
 *
 * Returns the original URL without transformation to preserve the original
 * image composition. CSS object-fit:cover handles the circular display.
 */
export function getOptimizedAvatarUrl(
  url: string | null | undefined,
  size: AvatarSize | number = 'md'
): string {
  // Return original URL to preserve image composition
  // The browser handles display via CSS object-fit
  return url || '';
}

/**
 * Default avatar URL
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
