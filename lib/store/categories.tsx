/**
 * Product Category Configuration System
 *
 * This is the extensible configuration that makes adding new categories trivial.
 * To add a new category:
 * 1. Add a new entry to PRODUCT_CATEGORIES
 * 2. Define its subcategories, fields, and pricing options
 * 3. The UI will automatically render the appropriate form
 */

// ============================================================================
// FIELD TYPE DEFINITIONS
// ============================================================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'year'
  | 'boolean'
  | 'dimensions'
  | 'price';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldValidation {
  min?: number;
  max?: number;
  maxLength?: number;
  pattern?: string;
}

export interface FieldDependency {
  field: string;
  value: string | string[] | boolean;
}

export interface CategoryField {
  key: string;
  label: string;
  type: FieldType;
  group: 'classification' | 'presentation' | 'shipping' | 'details' | 'pricing';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  allowCustom?: boolean;
  dependsOn?: FieldDependency;
  validation?: FieldValidation;
  defaultValue?: string | number | boolean | string[];
  /** Only show for these delivery types */
  deliveryTypes?: ('physical' | 'digital')[];
}

export interface PricingOption {
  types: FieldOption[];
}

export interface CategoryPricingOptions {
  original?: boolean;
  reproduction?: PricingOption;
  digital?: { formats: FieldOption[] };
}

export interface SubcategoryConfig {
  value: string;
  label: string;
  icon?: string;
}

export interface CategoryConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  delivery: ('physical' | 'digital')[];
  subcategories: SubcategoryConfig[];
  fields: CategoryField[];
  pricingOptions: CategoryPricingOptions;
}

// ============================================================================
// SHARED FIELD OPTIONS
// ============================================================================

const SHIPPING_LOCATIONS: FieldOption[] = [
  { value: 'international', label: 'International' },
  { value: 'local', label: 'Local Only' },
  { value: 'north_america', label: 'North America' },
  { value: 'europe', label: 'Europe' },
  { value: 'asia', label: 'Asia' },
  { value: 'custom', label: 'Custom' },
];

const PACKAGING_OPTIONS: FieldOption[] = [
  { value: 'box', label: 'Box' },
  { value: 'wood_crate', label: 'Wood Crate' },
  { value: 'tube', label: 'Tube' },
  { value: 'envelope', label: 'Envelope' },
  { value: 'padded_envelope', label: 'Padded Envelope' },
  { value: 'custom', label: 'Custom' },
];

// Common shipping fields that can be reused
const COMMON_SHIPPING_FIELDS: CategoryField[] = [
  {
    key: 'shipping_services',
    label: 'Shipping Services',
    type: 'text',
    group: 'shipping',
    placeholder: 'e.g., DHL, FedEx, UPS',
    helpText: 'Carriers you use for shipping',
    deliveryTypes: ['physical'],
  },
  {
    key: 'shipping_locations',
    label: 'Shipping Locations',
    type: 'multiselect',
    group: 'shipping',
    options: SHIPPING_LOCATIONS,
    allowCustom: true,
    deliveryTypes: ['physical'],
  },
  {
    key: 'packaging',
    label: 'Packaging',
    type: 'select',
    group: 'shipping',
    options: PACKAGING_OPTIONS,
    allowCustom: true,
    deliveryTypes: ['physical'],
  },
];

// ============================================================================
// CATEGORY CONFIGURATIONS
// ============================================================================

