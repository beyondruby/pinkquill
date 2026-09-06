import type { Post, Profile } from "@/lib/types";

/** The kinds a studio's posts can be browsed by. "all" and "blog" are the same set in two forms. */
export type PostKind = "all" | "blog" | "gallery" | "poems" | "journals" | "communities";

export const POST_KINDS: { id: PostKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "blog", label: "Blog" },
  { id: "gallery", label: "Gallery" },
  { id: "poems", label: "Poems" },
  { id: "journals", label: "Journals" },
  { id: "communities", label: "Communities" },
];

export const EMPTY_WORDS: Record<PostKind, string> = {
  all: "No posts yet",
  blog: "No posts yet",
  gallery: "No visual posts yet",
  poems: "No poems yet",
  journals: "No journal entries yet",
  communities: "No community posts yet",
};

export interface StudioWork extends Post {
  isCollaboration?: boolean;
}

/** A studio's own posts plus the ones they collaborated on, newest first, no duplicates. */
export function mergeWorks(posts: Post[], collaborated: Post[]): StudioWork[] {
  const own = new Set(posts.map((p) => p.id));
  return [
    ...posts.map((p) => ({ ...p, isCollaboration: false })),
    ...collaborated.filter((p) => !own.has(p.id)).map((p) => ({ ...p, isCollaboration: true })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** Community posts show only under Communities; everything else hides them. */
export function filterWorks(works: StudioWork[], kind: PostKind): StudioWork[] {
  switch (kind) {
    case "communities":
      return works.filter((p) => !!p.community_id);
    case "gallery":
      return works.filter((p) => !p.community_id && !!p.media && p.media.length > 0);
    case "poems":
      return works.filter((p) => !p.community_id && p.type === "poem");
    case "journals":
      return works.filter((p) => !p.community_id && p.type === "journal");
    case "blog":
    case "all":
    default:
      return works.filter((p) => !p.community_id);
  }
}

/** Pinned posts first, in pin order; the rest untouched. */
export function splitPinned<T extends { id: string }>(works: T[], pinnedIds: string[]): { pinned: T[]; rest: T[] } {
  if (pinnedIds.length === 0) return { pinned: [], rest: works };
  const pinned = works
    .filter((p) => pinnedIds.includes(p.id))
    .sort((a, b) => pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id));
  const rest = works.filter((p) => !pinnedIds.includes(p.id));
  return { pinned, rest };
}

/** Posts loaded for a studio may not carry an author; the studio's owner is the author unless the post says otherwise. */
export function withAuthor(post: StudioWork, profile: Profile): StudioWork {
  if (post.author?.username) return post;
  return {
    ...post,
    author_id: post.author_id || profile.id,
    author: { id: profile.id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, is_verified: profile.is_verified },
  };
}
