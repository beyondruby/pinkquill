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
    description: "Visual identity, UI, and brand assets",
    subcategories: [
      { value: "logo_branding", label: "Logo & Branding", description: "Logos, brand kits, and style guides" },
      { value: "ui_ux", label: "UI/UX Design", description: "Web and mobile product design" },
      { value: "social_media", label: "Social Media Design", description: "Campaign visuals, carousels, and ads" },
      { value: "presentation", label: "Presentations", description: "Pitch decks and keynote visuals" },
      { value: "print_collateral", label: "Print Collateral", description: "Flyers, brochures, posters, and packaging" },
    ],
  },
  illustration: {
    id: "illustration",
    name: "Illustration",
    description: "Custom visual storytelling and character art",
    subcategories: [
      { value: "character_design", label: "Character Design", description: "Original characters and concept sheets" },
      { value: "editorial", label: "Editorial Illustration", description: "Illustrations for blogs, books, and magazines" },
      { value: "concept_art", label: "Concept Art", description: "Environment and scene concept development" },
      { value: "cover_art", label: "Cover Art", description: "Book, album, or podcast cover art" },
      { value: "children_book", label: "Children's Book", description: "Illustrations for kids and young readers" },
    ],
  },
  writing: {
    id: "writing",
    name: "Writing",
    description: "Creative and business writing services",
    subcategories: [
      { value: "copywriting", label: "Copywriting", description: "Landing pages, ads, and conversion copy" },
      { value: "blog_articles", label: "Blog & Articles", description: "SEO blog posts and editorial content" },
      { value: "scriptwriting", label: "Scriptwriting", description: "Video, podcast, and narrative scripts" },
      { value: "editing", label: "Editing & Proofreading", description: "Line edits, grammar, and polish" },
      { value: "ghostwriting", label: "Ghostwriting", description: "Books, newsletters, and long-form content" },
    ],
  },
  video: {
    id: "video",
    name: "Video",
    description: "Video production and post-production",
    subcategories: [
      { value: "short_form", label: "Short-form Editing", description: "TikTok, Reels, and Shorts editing" },
      { value: "long_form", label: "Long-form Editing", description: "YouTube and documentary editing" },
      { value: "motion_graphics", label: "Motion Graphics", description: "Animated explainers and title cards" },
      { value: "color_grading", label: "Color Grading", description: "Color correction and cinematic grading" },
      { value: "ugc_ads", label: "UGC Ads", description: "Performance ad videos and hooks" },
    ],
  },
  audio_music: {
    id: "audio_music",
    name: "Audio & Music",
    description: "Production, mixing, mastering, and voice",
    subcategories: [
      { value: "beat_production", label: "Beat Production", description: "Original beats and instrumentals" },
      { value: "mix_master", label: "Mixing & Mastering", description: "Polished, release-ready tracks" },
      { value: "sound_design", label: "Sound Design", description: "FX, sonic branding, and audio assets" },
      { value: "voiceover", label: "Voice Over", description: "Narration for ads, podcasts, and explainers" },
      { value: "podcast_editing", label: "Podcast Editing", description: "Dialogue cleanup and mastering" },
    ],
  },
  development: {
    id: "development",
    name: "Development",
    description: "Build, automate, and optimize digital products",
    subcategories: [
      { value: "landing_pages", label: "Landing Pages", description: "High-converting pages and microsites" },
      { value: "web_app", label: "Web App Features", description: "Feature implementation and bug fixes" },
      { value: "ecommerce", label: "E-commerce Setup", description: "Store setup, checkout, and integrations" },
      { value: "automation", label: "Automation", description: "Workflow automation and scripting" },
      { value: "analytics", label: "Analytics", description: "Tracking setup and dashboards" },
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
