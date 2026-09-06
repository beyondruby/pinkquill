"use client";

import { useMemo, useState } from "react";
import type { Post, Profile } from "@/lib/types";
import { GalleryFeed } from "@/components/feed/GalleryView";
import { StreamFeed } from "@/components/feed/StreamView";
import type { FeedItem } from "@/components/feed/StreamView";
import { transformPostForCard } from "@/lib/feed-view/transform";
import Button from "@/components/ui/Button";
import PinSheet from "./PinSheet";
import { EMPTY_WORDS, POST_KINDS, filterWorks, mergeWorks, splitPinned, withAuthor, type PostKind } from "./works";

interface StudioWorksProps {
  profile: Profile;
  posts: Post[];
  collaboratedPosts: Post[];
  isOwnProfile: boolean;
  pins: {
    pinnedPostIds: string[];
    canPin: boolean;
    pinPost: (id: string) => Promise<boolean>;
    unpinPost: (id: string) => Promise<boolean>;
  };
}

/**
 * The Posts tab: one row of kind chips, then the work on the shared feed
 * treatments. All and Gallery browse by eye (the gallery wall); Blog, Poems,
 * Journals and Communities read as day-grouped rows. Pinned posts open the
 * All view under their own heading.
 */
export default function StudioWorks({ profile, posts, collaboratedPosts, isOwnProfile, pins }: StudioWorksProps) {
  const [kind, setKind] = useState<PostKind>("all");
  const [pinSheetOpen, setPinSheetOpen] = useState(false);

  const works = useMemo(() => mergeWorks(posts, collaboratedPosts).map((w) => withAuthor(w, profile)), [posts, collaboratedPosts, profile]);
  const filtered = useMemo(() => filterWorks(works, kind), [works, kind]);
  const { pinned, rest } = useMemo(
    () => (kind === "all" ? splitPinned(filtered, pins.pinnedPostIds) : { pinned: [], rest: filtered }),
    [filtered, kind, pins.pinnedPostIds],
  );
  const toItems = (list: Post[]): FeedItem[] => list.map((original) => ({ original, transformed: transformPostForCard(original) }));

  return (
    <div className="pq-studio-section" role="tabpanel">
      <div className="pq-studio-works__bar">
        <div className="pq-chip-scroll" role="group" aria-label="Kind of post">
          {POST_KINDS.map((k) => (
            <button key={k.id} type="button" className="pq-chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>
          ))}
        </div>
        {isOwnProfile && (
          <Button variant="ghost" size="sm" onClick={() => setPinSheetOpen(true)}>
            {pins.pinnedPostIds.length > 0 ? `Pinned (${pins.pinnedPostIds.length})` : "Pin posts"}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="pq-feed-state pq-feed-state--card"><p className="pq-feed-state__title">{EMPTY_WORDS[kind]}</p></div>
      ) : kind === "all" || kind === "gallery" ? (
        <>
          {pinned.length > 0 && (
            <section aria-label="Pinned" className="pq-studio-pinned">
              <h2 className="pq-studio-subhead">Pinned</h2>
              <GalleryFeed items={toItems(pinned)} />
            </section>
          )}
          {rest.length > 0 && (
            <section aria-label={pinned.length > 0 ? "Everything else" : "Posts"}>
              {pinned.length > 0 && <h2 className="pq-studio-subhead">Everything else</h2>}
              <GalleryFeed items={toItems(rest)} />
            </section>
          )}
        </>
      ) : (
        <StreamFeed items={toItems(filtered)} />
      )}

      {isOwnProfile && (
        <PinSheet
          isOpen={pinSheetOpen}
          onClose={() => setPinSheetOpen(false)}
          works={works}
          pinnedIds={pins.pinnedPostIds}
          canPin={pins.canPin}
          onPin={pins.pinPost}
          onUnpin={pins.unpinPost}
        />
      )}
    </div>
  );
}
