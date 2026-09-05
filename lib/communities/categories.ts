/**
 * One taxonomy for Communities. The stored value (`communities.topics`) is the
 * full `name`; the directory shows the short `label`; the create flow offers
 * the `genres`. The directory used to keep a 12-entry list and the create flow
 * a 15-entry list (audit UX-06); this is the union, nothing renamed.
 */
export interface CommunityCategory {
  id: string;
  /** Stored in `communities.topics` and matched on read. */
  name: string;
  /** Short label for chips. */
  label: string;
  genres: string[];
}

export const COMMUNITY_CATEGORIES: CommunityCategory[] = [
  { id: "writing", name: "Writing & Literature", label: "Writing", genres: ["Poetry", "Fiction", "Non-Fiction", "Short Stories", "Novels", "Essays", "Screenwriting", "Playwriting", "Journalism", "Memoir", "Fanfiction", "Flash Fiction", "Blogging", "Spoken Word", "Lyrics", "Zines", "Literary Criticism", "Haiku", "Prose Poetry", "Experimental"] },
  { id: "visual_arts", name: "Visual Arts", label: "Visual arts", genres: ["Digital Art", "Traditional Art", "Illustration", "Concept Art", "Character Design", "Graphic Design", "3D Art", "Comics", "Manga", "Animation", "Abstract", "Portraits", "Landscapes", "Surrealism", "Pop Art", "Impressionism", "Minimalism", "Street Art", "Graffiti", "Collage", "Mixed Media", "Printmaking", "Sculpture", "Installation Art"] },
  { id: "performing_arts", name: "Performing Arts", label: "Performing", genres: ["Theater", "Dance", "Ballet", "Contemporary Dance", "Hip-Hop Dance", "Choreography", "Acting", "Improvisation", "Stand-Up Comedy", "Spoken Word", "Opera", "Musical Theater", "Circus Arts", "Performance Art", "Drag", "Puppetry", "Voice Acting", "Motion Capture"] },
  { id: "music", name: "Music & Audio", label: "Music", genres: ["Hip-Hop", "Rock", "Pop", "Electronic", "Jazz", "Classical", "R&B", "Indie", "Folk", "Lo-Fi", "Ambient", "Songwriting", "Covers", "Production", "Beats", "Orchestra", "A Cappella", "Experimental", "World Music", "Soul", "Punk", "Metal", "Blues", "Acoustic", "Vocal", "Instrumental"] },
  { id: "film", name: "Film & Video", label: "Film", genres: ["Short Films", "Documentaries", "Music Videos", "Animation", "Vlogs", "Cinematography", "Editing", "VFX", "Film Analysis", "Horror", "Comedy", "Drama", "Experimental Film", "Stop Motion", "Motion Graphics", "Color Grading", "Sound Design", "Directing", "Screenwriting", "Film Scoring"] },
  { id: "photography", name: "Photography", label: "Photography", genres: ["Portrait", "Landscape", "Street", "Fashion", "Product", "Wildlife", "Architecture", "Fine Art", "Black & White", "Travel", "Food", "Conceptual", "Documentary", "Analog", "Darkroom", "Photo Manipulation", "Macro", "Astrophotography", "Underwater", "Aerial", "Event"] },
  { id: "fashion_design", name: "Fashion & Design", label: "Fashion", genres: ["Fashion Design", "Costume Design", "Textile Art", "Pattern Making", "Sustainable Fashion", "Streetwear", "Haute Couture", "Accessories", "Jewelry Design", "Shoe Design", "Makeup Artistry", "Hair Styling", "Nail Art", "Body Art", "Fashion Illustration", "Styling", "Upcycling"] },
  { id: "crafts", name: "Crafts & Handmade", label: "Crafts", genres: ["Ceramics", "Pottery", "Woodworking", "Metalwork", "Glasswork", "Leathercraft", "Bookbinding", "Paper Art", "Origami", "Embroidery", "Knitting", "Crochet", "Weaving", "Quilting", "Sewing", "Jewelry Making", "Candle Making", "Soap Making", "Resin Art", "Macramé", "Calligraphy", "Lettering"] },
  { id: "digital_creative", name: "Digital Creative", label: "Digital", genres: ["UI/UX Design", "Web Design", "Motion Design", "Brand Design", "Digital Illustration", "3D Modeling", "3D Animation", "Game Art", "NFT Art", "Generative Art", "AI Art", "VR/AR Art", "Interactive Media", "Creative Coding", "Pixel Art", "Icon Design", "Infographics"] },
  { id: "architecture", name: "Architecture & Spaces", label: "Architecture", genres: ["Architecture", "Interior Design", "Landscape Design", "Urban Planning", "Sustainable Design", "Furniture Design", "Exhibition Design", "Set Design", "Lighting Design", "Spatial Design", "Architectural Visualization", "Model Making"] },
  { id: "gaming", name: "Gaming & Interactive", label: "Gaming", genres: ["RPG", "Strategy", "Indie Games", "Retro", "Horror", "Adventure", "Game Dev", "Game Design", "Level Design", "Game Writing", "Game Art", "Esports", "Reviews", "Speedrunning", "Modding", "Tabletop", "Board Games", "Card Games"] },
  { id: "technology", name: "Creative Tech", label: "Creative tech", genres: ["Creative Coding", "Generative Art", "Interactive Installations", "Projection Mapping", "Hardware Hacking", "Arduino", "Raspberry Pi", "Wearable Tech", "Sound Engineering", "Live Visuals", "VJing", "AI Tools", "Open Source", "Web Dev"] },
  { id: "lifestyle", name: "Lifestyle & Wellness", label: "Lifestyle", genres: ["Fashion", "Food", "Travel", "Fitness", "Wellness", "Home Decor", "DIY", "Self-Improvement", "Minimalism", "Journaling", "Bullet Journal", "Plant Care", "Sustainable Living", "Vintage", "Thrifting"] },
  { id: "education", name: "Learning & Critique", label: "Learning", genres: ["Art History", "Music Theory", "Film Studies", "Design Theory", "Writing Craft", "Critique Groups", "Mentorship", "Workshops", "Tutorials", "Book Club", "Portfolio Review", "Career Advice", "Art Business", "Creative Process"] },
  { id: "culture", name: "Culture & Community", label: "Culture", genres: ["Art Movements", "Cultural Heritage", "Folk Art", "Indigenous Art", "Diaspora Art", "Zine Culture", "Fan Art", "Fan Fiction", "Cosplay", "Conventions", "Local Scene", "Collectives", "Collaborations", "Open Calls", "Residencies"] },
];

