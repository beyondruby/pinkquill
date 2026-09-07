/**
 * Live content events (Phase 5). The database broadcasts count deltas and
 * comment ids on the public channel `content-events:<kind>:<id>` whenever a
 * reaction or comment changes. A surface that has a post/take open
 * subscribes here; feed cards keep poll-on-focus.
 *
 * One realtime channel per content id per tab, reference-counted, so a page
 * and a modal showing the same post share it.
 */

import { supabase } from "@/lib/supabase";
import type { ReactionCounts } from "@/lib/types";
import { type EngagementKind, applyLiveCounts, setEngagementViewer } from "./store";

export interface ContentEvent {
  kind: EngagementKind;
  id: string;
  what: "reaction" | "comment";
  op: "INSERT" | "UPDATE" | "DELETE";
  counts: ReactionCounts;
  comments: number;
  actor_id: string;
  comment_id?: string;
  parent_id?: string | null;
}

type Listener = (event: ContentEvent) => void;

interface Sub {
  channel: ReturnType<typeof supabase.channel>;
  refs: number;
  listeners: Set<Listener>;
}

const subs = new Map<string, Sub>();
const MAX_CHANNELS = 4;

function key(kind: EngagementKind, id: string) {
  return `content-events:${kind}:${id}`;
}

/**
 * Subscribe to live events for one post/take. Returns an unsubscribe.
 * Counts are written to the store automatically; the listener is for
 * comment events (a comments list wants to refetch).
 */
export function subscribeContentEvents(kind: EngagementKind, id: string, listener?: Listener): () => void {
  if (!id) return () => {};
  const topic = key(kind, id);
  let sub = subs.get(topic);
  if (!sub) {
    // Keep the number of open channels small: drop the oldest idle one.
    if (subs.size >= MAX_CHANNELS) {
      for (const [t, s] of subs) {
        if (s.refs === 0) {
          supabase.removeChannel(s.channel);
          subs.delete(t);
          break;
        }
      }
    }
    const listeners = new Set<Listener>();
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "content_change" }, ({ payload }) => {
        const event = payload as ContentEvent;
        if (!event || event.id !== id) return;
        applyLiveCounts(kind, id, event.counts, event.comments);
        for (const fn of Array.from(listeners)) {
          try {
            fn(event);
          } catch (err) {
            console.error("[content-events] listener threw:", err);
          }
        }
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(`[content-events] ${topic}: ${status}`);
        }
      });
    sub = { channel, refs: 0, listeners };
    subs.set(topic, sub);
  }
  sub.refs += 1;
  if (listener) sub.listeners.add(listener);

  return () => {
    const s = subs.get(topic);
    if (!s) return;
    if (listener) s.listeners.delete(listener);
    s.refs -= 1;
    if (s.refs <= 0) {
      supabase.removeChannel(s.channel);
      subs.delete(topic);
    }
  };
}

/** Test helper. */
export function __resetContentEvents(): void {
  for (const s of subs.values()) supabase.removeChannel(s.channel);
  subs.clear();
  setEngagementViewer(null);
}
