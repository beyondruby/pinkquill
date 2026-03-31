/**
 * Shared social link utility functions.
 * Eliminates duplication across StudioProfile and settings/profile page.
 */

export interface SocialLink {
  platform: string;
  url: string;
}

/** Platform metadata used by the settings page. */
export const PLATFORMS: Record<
  string,
  { name: string; icon: string; color: string }
> = {
  twitter: { name: "Twitter / X", icon: "twitter", color: "#1DA1F2" },
  instagram: { name: "Instagram", icon: "instagram", color: "#E4405F" },
  github: { name: "GitHub", icon: "github", color: "#333" },
  linkedin: { name: "LinkedIn", icon: "linkedin", color: "#0A66C2" },
  youtube: { name: "YouTube", icon: "youtube", color: "#FF0000" },
  tiktok: { name: "TikTok", icon: "tiktok", color: "#000" },
  threads: { name: "Threads", icon: "threads", color: "#000" },
  facebook: { name: "Facebook", icon: "facebook", color: "#1877F2" },
  behance: { name: "Behance", icon: "behance", color: "#1769FF" },
  dribbble: { name: "Dribbble", icon: "dribbble", color: "#EA4C89" },
  spotify: { name: "Spotify", icon: "spotify", color: "#1DB954" },
  soundcloud: { name: "SoundCloud", icon: "soundcloud", color: "#FF5500" },
  medium: { name: "Medium", icon: "medium", color: "#000" },
  substack: { name: "Substack", icon: "substack", color: "#FF6719" },
  patreon: { name: "Patreon", icon: "patreon", color: "#FF424D" },
  ko_fi: { name: "Ko-fi", icon: "ko_fi", color: "#29ABE0" },
  website: { name: "Website", icon: "link", color: "#8e44ad" },
};

/**
 * Detect the social platform from a URL string.
 */
export function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("twitter.com") || lower.includes("x.com"))
    return "twitter";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("github.com")) return "github";
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("youtube.com") || lower.includes("youtu.be"))
    return "youtube";
  if (lower.includes("tiktok.com")) return "tiktok";
  if (lower.includes("threads.net")) return "threads";
  if (lower.includes("facebook.com") || lower.includes("fb.com"))
    return "facebook";
  if (lower.includes("behance.net")) return "behance";
  if (lower.includes("dribbble.com")) return "dribbble";
  if (lower.includes("spotify.com") || lower.includes("open.spotify"))
    return "spotify";
  if (lower.includes("soundcloud.com")) return "soundcloud";
  if (lower.includes("medium.com")) return "medium";
  if (lower.includes("substack.com")) return "substack";
  if (lower.includes("patreon.com")) return "patreon";
  if (lower.includes("ko-fi.com")) return "ko_fi";
  return "website";
}

/**
 * Parse social links from the stored `website` profile field.
 * Handles both the new JSON array format and the legacy plain-URL string.
 */
export function parseSocialLinks(website: string | null): SocialLink[] {
  if (!website) return [];
  try {
    const parsed = JSON.parse(website);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Legacy format: plain URL string - detect platform
    if (website.trim()) {
      return [{ platform: detectPlatform(website), url: website }];
    }
  }
  return [];
}

/**
 * Get a full URL for a social link. If the link's `url` is already a full URL,
 * it is returned as-is. Otherwise a platform-specific URL is constructed from
 * the username/handle.
 */
export function getSocialUrl(link: SocialLink): string {
  const url = link.url.trim();
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const username = url.replace(/^@/, "");
  const platformUrls: Record<string, string> = {
    twitter: `https://twitter.com/${username}`,
    instagram: `https://instagram.com/${username}`,
    github: `https://github.com/${username}`,
    linkedin: `https://linkedin.com/in/${username}`,
    youtube: `https://youtube.com/@${username}`,
    tiktok: `https://tiktok.com/@${username}`,
    threads: `https://threads.net/@${username}`,
    facebook: `https://facebook.com/${username}`,
    behance: `https://behance.net/${username}`,
    dribbble: `https://dribbble.com/${username}`,
    spotify: `https://open.spotify.com/user/${username}`,
    soundcloud: `https://soundcloud.com/${username}`,
    medium: `https://medium.com/@${username}`,
    substack: `https://${username}.substack.com`,
    patreon: `https://patreon.com/${username}`,
    ko_fi: `https://ko-fi.com/${username}`,
  };
  return platformUrls[link.platform] || `https://${url}`;
}