export const COMMUNITY_THEMES = [
  // Mood
  "Dark", "Light", "Romantic", "Melancholic", "Uplifting", "Intense", "Peaceful", "Mysterious", "Ethereal", "Raw", "Intimate", "Dreamy", "Haunting", "Joyful", "Bittersweet", "Provocative", "Contemplative", "Playful", "Tender", "Fierce",
  // Style
  "Minimalist", "Maximalist", "Surreal", "Abstract", "Realistic", "Vintage", "Retro", "Modern", "Contemporary", "Classic", "Avant-Garde", "Bohemian", "Gothic", "Cyberpunk", "Cottagecore", "Dark Academia", "Kawaii", "Brutalist", "Art Deco", "Baroque",
  // Setting
  "Nature", "Urban", "Cosmic", "Underwater", "Fantasy", "Dystopian", "Utopian", "Domestic", "Industrial", "Sacred", "Liminal", "Nocturnal",
  // Approach
  "Experimental", "Traditional", "Hybrid", "Lo-Fi", "Hi-Fi", "Handmade", "Polished", "Rough", "Layered", "Monochrome", "Vibrant", "Muted", "Textured", "Geometric", "Organic", "Narrative", "Symbolic", "Political", "Personal", "Universal",
];

export const COMMUNITY_PURPOSES = [
  { id: "showcase", name: "Showcase" },
  { id: "workshop", name: "Workshop" },
  { id: "discussion", name: "Discussion" },
  { id: "collaboration", name: "Collaboration" },
  { id: "critique", name: "Critique" },
  { id: "challenge", name: "Challenge" },
  { id: "mentorship", name: "Mentorship" },
  { id: "networking", name: "Networking" },
  { id: "collective", name: "Collective" },
  { id: "archive", name: "Archive" },
];

export function findCategoryById(id: string | null | undefined): CommunityCategory | undefined {
  return COMMUNITY_CATEGORIES.find((c) => c.id === id);
}

/** Which category a community's stored topics belong to (first match). */
export function categoryForTopics(topics: string[] | null | undefined): CommunityCategory | undefined {
  if (!topics?.length) return undefined;
  return COMMUNITY_CATEGORIES.find((c) => topics.includes(c.name));
}

export function formatMemberCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(count);
}

export function memberWord(count: number): string {
  return count === 1 ? "member" : "members";
}
