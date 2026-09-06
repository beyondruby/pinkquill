export type SavedKind = "all" | "posts" | "takes" | "products";

export const SAVED_KINDS: { id: SavedKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "posts", label: "Posts" },
  { id: "takes", label: "Takes" },
  { id: "products", label: "Products" },
];

/** The lede under the title: how much is kept. */
export function keptWord(total: number): string {
  if (total === 0) return "Things you keep for later live here.";
  return `${total} ${total === 1 ? "thing" : "things"} you kept for later.`;
}

/** What an empty kind says, and where it points. */
export function emptyCopy(kind: SavedKind): { title: string; text: string; href: string; cta: string } {
  switch (kind) {
    case "takes":
      return { title: "No saved takes", text: "Tap the bookmark on a take to keep it here.", href: "/takes", cta: "Watch takes" };
    case "products":
      return { title: "No saved products", text: "Tap the bookmark on something in the shop to keep it here.", href: "/shop", cta: "Browse the shop" };
    case "posts":
      return { title: "No saved posts", text: "Tap the bookmark on a post to keep it here.", href: "/", cta: "Back to the feed" };
    default:
      return { title: "Nothing saved yet", text: "Tap the bookmark on a post, a take or a product to keep it here.", href: "/explore", cta: "Explore" };
  }
}
