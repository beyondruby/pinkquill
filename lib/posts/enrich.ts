/**
 * The ONE place a raw PostgREST post row becomes a `Post`.
 *
 * Seven hooks used to carry their own copy of this transform with drifting
 * field sets (tag pages lost community/flair/styling, community posts lost
 * hashtags, relays hard-coded user flags…) and five carried their own copy
 * of the "which of these posts did the viewer save/relay/react to"
 * batch (docs/audit/01-findings.md C2). Any new post field is added here
 * once.
 */

import { supabase } from "@/lib/supabase";
import type {
  Post,
  PostCollaborator,
  PostMedia,
  PostMention,
  ReactionCounts,
  ReactionType,
} from "@/lib/types";

// Select fragments for the optional relations. Hooks compose their own
// select but should reuse these so the embed names match `enrichPost`.
export const POST_RELATIONS_SELECT = `
          collaborators:post_collaborators (
            status,
            role,
            user:profiles!post_collaborators_user_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          ),
          mentions:post_mentions (
            user:profiles!post_mentions_user_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          ),
          tags:post_tags (
            tag:tags(name)
          )`;

// Counter columns maintained by triggers (Phase 5) — no correlated counts.
export const POST_COUNTS_SELECT = `
          reactions_count,
          comments_count,
          relays_count,
          reaction_counts`;

export interface UserPostFlags {
  saves: Set<string>;
  relays: Set<string>;
  reactions: Map<string, ReactionType>;
}

export const EMPTY_USER_POST_FLAGS: UserPostFlags = {
  saves: new Set(),
  relays: new Set(),
  reactions: new Map(),
};

/**
 * Which of `postIds` the viewer has saved / relayed / reacted to.
 * Three small indexed queries in parallel; nothing for anonymous viewers.
 * Reactions also seed `lib/engagement/store.ts` through `useReaction`.
 */
export async function fetchUserPostFlags(
  userId: string | null | undefined,
  postIds: string[],
  signal?: AbortSignal
): Promise<UserPostFlags> {
  if (!userId || postIds.length === 0) return EMPTY_USER_POST_FLAGS;

  const withSignal = <T extends { abortSignal: (s: AbortSignal) => T }>(q: T): T =>
    signal ? q.abortSignal(signal) : q;

  const [saves, relays, reactions] = await Promise.all([
    withSignal(supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds)),
    withSignal(supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds)),
    withSignal(
      supabase.from("reactions").select("post_id, reaction_type").eq("user_id", userId).in("post_id", postIds)
    ),
  ]);

  const flags: UserPostFlags = {
    saves: new Set((saves.data || []).map((r: { post_id: string }) => r.post_id)),
    relays: new Set((relays.data || []).map((r: { post_id: string }) => r.post_id)),
    reactions: new Map(),
  };
  for (const r of (reactions.data || []) as { post_id: string; reaction_type: string }[]) {
    if (r.post_id && r.reaction_type) flags.reactions.set(r.post_id, r.reaction_type as ReactionType);
  }
  return flags;
}

type Row = Record<string, unknown>;

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

function aggregate(row: Row, name: string): number {
  const column = row[`${name}_count`];
  if (typeof column === "number") return column;
  const raw = row[name] ?? row[`${name}_agg`];
  if (Array.isArray(raw) && raw[0] && typeof (raw[0] as { count?: unknown }).count === "number") {
    return (raw[0] as { count: number }).count;
  }
  if (typeof raw === "number") return raw;
  return 0;
}

/** `posts.reaction_counts` jsonb → full ReactionCounts (undefined when the row has no column). */
function perTypeCounts(raw: unknown, total: number): ReactionCounts | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const n = (k: string) => (typeof o[k] === "number" ? (o[k] as number) : 0);
  return { admire: n("admire"), snap: n("snap"), ovation: n("ovation"), support: n("support"), inspired: n("inspired"), applaud: n("applaud"), total };
}

/** Raw post row (with whichever embeds the caller selected) → `Post`. */
export function enrichPost(raw: unknown, flags: UserPostFlags = EMPTY_USER_POST_FLAGS): Post {
  const row = raw as Row;
  const id = String(row.id);

  const collaborators: PostCollaborator[] = ((row.collaborators as Row[] | null) || [])
    .filter((c) => c.status === "accepted")
    .map((c) => ({ status: String(c.status), role: (c.role as string | null) ?? null, user: one(c.user as PostCollaborator["user"]) }))
    .filter((c): c is PostCollaborator => !!c.user);

  const mentions: PostMention[] = ((row.mentions as Row[] | null) || [])
    .map((m) => ({ user: one(m.user as PostMention["user"]) }))
    .filter((m): m is PostMention => !!m.user);

  const hashtags: string[] = ((row.tags as Row[] | null) || [])
    .map((t) => {
      const tag = one((t.tag ?? t.tags) as { name?: string } | null);
      return tag?.name;
    })
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  const media = ([...((row.media as PostMedia[] | null) || [])]).sort((a, b) => a.position - b.position);

  return {
    id,
    author_id: row.author_id as string,
    type: row.type as Post["type"],
    title: (row.title as string | null) ?? null,
    content: (row.content as string) ?? "",
    visibility: row.visibility as Post["visibility"],
    status: row.status as Post["status"],
    content_warning: (row.content_warning as string | null) ?? null,
    created_at: row.created_at as string,
    community_id: (row.community_id as string | null) ?? null,
    flair_id: (row.flair_id as string | null) ?? null,
    flair: one(row.flair as Post["flair"]) ?? null,
    styling: (row.styling as Post["styling"]) ?? null,
    post_location: (row.post_location as string | null) ?? null,
    metadata: (row.metadata as Post["metadata"]) ?? null,
    spotify_track: (row.spotify_track as Post["spotify_track"]) ?? null,
    author: one(row.author as Post["author"]) as Post["author"],
    media,
    community: one(row.community as Post["community"]) ?? null,
    comments_count: aggregate(row, "comments"),
    relays_count: aggregate(row, "relays"),
    reactions_count: aggregate(row, "reactions"),
    reaction_counts: perTypeCounts(row.reaction_counts, aggregate(row, "reactions")),
    user_has_saved: flags.saves.has(id),
    user_has_relayed: flags.relays.has(id),
    user_reaction_type: flags.reactions.get(id) ?? null,
    collaborators,
    mentions,
    hashtags,
  };
}
