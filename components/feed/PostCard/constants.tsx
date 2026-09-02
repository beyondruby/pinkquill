// Journal metadata helpers shared by PostCard sub-components.
// Post-type naming/iconography lives in lib/feed-view/post-type-theme.ts and
// components/feed/PostTypeIcon.tsx — do not add per-type style maps here.

// Weather icons for journal metadata
export const weatherIconsSmall: Record<string, string> = {
  sunny: "sun",
  "partly-cloudy": "cloud-sun",
  cloudy: "cloud",
  rainy: "cloud-rain",
  stormy: "cloud-bolt",
  snowy: "snowflake",
  foggy: "smog",
  windy: "wind",
};

// Mood indicators for journal entries
export const moodIndicators: Record<string, string> = {
  reflective: "mirror",
  joyful: "face-smile",
  melancholic: "moon",
  peaceful: "dove",
  anxious: "face-worried",
  grateful: "hands-praying",
  creative: "sparkles",
  nostalgic: "camera",
  hopeful: "star",
  contemplative: "thought-bubble",
};
