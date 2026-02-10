export interface CommissionSubcategoryConfig {
  value: string;
  label: string;
  description: string;
}

export interface CommissionCategoryConfig {
  id: string;
  name: string;
  description: string;
  subcategories: CommissionSubcategoryConfig[];
}

export const COMMISSION_CATEGORIES: Record<string, CommissionCategoryConfig> = {
  design: {
    id: "design",
    name: "Design",
    description: "Visual identity, branding, and creative direction",
    subcategories: [
      { value: "logo_branding", label: "Logo & Branding", description: "Craft distinctive logos, brand identities, and style guides" },
      { value: "ui_ux", label: "UI/UX Design", description: "Design intuitive, beautiful digital experiences" },
      { value: "social_media", label: "Social & Visual Content", description: "Eye-catching visuals, carousels, and campaign graphics" },
      { value: "presentation", label: "Presentations & Decks", description: "Stunning pitch decks and visual storytelling" },
      { value: "print_collateral", label: "Print & Packaging", description: "Posters, packaging, zines, and tactile design" },
    ],
  },
  illustration: {
    id: "illustration",
    name: "Illustration",
    description: "Hand-crafted artwork, characters, and visual worlds",
    subcategories: [
      { value: "character_design", label: "Character Design", description: "Bring original characters to life with personality and depth" },
      { value: "editorial", label: "Editorial Illustration", description: "Expressive artwork for publications, essays, and stories" },
      { value: "concept_art", label: "Concept Art", description: "Imaginative worlds, environments, and visual development" },
      { value: "cover_art", label: "Cover Art", description: "Striking covers for books, albums, and creative projects" },
      { value: "children_book", label: "Children's Illustration", description: "Warm, whimsical artwork for young readers" },
    ],
  },
  writing: {
    id: "writing",
    name: "Writing & Poetry",
    description: "Stories, verse, essays, and the written word",
    subcategories: [
      { value: "creative_writing", label: "Creative Writing", description: "Short stories, fiction, and narrative prose" },
      { value: "poetry", label: "Poetry & Verse", description: "Original poems, spoken word, and lyrical writing" },
      { value: "scriptwriting", label: "Scriptwriting", description: "Scripts for film, video, podcasts, and performances" },
      { value: "editing", label: "Editing & Sensitivity Reading", description: "Thoughtful edits, developmental feedback, and polish" },
      { value: "ghostwriting", label: "Ghostwriting & Collaboration", description: "Bring your vision to the page with a skilled co-writer" },
    ],
  },
  video: {
    id: "video",
    name: "Video & Film",
    description: "Cinematic storytelling, editing, and visual motion",
    subcategories: [
      { value: "short_form", label: "Short-form & Reels", description: "Captivating short videos with style and rhythm" },
      { value: "long_form", label: "Long-form & Documentary", description: "Narrative films, vlogs, and documentary editing" },
      { value: "motion_graphics", label: "Motion & Animation", description: "Animated titles, explainers, and kinetic art" },
      { value: "color_grading", label: "Color Grading", description: "Set the mood with cinematic color and atmosphere" },
      { value: "music_video", label: "Music Videos", description: "Visual storytelling that elevates the music" },
    ],
  },
  audio_music: {
    id: "audio_music",
    name: "Audio & Music",
    description: "Sound, composition, production, and voice",
    subcategories: [
      { value: "beat_production", label: "Music Production", description: "Original compositions, beats, and instrumentals" },
      { value: "mix_master", label: "Mixing & Mastering", description: "Polished, release-ready sound" },
      { value: "sound_design", label: "Sound Design", description: "Sonic textures, FX, and atmospheric soundscapes" },
      { value: "voiceover", label: "Voice & Narration", description: "Expressive voiceover for stories, podcasts, and more" },
      { value: "songwriting", label: "Songwriting", description: "Original lyrics, melodies, and collaborative songcraft" },
    ],
  },
  crafts: {
    id: "crafts",
    name: "Crafts & Handmade",
    description: "Handcrafted art, custom pieces, and tactile creations",
    subcategories: [
      { value: "custom_portraits", label: "Custom Portraits", description: "Hand-painted or digital portraits made just for you" },
      { value: "calligraphy", label: "Calligraphy & Lettering", description: "Beautiful hand-lettered pieces and typographic art" },
      { value: "textile_fiber", label: "Textile & Fiber Art", description: "Embroidery, weaving, and wearable art" },
      { value: "ceramics", label: "Ceramics & Pottery", description: "Handmade ceramic pieces and sculptural work" },
      { value: "mixed_media", label: "Mixed Media & Collage", description: "Layered, experimental, and multi-material artwork" },
    ],
  },
};

export const COMMISSION_DELIVERY_FILTERS = [
  { label: "Up to 2 days", value: 2 },
  { label: "Up to 5 days", value: 5 },
  { label: "Up to 7 days", value: 7 },
  { label: "Up to 14 days", value: 14 },
  { label: "Up to 30 days", value: 30 },
];

export const COMMISSION_REVISION_FILTERS = [
  { label: "1+ revision", value: 1 },
  { label: "2+ revisions", value: 2 },
  { label: "3+ revisions", value: 3 },
  { label: "5+ revisions", value: 5 },
];

export function getCommissionCategory(categoryId: string): CommissionCategoryConfig | undefined {
  return COMMISSION_CATEGORIES[categoryId];
}

export function getCommissionSubcategoryLabel(categoryId: string, subcategoryValue: string): string {
  const category = getCommissionCategory(categoryId);
  if (!category) return subcategoryValue;
  const subcategory = category.subcategories.find((item) => item.value === subcategoryValue);
  return subcategory?.label || subcategoryValue;
}

export function getAllCommissionCategories(): CommissionCategoryConfig[] {
  return Object.values(COMMISSION_CATEGORIES);
}
