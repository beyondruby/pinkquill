"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TaggedUser } from "@/components/feed/PostCard/types";

export interface TakeMetadata {
  hashtags: string[];
  collaborators: Array<{ role?: string | null; user: TaggedUser }>;
  mentions: TaggedUser[];
}

const EMPTY: TakeMetadata = { hashtags: [], collaborators: [], mentions: [] };

const METADATA_SELECT =
  "id, tags:take_tags(tag), collaborators:take_collaborators(role, status, user:profiles!take_collaborators_user_id_fkey(id, username, display_name, avatar_url)), mentions:take_mentions(user:profiles!take_mentions_user_id_fkey(id, username, display_name, avatar_url))";

interface MetadataRow {
  tags: { tag: string }[] | null;
  collaborators: { role: string | null; status: string; user: TaggedUser | null }[] | null;
  mentions: { user: TaggedUser | null }[] | null;
}

/** Shapes the embedded rows the page already fetches with the take itself. */
export function takeMetadataFromRow(row: MetadataRow): TakeMetadata {
  return {
    hashtags: (row.tags || []).map((t) => t.tag),
    collaborators: (row.collaborators || [])
      .filter((c): c is typeof c & { user: TaggedUser } => c.status === "accepted" && !!c.user)
      .map((c) => ({ role: c.role, user: c.user })),
    mentions: (row.mentions || []).map((m) => m.user).filter((u): u is TaggedUser => !!u),
  };
}

/**
 * Tags, collaborators and mentions for a take. The modal fetches them in one
 * request (it used to take five); the page passes `initial` from its own row
 * and no request is made. A slow response never leaves a previous take's
 * tags on screen (V-29).
 */
export function useTakeMetadata(takeId: string | undefined, initial?: TakeMetadata | null): TakeMetadata {
  // Keyed by take id so a previous take's tags never show for the next one.
  const [fetched, setFetched] = useState<{ id: string; data: TakeMetadata } | null>(null);

  useEffect(() => {
    if (initial || !takeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("takes").select(METADATA_SELECT).eq("id", takeId).maybeSingle<MetadataRow>();
      if (cancelled || !data) return;
      setFetched({ id: takeId, data: takeMetadataFromRow(data) });
    })();
    return () => {
      cancelled = true;
    };
  }, [takeId, initial]);

  if (initial) return initial;
  return fetched && fetched.id === takeId ? fetched.data : EMPTY;
}
