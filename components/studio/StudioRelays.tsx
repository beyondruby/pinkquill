"use client";

import type { RelayedPost } from "@/lib/types";
import type { RelayedTake } from "@/lib/hooks/useTakes";
import { GalleryFeed } from "@/components/feed/GalleryView";
import { relayToPost, transformPostForCard } from "@/lib/feed-view/transform";
import TakePostCard from "@/components/takes/TakePostCard";
import { Spinner } from "@/components/ui/Loading";

interface StudioRelaysProps {
  username: string;
  displayName: string | null;
  sub: "posts" | "takes";
  onSub: (sub: "posts" | "takes") => void;
  relays: RelayedPost[];
  relaysLoading: boolean;
  relayedTakes: RelayedTake[];
  relayedTakesLoading: boolean;
}

/** What this person passed along: relayed posts on the gallery wall, relayed takes in the takes grid. */
export default function StudioRelays({ username, displayName, sub, onSub, relays, relaysLoading, relayedTakes, relayedTakesLoading }: StudioRelaysProps) {
  const loading = sub === "posts" ? relaysLoading : relayedTakesLoading;
  const empty = sub === "posts" ? relays.length === 0 : relayedTakes.length === 0;
  return (
    <div className="pq-studio-section" role="tabpanel">
      <div className="pq-chip-scroll pq-studio-filters" role="group" aria-label="Kind of relay">
        <button type="button" className="pq-chip" aria-pressed={sub === "posts"} onClick={() => onSub("posts")}>Posts</button>
        <button type="button" className="pq-chip" aria-pressed={sub === "takes"} onClick={() => onSub("takes")}>Takes</button>
      </div>
      {loading ? (
        <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
      ) : empty ? (
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">{sub === "posts" ? "No relayed posts yet" : "No relayed takes yet"}</p>
        </div>
      ) : sub === "posts" ? (
        <GalleryFeed items={relays.map((relay) => { const original = relayToPost(relay); return { original, transformed: transformPostForCard(original) }; })} />
      ) : (
        <div className="takes-grid">
          {relayedTakes.map((take) => (
            <TakePostCard key={take.id} take={take} variant="grid" isRelayed relayedBy={{ username, display_name: displayName }} />
          ))}
        </div>
      )}
    </div>
  );
}
