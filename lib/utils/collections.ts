import type { Collection } from "@/lib/types";

// Plural nouns per post type for a collection whose works all share one
// type: "9 poems" reads better than "9 works".
const TYPE_PLURALS: Record<string, string> = {
  thought: "thoughts",
  poem: "poems",
  journal: "journal entries",
  essay: "essays",
  blog: "blog posts",
  story: "stories",
  letter: "letters",
  quote: "quotes",
  visual: "images",
  video: "videos",
  audio: "tracks",
};

/** "11 works", "9 poems", "1 image", or "Nothing here yet". */
export function collectionCountLabel(collection: Pick<Collection, "works_count" | "type_counts">): string {
  const n = collection.works_count ?? 0;
  if (n === 0) return "Nothing here yet";
  const types = Object.keys(collection.type_counts ?? {});
  if (types.length === 1 && TYPE_PLURALS[types[0]]) {
    const plural = TYPE_PLURALS[types[0]];
    const noun = n === 1 ? plural.replace(/ies$/, "y").replace(/(entries)$/, "entry").replace(/s$/, "") : plural;
    return `${n} ${noun}`;
  }
  return `${n} ${n === 1 ? "work" : "works"}`;
}

/** Path of a collection on its owner's studio. */
export function collectionPath(username: string, slug: string): string {
  return `/studio/${username}/collections/${slug}`;
}

/** Fired on window after any collection write so open shelves refetch. */
export const COLLECTIONS_CHANGED_EVENT = "pq:collections-changed";
export function notifyCollectionsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(COLLECTIONS_CHANGED_EVENT));
}