export const PRODUCT_CATEGORIES: Record<string, CategoryConfig> = {
  // ==========================================================================
  // VISUAL ART
  // ==========================================================================
  art: {
    id: 'art',
    name: 'Visual Art',
    icon: 'palette',
    description: 'Paintings, sculptures, photography, and other visual artwork',
    delivery: ['physical', 'digital'],
    subcategories: [
      { value: 'painting', label: 'Painting' },
      { value: 'sculpture', label: 'Sculpture' },
      { value: 'drawing', label: 'Drawing' },
      { value: 'photography', label: 'Photography' },
      { value: 'printmaking', label: 'Printmaking' },
      { value: 'textile_art', label: 'Textile Art' },
      { value: 'digital_art', label: 'Digital Art' },
      { value: 'collages', label: 'Collages' },
      { value: 'mixed_media', label: 'Mixed Media' },
      { value: 'installation', label: 'Installation' },
      { value: 'ceramics', label: 'Ceramics' },
    ],
    fields: [
      // Classification
      {
        key: 'techniques',
        label: 'Technique',
        type: 'multiselect',
        group: 'classification',
        allowCustom: true,
        options: [
          { value: 'acrylic', label: 'Acrylic' },
          { value: 'oil', label: 'Oil' },
          { value: 'watercolor', label: 'Watercolor' },
          { value: 'gouache', label: 'Gouache' },
          { value: 'pastel', label: 'Pastel' },
          { value: 'charcoal', label: 'Charcoal' },
          { value: 'graphite', label: 'Graphite' },
          { value: 'ink', label: 'Ink' },
          { value: 'pencil', label: 'Pencil' },
          { value: 'spray_paint', label: 'Spray Paint' },
          { value: 'airbrush', label: 'Air-brush' },
          { value: 'encaustic', label: 'Encaustic' },
          { value: 'tempera', label: 'Tempera' },
          { value: 'chalk', label: 'Chalk' },
          { value: 'silverpoint', label: 'Silverpoint' },
          { value: 'gel_pen', label: 'Gel Pen' },
          { value: 'marker_pen', label: 'Marker Pen' },
          { value: 'ballpoint_pen', label: 'Ballpoint Pen' },
          { value: 'wax', label: 'Wax' },
          { value: 'enamel', label: 'Enamel' },
          { value: 'lacquer', label: 'Lacquer' },
          { value: 'scratchboard', label: 'Scratchboard' },
          { value: 'stained_glass', label: 'Stained Glass Painting' },
          { value: 'pigments', label: 'Pigments' },
          { value: 'conte', label: 'Conte' },
          { value: 'stencil', label: 'Stencil' },
          { value: 'silver_tip', label: 'Silver Tip' },
        ],
      },
      // Presentation (physical only)
      {
        key: 'display',
        label: 'Display',
        type: 'select',
        group: 'presentation',
        allowCustom: true,
        deliveryTypes: ['physical'],
        options: [
          { value: 'wall', label: 'Wall' },
          { value: 'flat_surface', label: 'Flat Surface' },
          { value: 'pedestal', label: 'Pedestal' },
          { value: 'hanging', label: 'Hanging' },
          { value: 'freestanding', label: 'Freestanding' },
        ],
      },
      {
        key: 'is_framed',
        label: 'Framing',
        type: 'boolean',
        group: 'presentation',
        deliveryTypes: ['physical'],
      },
      {
        key: 'frame_type',
        label: 'Frame Type',
        type: 'select',
        group: 'presentation',
        allowCustom: true,
        deliveryTypes: ['physical'],
        dependsOn: { field: 'is_framed', value: true },
        options: [
          { value: 'wood', label: 'Wood' },
          { value: 'metal', label: 'Metal' },
          { value: 'gilded', label: 'Gilded' },
          { value: 'floating', label: 'Floating Frame' },
          { value: 'shadow_box', label: 'Shadow Box' },
        ],
      },
      // Details - Styles
      {
        key: 'styles',
        label: 'Style',
        type: 'multiselect',
        group: 'details',
        allowCustom: true,
        options: [
          { value: 'abstract', label: 'Abstract' },
          { value: 'impressionism', label: 'Impressionism' },
          { value: 'expressionism', label: 'Expressionism' },
          { value: 'realism', label: 'Realism' },
          { value: 'hyperrealism', label: 'Hyperrealism' },
          { value: 'surrealism', label: 'Surrealism' },
          { value: 'minimalism', label: 'Minimalism' },
          { value: 'pop_art', label: 'Pop Art' },
          { value: 'street_art', label: 'Street Art' },
          { value: 'figurative', label: 'Figurative' },
          { value: 'cubism', label: 'Cubism' },
          { value: 'fauvism', label: 'Fauvism' },
          { value: 'geometric', label: 'Geometric' },
          { value: 'classicism', label: 'Classicism' },
          { value: 'illustration', label: 'Illustration' },
          { value: 'naive_art', label: 'Naive Art' },
          { value: 'land_art', label: 'Land Art' },
          { value: 'oriental_art', label: 'Oriental Art' },
          { value: 'outsider_art', label: 'Outsider Art' },
          { value: 'spiritual_art', label: 'Spiritual Art' },
          { value: 'symbolism', label: 'Symbolism' },
          { value: 'tribal_art', label: 'Tribal Art' },
          { value: 'calligraphy', label: 'Calligraphy' },
          { value: 'conceptual_art', label: 'Conceptual Art' },
        ],
      },
      // Details - Themes
      {
        key: 'themes',
        label: 'Theme',
        type: 'multiselect',
        group: 'details',
        allowCustom: true,
        options: [
          { value: 'abstract', label: 'Abstract' },
          { value: 'portrait', label: 'Portrait' },
          { value: 'landscape', label: 'Landscape' },
          { value: 'seascape', label: 'Seascape' },
          { value: 'nature', label: 'Nature' },
          { value: 'urban', label: 'Urban' },
          { value: 'fantasy', label: 'Fantasy' },
          { value: 'spiritual', label: 'Spirituality' },
          { value: 'animal', label: 'Animal' },
          { value: 'history', label: 'History' },
          { value: 'caricature', label: 'Caricature' },
          { value: 'music', label: 'Music' },
          { value: 'pop_culture', label: 'Pop Culture' },
          { value: 'sport', label: 'Sport' },
          { value: 'technology', label: 'Technology' },
          { value: 'world_culture', label: 'World Culture' },
          { value: 'still_life', label: 'Still Life' },
          { value: 'love_romance', label: 'Love & Romance' },
          { value: 'vehicle', label: 'Vehicle' },
        ],
      },
      // Shipping fields
      ...COMMON_SHIPPING_FIELDS,
    ],
    pricingOptions: {
      original: true,
      reproduction: {
        types: [
          { value: 'art_print', label: 'Art Print' },
          { value: 'canvas', label: 'Canvas' },
          { value: 'metal_print', label: 'Metal Print' },
          { value: 'poster', label: 'Poster' },
          { value: 'framed_print', label: 'Framed Print' },
        ],
      },
      digital: {
        formats: [
          { value: 'high_res_jpg', label: 'High-Resolution JPG' },
          { value: 'png', label: 'PNG with Transparency' },
          { value: 'tiff', label: 'TIFF' },
          { value: 'psd', label: 'Photoshop File (PSD)' },
        ],
      },
    },
  },

  // ==========================================================================
  // MUSIC
  // ==========================================================================
  music: {
    id: 'music',
    name: 'Music',
    icon: 'music',
    description: 'Albums, singles, beats, and audio content',
    delivery: ['physical', 'digital'],
    subcategories: [
      { value: 'album', label: 'Album' },
      { value: 'single', label: 'Single' },
      { value: 'ep', label: 'EP' },
      { value: 'beat', label: 'Beat / Instrumental' },
      { value: 'sample_pack', label: 'Sample Pack' },
      { value: 'sound_kit', label: 'Sound Kit' },
      { value: 'remix', label: 'Remix' },
      { value: 'mixtape', label: 'Mixtape' },
      { value: 'soundtrack', label: 'Soundtrack' },
      { value: 'podcast', label: 'Podcast' },
      { value: 'audiobook', label: 'Audiobook' },
    ],
    fields: [
      {
        key: 'genre',
        label: 'Genre',
        type: 'multiselect',
        group: 'classification',
        allowCustom: true,
        options: [
          { value: 'hip_hop', label: 'Hip-Hop' },
          { value: 'rnb', label: 'R&B' },
          { value: 'electronic', label: 'Electronic' },
          { value: 'house', label: 'House' },
          { value: 'techno', label: 'Techno' },
          { value: 'rock', label: 'Rock' },
          { value: 'indie', label: 'Indie' },
          { value: 'jazz', label: 'Jazz' },
          { value: 'classical', label: 'Classical' },
          { value: 'pop', label: 'Pop' },
          { value: 'ambient', label: 'Ambient' },
          { value: 'folk', label: 'Folk' },
          { value: 'soul', label: 'Soul' },
          { value: 'funk', label: 'Funk' },
          { value: 'reggae', label: 'Reggae' },
          { value: 'country', label: 'Country' },
          { value: 'blues', label: 'Blues' },
          { value: 'metal', label: 'Metal' },
          { value: 'punk', label: 'Punk' },
          { value: 'lo_fi', label: 'Lo-Fi' },
          { value: 'trap', label: 'Trap' },
          { value: 'drill', label: 'Drill' },
          { value: 'afrobeat', label: 'Afrobeat' },
          { value: 'latin', label: 'Latin' },
          { value: 'world', label: 'World' },
          { value: 'experimental', label: 'Experimental' },
        ],
      },
      {
        key: 'mood',
        label: 'Mood / Vibe',
        type: 'multiselect',
        group: 'details',
        allowCustom: true,
        options: [
          { value: 'chill', label: 'Chill' },
          { value: 'energetic', label: 'Energetic' },
          { value: 'dark', label: 'Dark' },
          { value: 'uplifting', label: 'Uplifting' },
          { value: 'melancholic', label: 'Melancholic' },
          { value: 'aggressive', label: 'Aggressive' },
          { value: 'romantic', label: 'Romantic' },
          { value: 'dreamy', label: 'Dreamy' },
          { value: 'nostalgic', label: 'Nostalgic' },
          { value: 'cinematic', label: 'Cinematic' },
        ],
      },
      {
        key: 'bpm',
        label: 'BPM',
        type: 'number',
        group: 'details',
        placeholder: 'e.g., 120',
        validation: { min: 20, max: 300 },
      },
      {
        key: 'key',
        label: 'Key',
        type: 'select',
        group: 'details',
        options: [
          { value: 'C', label: 'C Major' },
          { value: 'Cm', label: 'C Minor' },
          { value: 'C#', label: 'C# / Db Major' },
          { value: 'C#m', label: 'C# / Db Minor' },
          { value: 'D', label: 'D Major' },
          { value: 'Dm', label: 'D Minor' },
          { value: 'D#', label: 'D# / Eb Major' },
          { value: 'D#m', label: 'D# / Eb Minor' },
          { value: 'E', label: 'E Major' },
          { value: 'Em', label: 'E Minor' },
          { value: 'F', label: 'F Major' },
          { value: 'Fm', label: 'F Minor' },
          { value: 'F#', label: 'F# / Gb Major' },
          { value: 'F#m', label: 'F# / Gb Minor' },
          { value: 'G', label: 'G Major' },
          { value: 'Gm', label: 'G Minor' },
          { value: 'G#', label: 'G# / Ab Major' },
          { value: 'G#m', label: 'G# / Ab Minor' },
          { value: 'A', label: 'A Major' },
          { value: 'Am', label: 'A Minor' },
          { value: 'A#', label: 'A# / Bb Major' },
          { value: 'A#m', label: 'A# / Bb Minor' },
          { value: 'B', label: 'B Major' },
          { value: 'Bm', label: 'B Minor' },
        ],
      },
      {
        key: 'track_count',
        label: 'Number of Tracks',
        type: 'number',
        group: 'details',
        validation: { min: 1 },
      },
      {
        key: 'duration',
        label: 'Total Duration',
        type: 'text',
        group: 'details',
        placeholder: 'e.g., 45:30',
      },
      {
        key: 'license_type',
        label: 'License Type',
        type: 'select',
        group: 'pricing',
        options: [
          { value: 'basic', label: 'Basic License' },
          { value: 'premium', label: 'Premium License' },
          { value: 'exclusive', label: 'Exclusive Rights' },
          { value: 'royalty_free', label: 'Royalty Free' },
          { value: 'sync', label: 'Sync License' },
        ],
      },
      ...COMMON_SHIPPING_FIELDS,
    ],
    pricingOptions: {
      original: false,
      reproduction: {
        types: [
          { value: 'vinyl', label: 'Vinyl' },
          { value: 'cd', label: 'CD' },
          { value: 'cassette', label: 'Cassette' },
          { value: 'limited_vinyl', label: 'Limited Edition Vinyl' },
        ],
      },
      digital: {
        formats: [
          { value: 'mp3_320', label: 'MP3 (320kbps)' },
          { value: 'wav', label: 'WAV (Lossless)' },
          { value: 'flac', label: 'FLAC (Lossless)' },
          { value: 'stems', label: 'Stems (Separate Tracks)' },
          { value: 'midi', label: 'MIDI Files' },
        ],
      },
    },
  },

  // ==========================================================================
  // BOOKS & WRITING
  // ==========================================================================
  book: {
    id: 'book',
    name: 'Books & Writing',
    icon: 'book',
    description: 'Poetry collections, novels, zines, and written works',
    delivery: ['physical', 'digital'],
    subcategories: [
      { value: 'poetry_collection', label: 'Poetry Collection' },
      { value: 'novel', label: 'Novel' },
      { value: 'short_stories', label: 'Short Stories' },
      { value: 'essays', label: 'Essays' },
      { value: 'memoir', label: 'Memoir' },
      { value: 'art_book', label: 'Art Book' },
      { value: 'zine', label: 'Zine' },
      { value: 'chapbook', label: 'Chapbook' },
      { value: 'graphic_novel', label: 'Graphic Novel' },
      { value: 'comic', label: 'Comic' },
      { value: 'journal', label: 'Journal / Diary' },
      { value: 'anthology', label: 'Anthology' },
      { value: 'screenplay', label: 'Screenplay' },
      { value: 'playwriting', label: 'Play' },
    ],
    fields: [
      {
        key: 'literary_genre',
        label: 'Genre',
        type: 'multiselect',
        group: 'classification',
        allowCustom: true,
        options: [
          { value: 'poetry', label: 'Poetry' },
          { value: 'fiction', label: 'Fiction' },
          { value: 'literary_fiction', label: 'Literary Fiction' },
          { value: 'memoir', label: 'Memoir' },
          { value: 'essays', label: 'Essays' },
          { value: 'experimental', label: 'Experimental' },
          { value: 'romance', label: 'Romance' },
          { value: 'fantasy', label: 'Fantasy' },
          { value: 'scifi', label: 'Science Fiction' },
          { value: 'horror', label: 'Horror' },
          { value: 'thriller', label: 'Thriller' },
          { value: 'mystery', label: 'Mystery' },
          { value: 'historical', label: 'Historical' },
          { value: 'biography', label: 'Biography' },
          { value: 'self_help', label: 'Self-Help' },
          { value: 'philosophy', label: 'Philosophy' },
          { value: 'satire', label: 'Satire' },
          { value: 'drama', label: 'Drama' },
        ],
      },
      {
        key: 'themes',
        label: 'Themes',
        type: 'multiselect',
        group: 'details',
        allowCustom: true,
        options: [
          { value: 'love', label: 'Love' },
          { value: 'loss', label: 'Loss & Grief' },
          { value: 'identity', label: 'Identity' },
          { value: 'nature', label: 'Nature' },
          { value: 'society', label: 'Society' },
          { value: 'family', label: 'Family' },
          { value: 'coming_of_age', label: 'Coming of Age' },
          { value: 'spirituality', label: 'Spirituality' },
          { value: 'mental_health', label: 'Mental Health' },
          { value: 'politics', label: 'Politics' },
          { value: 'adventure', label: 'Adventure' },
          { value: 'war', label: 'War' },
        ],
      },
      {
        key: 'page_count',
        label: 'Page Count',
        type: 'number',
        group: 'details',
        validation: { min: 1 },
      },
      {
        key: 'word_count',
        label: 'Word Count',
        type: 'number',
        group: 'details',
        placeholder: 'Approximate',
      },
      {
        key: 'isbn',
        label: 'ISBN',
        type: 'text',
        group: 'details',
        placeholder: 'Optional - if published',
      },
      {
        key: 'language',
        label: 'Language',
        type: 'select',
        group: 'details',
        allowCustom: true,
        options: [
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Spanish' },
          { value: 'fr', label: 'French' },
          { value: 'de', label: 'German' },
          { value: 'it', label: 'Italian' },
          { value: 'pt', label: 'Portuguese' },
          { value: 'ar', label: 'Arabic' },
          { value: 'zh', label: 'Chinese' },
          { value: 'ja', label: 'Japanese' },
          { value: 'ko', label: 'Korean' },
          { value: 'ru', label: 'Russian' },
          { value: 'hi', label: 'Hindi' },
        ],
      },
      {
        key: 'binding',
        label: 'Binding',
        type: 'select',
        group: 'presentation',
        deliveryTypes: ['physical'],
        options: [
          { value: 'paperback', label: 'Paperback' },
          { value: 'hardcover', label: 'Hardcover' },
          { value: 'spiral', label: 'Spiral Bound' },
          { value: 'saddle_stitch', label: 'Saddle Stitch' },
          { value: 'perfect_bound', label: 'Perfect Bound' },
          { value: 'case_bound', label: 'Case Bound' },
        ],
      },
      {
        key: 'edition',
        label: 'Edition',
        type: 'text',
        group: 'details',
        placeholder: 'e.g., First Edition, Limited Edition',
      },
      {
        key: 'signed',
        label: 'Signed by Author',
        type: 'boolean',
        group: 'details',
        deliveryTypes: ['physical'],
      },
      {
        key: 'includes_illustrations',
        label: 'Includes Illustrations',
        type: 'boolean',
        group: 'details',
      },
      ...COMMON_SHIPPING_FIELDS,
    ],
    pricingOptions: {
      original: false,
      reproduction: {
        types: [
          { value: 'paperback', label: 'Paperback' },
          { value: 'hardcover', label: 'Hardcover' },
          { value: 'limited_edition', label: 'Limited Edition' },
          { value: 'signed_copy', label: 'Signed Copy' },
        ],
      },
      digital: {
        formats: [
          { value: 'pdf', label: 'PDF' },
          { value: 'epub', label: 'ePub' },
          { value: 'mobi', label: 'Kindle (MOBI)' },
        ],
      },
    },
  },

  // ==========================================================================
  // PRINTS & POSTERS
  // ==========================================================================
  prints: {
    id: 'prints',
    name: 'Prints & Posters',
    icon: 'image',
    description: 'Art prints, posters, and limited edition reproductions',
    delivery: ['physical'],
    subcategories: [
      { value: 'art_print', label: 'Art Print' },
      { value: 'poster', label: 'Poster' },
      { value: 'limited_edition', label: 'Limited Edition Print' },
      { value: 'giclee', label: 'Giclee Print' },
      { value: 'screen_print', label: 'Screen Print' },
      { value: 'risograph', label: 'Risograph' },
      { value: 'linocut', label: 'Linocut' },
      { value: 'woodcut', label: 'Woodcut' },
      { value: 'etching', label: 'Etching' },
      { value: 'lithograph', label: 'Lithograph' },
    ],
    fields: [
      {
        key: 'print_technique',
        label: 'Print Technique',
        type: 'select',
        group: 'classification',
        allowCustom: true,
        options: [
          { value: 'digital', label: 'Digital Print' },
          { value: 'giclee', label: 'Giclee' },
          { value: 'screen', label: 'Screen Print / Serigraph' },
          { value: 'lithograph', label: 'Lithograph' },
          { value: 'risograph', label: 'Risograph' },
          { value: 'letterpress', label: 'Letterpress' },
          { value: 'linocut', label: 'Linocut' },
          { value: 'woodcut', label: 'Woodcut' },
          { value: 'etching', label: 'Etching' },
          { value: 'engraving', label: 'Engraving' },
          { value: 'monotype', label: 'Monotype' },
        ],
      },
      {
        key: 'paper_type',
        label: 'Paper Type',
        type: 'select',
        group: 'details',
        allowCustom: true,
        options: [
          { value: 'matte', label: 'Matte' },
          { value: 'glossy', label: 'Glossy' },
          { value: 'semi_gloss', label: 'Semi-Gloss / Satin' },
          { value: 'cotton_rag', label: 'Cotton Rag' },
          { value: 'archival', label: 'Archival' },
          { value: 'recycled', label: 'Recycled' },
          { value: 'handmade', label: 'Handmade Paper' },
          { value: 'canvas', label: 'Canvas' },
          { value: 'metallic', label: 'Metallic' },
        ],
      },
      {
        key: 'paper_weight',
        label: 'Paper Weight',
        type: 'text',
        group: 'details',
        placeholder: 'e.g., 300gsm',
      },
      {
        key: 'edition_size',
        label: 'Edition Size',
        type: 'number',
        group: 'details',
        placeholder: 'Leave blank for open edition',
        helpText: 'Total number of prints in this edition',
      },
      {
        key: 'edition_number',
        label: 'Available Numbers',
        type: 'text',
        group: 'details',
        placeholder: 'e.g., 1-50, or "Artist Proof"',
      },
      {
        key: 'is_numbered',
        label: 'Numbered',
        type: 'boolean',
        group: 'details',
      },
      {
        key: 'is_signed',
        label: 'Signed by Artist',
        type: 'boolean',
        group: 'details',
      },
      {
        key: 'includes_certificate',
        label: 'Certificate of Authenticity',
        type: 'boolean',
        group: 'details',
      },
      ...COMMON_SHIPPING_FIELDS,
    ],
    pricingOptions: {
      original: false,
      reproduction: {
        types: [
          { value: 'small', label: 'Small' },
          { value: 'medium', label: 'Medium' },
          { value: 'large', label: 'Large' },
          { value: 'custom', label: 'Custom Size' },
        ],
      },
    },
  },

  // ==========================================================================
  // HANDMADE & CRAFTS
  // ==========================================================================
  crafts: {
    id: 'crafts',
    name: 'Handmade & Crafts',
    icon: 'sparkles',
    description: 'Jewelry, ceramics, textiles, and handcrafted items',
    delivery: ['physical'],
    subcategories: [
      { value: 'jewelry', label: 'Jewelry' },
      { value: 'ceramics', label: 'Ceramics & Pottery' },
      { value: 'textiles', label: 'Textiles & Fabric' },
      { value: 'woodwork', label: 'Woodwork' },
      { value: 'metalwork', label: 'Metalwork' },
      { value: 'glasswork', label: 'Glasswork' },
      { value: 'leatherwork', label: 'Leatherwork' },
      { value: 'paper_crafts', label: 'Paper Crafts' },
      { value: 'candles', label: 'Candles & Wax' },
      { value: 'soap', label: 'Soap & Bath' },
      { value: 'embroidery', label: 'Embroidery' },
      { value: 'knitting', label: 'Knitting & Crochet' },
      { value: 'macrame', label: 'Macrame' },
    ],
    fields: [
      {
        key: 'materials',
        label: 'Materials',
        type: 'multiselect',
        group: 'classification',
        allowCustom: true,
        options: [
          { value: 'gold', label: 'Gold' },
          { value: 'silver', label: 'Silver' },
          { value: 'bronze', label: 'Bronze' },
          { value: 'copper', label: 'Copper' },
          { value: 'brass', label: 'Brass' },
          { value: 'steel', label: 'Steel' },
          { value: 'clay', label: 'Clay' },
          { value: 'porcelain', label: 'Porcelain' },
          { value: 'stoneware', label: 'Stoneware' },
          { value: 'wood', label: 'Wood' },
          { value: 'leather', label: 'Leather' },
          { value: 'glass', label: 'Glass' },
          { value: 'fabric', label: 'Fabric' },
          { value: 'cotton', label: 'Cotton' },
          { value: 'wool', label: 'Wool' },
          { value: 'silk', label: 'Silk' },
          { value: 'linen', label: 'Linen' },
          { value: 'gemstones', label: 'Gemstones' },
          { value: 'pearls', label: 'Pearls' },
          { value: 'crystals', label: 'Crystals' },
          { value: 'resin', label: 'Resin' },
          { value: 'paper', label: 'Paper' },
          { value: 'recycled', label: 'Recycled Materials' },
        ],
      },
      {
        key: 'craft_technique',
        label: 'Technique',
        type: 'multiselect',
        group: 'classification',
        allowCustom: true,
        options: [
          { value: 'hand_thrown', label: 'Hand Thrown' },
          { value: 'hand_built', label: 'Hand Built' },
          { value: 'hand_sewn', label: 'Hand Sewn' },
          { value: 'carved', label: 'Carved' },
          { value: 'cast', label: 'Cast' },
          { value: 'woven', label: 'Woven' },
          { value: 'forged', label: 'Forged' },
          { value: 'blown', label: 'Blown' },
          { value: 'soldered', label: 'Soldered' },
          { value: 'enameled', label: 'Enameled' },
          { value: 'glazed', label: 'Glazed' },
          { value: 'dyed', label: 'Dyed' },
          { value: 'printed', label: 'Printed' },
          { value: 'embossed', label: 'Embossed' },
          { value: 'hand_painted', label: 'Hand Painted' },
        ],
      },
      {
        key: 'color',
        label: 'Color',
        type: 'multiselect',
        group: 'details',
        allowCustom: true,
        options: [
          { value: 'black', label: 'Black' },
          { value: 'white', label: 'White' },
          { value: 'gold', label: 'Gold' },
          { value: 'silver', label: 'Silver' },
          { value: 'red', label: 'Red' },
          { value: 'blue', label: 'Blue' },
          { value: 'green', label: 'Green' },
          { value: 'yellow', label: 'Yellow' },
          { value: 'purple', label: 'Purple' },
          { value: 'pink', label: 'Pink' },
          { value: 'orange', label: 'Orange' },
          { value: 'brown', label: 'Brown' },
          { value: 'natural', label: 'Natural' },
          { value: 'multicolor', label: 'Multicolor' },
        ],
      },
      {
        key: 'is_one_of_a_kind',
        label: 'One of a Kind',
        type: 'boolean',
        group: 'details',
        helpText: 'This is a unique piece that cannot be reproduced',
      },
      {
        key: 'made_to_order',
        label: 'Made to Order',
        type: 'boolean',
        group: 'details',
        helpText: 'Item is created after purchase',
      },
      {
        key: 'customizable',
        label: 'Customizable',
        type: 'boolean',
        group: 'details',
        helpText: 'Buyer can request customizations',
      },
      {
        key: 'care_instructions',
        label: 'Care Instructions',
        type: 'textarea',
        group: 'details',
        placeholder: 'How to care for this item...',
      },
      ...COMMON_SHIPPING_FIELDS,
    ],
    pricingOptions: {
      original: true,
      reproduction: {
        types: [
          { value: 'made_to_order', label: 'Made to Order' },
          { value: 'custom', label: 'Custom Order' },
        ],
      },
    },
  },

  // ==========================================================================
  // DIGITAL GOODS
  // ==========================================================================
  digital_goods: {
    id: 'digital_goods',
    name: 'Digital Goods',
    icon: 'download',
    description: 'Templates, fonts, graphics, presets, and digital assets',
    delivery: ['digital'],
    subcategories: [
      { value: 'template', label: 'Template' },
      { value: 'font', label: 'Font / Typeface' },
      { value: 'graphics', label: 'Graphics & Icons' },
      { value: 'preset', label: 'Presets & Filters' },
      { value: 'mockup', label: 'Mockup' },
      { value: '3d_model', label: '3D Model' },
      { value: 'brush', label: 'Brushes' },
      { value: 'texture', label: 'Textures & Patterns' },
      { value: 'ui_kit', label: 'UI Kit' },
      { value: 'illustration_pack', label: 'Illustration Pack' },
      { value: 'social_media', label: 'Social Media Templates' },
      { value: 'presentation', label: 'Presentation Templates' },
      { value: 'stock_photo', label: 'Stock Photos' },
      { value: 'stock_video', label: 'Stock Video' },
      { value: 'animation', label: 'Animation / Motion' },
    ],
    fields: [
      {
        key: 'software',
        label: 'Compatible Software',
        type: 'multiselect',
        group: 'details',
        allowCustom: true,
        options: [
          { value: 'photoshop', label: 'Adobe Photoshop' },
          { value: 'illustrator', label: 'Adobe Illustrator' },
          { value: 'indesign', label: 'Adobe InDesign' },
          { value: 'premiere', label: 'Adobe Premiere' },
          { value: 'after_effects', label: 'Adobe After Effects' },
          { value: 'lightroom', label: 'Adobe Lightroom' },
          { value: 'figma', label: 'Figma' },
          { value: 'sketch', label: 'Sketch' },
          { value: 'xd', label: 'Adobe XD' },
          { value: 'procreate', label: 'Procreate' },
          { value: 'blender', label: 'Blender' },
          { value: 'cinema4d', label: 'Cinema 4D' },
          { value: 'maya', label: 'Maya' },
          { value: '3dsmax', label: '3ds Max' },
          { value: 'canva', label: 'Canva' },
          { value: 'affinity', label: 'Affinity' },
          { value: 'davinci', label: 'DaVinci Resolve' },
          { value: 'final_cut', label: 'Final Cut Pro' },
          { value: 'any', label: 'Any / Universal' },
        ],
      },
      {
        key: 'file_formats',
        label: 'File Formats Included',
        type: 'multiselect',
        group: 'details',
        options: [
          { value: 'psd', label: 'PSD' },
          { value: 'ai', label: 'AI' },
          { value: 'svg', label: 'SVG' },
          { value: 'eps', label: 'EPS' },
          { value: 'png', label: 'PNG' },
          { value: 'jpg', label: 'JPG' },
          { value: 'pdf', label: 'PDF' },
          { value: 'ttf', label: 'TTF' },
          { value: 'otf', label: 'OTF' },
          { value: 'woff', label: 'WOFF / WOFF2' },
          { value: 'fig', label: 'Figma' },
          { value: 'sketch', label: 'Sketch' },
          { value: 'xd', label: 'XD' },
          { value: 'indd', label: 'INDD' },
          { value: 'prproj', label: 'Premiere Project' },
          { value: 'aep', label: 'After Effects Project' },
          { value: 'blend', label: 'Blender' },
          { value: 'obj', label: 'OBJ' },
          { value: 'fbx', label: 'FBX' },
          { value: 'c4d', label: 'C4D' },
          { value: 'lrtemplate', label: 'Lightroom Preset' },
          { value: 'xmp', label: 'XMP' },
          { value: 'brushset', label: 'Brush Set' },
          { value: 'zip', label: 'ZIP Archive' },
        ],
      },
      {
        key: 'items_included',
        label: 'Items Included',
        type: 'number',
        group: 'details',
        placeholder: 'Number of items in pack',
        helpText: 'e.g., "50 icons" or "20 templates"',
      },
      {
        key: 'license_type',
        label: 'License',
        type: 'select',
        group: 'pricing',
        options: [
          { value: 'personal', label: 'Personal Use Only' },
          { value: 'commercial', label: 'Commercial Use' },
          { value: 'extended', label: 'Extended License' },
          { value: 'unlimited', label: 'Unlimited Use' },
        ],
      },
      {
        key: 'documentation',
        label: 'Documentation Included',
        type: 'boolean',
        group: 'details',
      },
      {
        key: 'support',
        label: 'Support Included',
        type: 'boolean',
        group: 'details',
      },
      {
        key: 'updates',
        label: 'Free Updates',
        type: 'boolean',
        group: 'details',
      },
    ],
    pricingOptions: {
      digital: {
        formats: [
          { value: 'standard', label: 'Standard Download' },
          { value: 'extended', label: 'Extended License' },
          { value: 'team', label: 'Team License' },
        ],
      },
    },
  },

  // ==========================================================================
  // PHOTOGRAPHY (Physical prints, but different from art)
  // ==========================================================================
  photography: {
    id: 'photography',
    name: 'Photography',
    icon: 'camera',
    description: 'Photo prints, stock photography, and photographic art',
    delivery: ['physical', 'digital'],
    subcategories: [
      { value: 'fine_art', label: 'Fine Art Photography' },
      { value: 'portrait', label: 'Portrait' },
      { value: 'landscape', label: 'Landscape' },
      { value: 'street', label: 'Street Photography' },
      { value: 'documentary', label: 'Documentary' },
      { value: 'abstract', label: 'Abstract' },
      { value: 'nature', label: 'Nature & Wildlife' },
      { value: 'architecture', label: 'Architecture' },
      { value: 'fashion', label: 'Fashion' },
      { value: 'stock', label: 'Stock Photography' },
    ],
    fields: [
      {
        key: 'photography_style',
        label: 'Style',
        type: 'multiselect',
        group: 'classification',
        allowCustom: true,
        options: [
          { value: 'black_white', label: 'Black & White' },
          { value: 'color', label: 'Color' },
          { value: 'film', label: 'Film' },
          { value: 'digital', label: 'Digital' },
          { value: 'analog', label: 'Analog' },
          { value: 'instant', label: 'Instant / Polaroid' },
          { value: 'long_exposure', label: 'Long Exposure' },
          { value: 'hdr', label: 'HDR' },
          { value: 'infrared', label: 'Infrared' },
          { value: 'drone', label: 'Drone / Aerial' },
          { value: 'underwater', label: 'Underwater' },
          { value: 'macro', label: 'Macro' },
          { value: 'astrophotography', label: 'Astrophotography' },
        ],
      },
      {
        key: 'print_type',
        label: 'Print Type',
        type: 'select',
        group: 'presentation',
        deliveryTypes: ['physical'],
        allowCustom: true,
        options: [
          { value: 'c_print', label: 'C-Print' },
          { value: 'giclee', label: 'Giclee' },
          { value: 'chromogenic', label: 'Chromogenic' },
          { value: 'inkjet', label: 'Inkjet' },
          { value: 'darkroom', label: 'Traditional Darkroom' },
          { value: 'cyanotype', label: 'Cyanotype' },
          { value: 'platinum', label: 'Platinum Print' },
        ],
      },
      {
        key: 'paper_type',
        label: 'Paper',
        type: 'select',
        group: 'presentation',
        deliveryTypes: ['physical'],
        allowCustom: true,
        options: [
          { value: 'glossy', label: 'Glossy' },
          { value: 'matte', label: 'Matte' },
          { value: 'lustre', label: 'Lustre' },
          { value: 'metallic', label: 'Metallic' },
          { value: 'baryta', label: 'Baryta' },
          { value: 'cotton_rag', label: 'Cotton Rag' },
          { value: 'hahnemuhle', label: 'Hahnemuhle' },
        ],
      },
      {
        key: 'edition_size',
        label: 'Edition Size',
        type: 'number',
        group: 'details',
        deliveryTypes: ['physical'],
        placeholder: 'Leave blank for open edition',
      },
      {
        key: 'is_signed',
        label: 'Signed',
        type: 'boolean',
        group: 'details',
        deliveryTypes: ['physical'],
      },
      {
        key: 'includes_certificate',
        label: 'Certificate of Authenticity',
        type: 'boolean',
        group: 'details',
        deliveryTypes: ['physical'],
      },
      {
        key: 'resolution',
        label: 'Resolution',
        type: 'text',
        group: 'details',
        deliveryTypes: ['digital'],
        placeholder: 'e.g., 6000x4000px',
      },
      {
        key: 'license_type',
        label: 'License',
        type: 'select',
        group: 'pricing',
        deliveryTypes: ['digital'],
        options: [
          { value: 'personal', label: 'Personal Use' },
          { value: 'editorial', label: 'Editorial' },
          { value: 'commercial', label: 'Commercial' },
          { value: 'exclusive', label: 'Exclusive Rights' },
        ],
      },
      ...COMMON_SHIPPING_FIELDS,
    ],
    pricingOptions: {
      original: true,
      reproduction: {
        types: [
          { value: 'small', label: 'Small Print' },
          { value: 'medium', label: 'Medium Print' },
          { value: 'large', label: 'Large Print' },
          { value: 'framed', label: 'Framed' },
          { value: 'canvas', label: 'Canvas' },
          { value: 'acrylic', label: 'Acrylic Mount' },
          { value: 'metal', label: 'Metal Print' },
        ],
      },
      digital: {
        formats: [
          { value: 'web', label: 'Web Resolution' },
          { value: 'print', label: 'Print Resolution' },
          { value: 'raw', label: 'RAW File' },
        ],
      },
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get category configuration by ID
 */
export function getCategoryConfig(categoryId: string): CategoryConfig | undefined {
  return PRODUCT_CATEGORIES[categoryId];
}

/**
 * Get all categories that support a specific delivery type
 */
export function getCategoriesByDelivery(delivery: 'physical' | 'digital'): CategoryConfig[] {
  return Object.values(PRODUCT_CATEGORIES).filter(cat => cat.delivery.includes(delivery));
}

/**
 * Get all categories as an array
 */
export function getAllCategories(): CategoryConfig[] {
  return Object.values(PRODUCT_CATEGORIES);
}

/**
 * Get fields for a specific group within a category
 */
export function getFieldsByGroup(
  categoryId: string,
  group: CategoryField['group']
): CategoryField[] {
  const config = getCategoryConfig(categoryId);
  if (!config) return [];
  return config.fields.filter(f => f.group === group);
}

/**
 * Get fields filtered by delivery type
 */
export function getFieldsForDelivery(
  categoryId: string,
  deliveryType: 'physical' | 'digital'
): CategoryField[] {
  const config = getCategoryConfig(categoryId);
  if (!config) return [];

  return config.fields.filter(field => {
    // If field has no delivery type restriction, include it
    if (!field.deliveryTypes) return true;
    // Otherwise, check if it matches the current delivery type
    return field.deliveryTypes.includes(deliveryType);
  });
}

/**
 * Check if a field should be shown based on its dependencies
 */
export function shouldShowField(
  field: CategoryField,
  currentValues: Record<string, unknown>
): boolean {
  if (!field.dependsOn) return true;

  const dependentValue = currentValues[field.dependsOn.field];
  const requiredValue = field.dependsOn.value;

  // Handle boolean comparison
  if (typeof requiredValue === 'boolean') {
    return dependentValue === requiredValue;
  }

  // Handle array of values (OR condition)
  if (Array.isArray(requiredValue)) {
    if (Array.isArray(dependentValue)) {
      return requiredValue.some(v => dependentValue.includes(v));
    }
    return requiredValue.includes(dependentValue as string);
  }

  // Handle single string value
  return dependentValue === requiredValue;
}

/**
 * Get subcategory label by value
 */
export function getSubcategoryLabel(categoryId: string, subcategoryValue: string): string {
  const config = getCategoryConfig(categoryId);
  if (!config) return subcategoryValue;

  const subcategory = config.subcategories.find(s => s.value === subcategoryValue);
  return subcategory?.label || subcategoryValue;
}

/**
 * Get option label by value
 */
export function getOptionLabel(options: FieldOption[], value: string): string {
  const option = options.find(o => o.value === value);
  return option?.label || value;
}

/**
 * Format attribute values for display (handles arrays and single values)
 */
export function formatAttributeValue(
  field: CategoryField,
  value: unknown
): string {
  if (value === undefined || value === null) return '';

  if (Array.isArray(value)) {
    if (field.options) {
      return value.map(v => getOptionLabel(field.options!, v)).join(', ');
    }
    return value.join(', ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (field.options) {
    return getOptionLabel(field.options, String(value));
  }

  return String(value);
}

// ============================================================================
// CATEGORY ICONS
// ============================================================================

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  palette: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
    </svg>
  ),
  music: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  book: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  image: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  download: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  camera: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  ),
};

/**
 * Get icon component for a category
 */
export function getCategoryIcon(iconName: string): React.ReactNode {
  return CATEGORY_ICONS[iconName] || CATEGORY_ICONS.palette;
}
