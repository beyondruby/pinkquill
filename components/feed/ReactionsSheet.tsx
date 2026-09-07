"use client";

/**
 * ReactionsSheet — everyone who reacted to a post or take. A chip per
 * reaction type with its count filters the list; people are listed newest
 * first with their reaction, when they reacted and a follow button. Reads
 * `get_<kind>_reactors`; the Phase 4 read policies decide what the viewer
 * may see.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useFollow } from "@/lib/hooks/useProfile";
import { actionToast } from "@/lib/utils/toast";
import { getTimeAgoCompact } from "@/lib/utils/time";
import { DEFAULT_AVATAR } from "@/lib/utils/image";
import type { EngagementKind } from "@/lib/engagement/store";
import type { ReactionType, ReactionCounts, FollowStatus } from "@/lib/types";
import { getReactionIcon, getReactionLabel, REACTION_OPTIONS } from "./ReactionPicker";

interface Reactor {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  reaction_type: ReactionType;
  created_at: string;
  follow_status: FollowStatus;
  is_me: boolean;
}

interface ReactionsSheetProps {
  kind: EngagementKind;
  id: string;
  isOpen: boolean;
  onClose: () => void;
  counts: ReactionCounts;
}

const PAGE = 30;

export default function ReactionsSheet({ kind, id, isOpen, onClose, counts }: ReactionsSheetProps) {
  const { user } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const { follow, unfollow } = useFollow();
  const [tab, setTab] = useState<ReactionType | "all">("all");
  const [rows, setRows] = useState<Reactor[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const requestRef = useRef(0);

  const rpc = kind === "post" ? "get_post_reactors" : "get_take_reactors";
  const idArg = kind === "post" ? "p_post_id" : "p_take_id";

  const load = useCallback(
    async (type: ReactionType | "all", before: string | null) => {
      const req = ++requestRef.current;
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc(rpc, {
          [idArg]: id,
          p_type: type === "all" ? null : type,
          p_limit: PAGE,
          p_before: before,
        });
        if (error) throw error;
        if (req !== requestRef.current) return;
        const page = (data || []) as Reactor[];
        setRows((prev) => (before ? [...prev, ...page.filter((r) => !prev.some((p) => p.user_id === r.user_id))] : page));
        setHasMore(page.length === PAGE);
      } catch (err) {
        console.error("[ReactionsSheet] load failed:", err);
        if (req === requestRef.current) actionToast.genericError("load reactions");
      } finally {
        if (req === requestRef.current) setLoading(false);
      }
    },
    [rpc, idArg, id]
  );

  useEffect(() => {
    if (!isOpen) return;
    setRows([]);
    setHasMore(false);
    void load(tab, null);
  }, [isOpen, tab, load]);

  useEffect(() => {
    if (!isOpen) setTab("all");
  }, [isOpen]);

  const total = counts.total;
  const chips: Array<{ key: ReactionType | "all"; label: string; count: number }> = [
    { key: "all", label: "All", count: total },
    ...REACTION_OPTIONS.filter((o) => counts[o.type] > 0).map((o) => ({ key: o.type, label: o.label, count: counts[o.type] })),
  ];
  const showChips = chips.length > 2;

  const toggleFollow = async (r: Reactor) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (busy.has(r.user_id)) return;
    setBusy((b) => new Set(b).add(r.user_id));
    const prev = r.follow_status;
    const optimistic: FollowStatus = prev ? null : "accepted";
    setRows((list) => list.map((x) => (x.user_id === r.user_id ? { ...x, follow_status: optimistic } : x)));
    try {
      if (prev) {
        await unfollow(user.id, r.user_id);
      } else {
        const status = await follow(user.id, r.user_id);
        setRows((list) => list.map((x) => (x.user_id === r.user_id ? { ...x, follow_status: status } : x)));
      }
    } catch (err) {
      console.error("[ReactionsSheet] follow failed:", err);
      setRows((list) => list.map((x) => (x.user_id === r.user_id ? { ...x, follow_status: prev } : x)));
      actionToast.genericError(prev ? "unfollow" : "follow");
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(r.user_id);
        return n;
      });
    }
  };

  const subtitle = total > 0 ? `${total.toLocaleString()} ${total === 1 ? "person" : "people"} reacted` : undefined;
  const initial = loading && rows.length === 0;

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Reactions" subtitle={subtitle} ariaLabel="People who reacted">
      {showChips && (
        <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1 scrollbar-none" role="tablist" aria-label="Filter by reaction">
          {chips.map((c) => {
            const selected = tab === c.key;
            return (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`${c.label}, ${c.count.toLocaleString()}`}
                onClick={() => setTab(c.key)}
                className={`flex items-center gap-1.5 h-9 px-3 rounded-full font-ui text-[0.8rem] whitespace-nowrap border transition-colors ${
                  selected
                    ? "bg-purple-primary/10 border-purple-primary/20 text-purple-primary"
                    : "bg-subtle border-transparent text-muted hover:text-ink"
                }`}
              >
                {c.key !== "all" && <span className="w-5 h-5 flex-shrink-0">{getReactionIcon(c.key)}</span>}
                {(c.key === "all" || selected) && <span className="font-medium">{c.label}</span>}
                <span className="tabular-nums">{c.count.toLocaleString()}</span>
              </button>
            );
          })}
        </div>
      )}

      <ul className="-mx-2" aria-busy={loading}>
        {rows.map((r) => {
          const name = r.display_name || r.username;
          const following = r.follow_status === "accepted";
          const requested = r.follow_status === "pending";
          const reactionLabel = getReactionLabel(r.reaction_type);
          return (
            <li key={r.user_id} className="flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-subtle/70 transition-colors">
              <Link href={`/studio/${r.username}`} onClick={onClose} className="flex items-center gap-3 min-w-0 flex-1 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-primary/40">
                <span className="relative flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.avatar_url || DEFAULT_AVATAR} alt="" className="w-11 h-11 rounded-full object-cover" />
                  <span
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-elevated shadow-md ring-2 ring-elevated flex items-center justify-center"
                    title={reactionLabel}
                  >
                    <span className="w-4 h-4">{getReactionIcon(r.reaction_type)}</span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-ui text-[0.92rem] font-medium text-ink truncate">
                    {r.is_me ? "You" : name}
                  </span>
                  <span className="block font-ui text-[0.75rem] text-muted truncate">
                    {reactionLabel} · {getTimeAgoCompact(r.created_at)}
                  </span>
                </span>
              </Link>
              {!r.is_me && (
                <button
                  type="button"
                  onClick={() => void toggleFollow(r)}
                  disabled={busy.has(r.user_id)}
                  aria-pressed={following || requested}
                  aria-label={`${following ? "Unfollow" : requested ? "Cancel request to follow" : "Follow"} ${name}`}
                  className={`flex-shrink-0 h-8 px-3.5 rounded-full font-ui text-[0.78rem] font-medium transition-colors disabled:opacity-60 ${
                    following || requested
                      ? "bg-subtle text-ink hover:bg-skeleton"
                      : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white hover:opacity-90"
                  }`}
                >
                  {following ? "Following" : requested ? "Requested" : "Follow"}
                </button>
              )}
            </li>
          );
        })}
        {initial &&
          Array.from({ length: Math.min(Math.max(total, 1), 4) }).map((_, i) => (
            <li key={`skeleton-${i}`} className="flex items-center gap-3 px-2 py-2" aria-hidden="true">
              <span className="w-11 h-11 rounded-full bg-skeleton animate-pulse flex-shrink-0" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3 w-1/3 rounded-full bg-skeleton animate-pulse" />
                <span className="block h-2.5 w-1/4 rounded-full bg-skeleton/70 animate-pulse" />
              </span>
              <span className="w-16 h-8 rounded-full bg-skeleton/70 animate-pulse" />
            </li>
          ))}
      </ul>

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="w-10 h-10 text-muted/50" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </span>
          <p className="font-body text-sm text-muted">No reactions yet.</p>
        </div>
      )}
      {!loading && hasMore && (
        <button
          type="button"
          onClick={() => void load(tab, rows[rows.length - 1]?.created_at ?? null)}
          className="w-full h-10 rounded-full font-ui text-[0.8rem] font-medium text-purple-primary hover:bg-purple-primary/5 transition-colors"
        >
          Show more
        </button>
      )}
      {loading && rows.length > 0 && (
        <p className="text-center font-ui text-[0.75rem] text-muted py-2" role="status">
          Loading…
        </p>
      )}
    </Sheet>
  );
}
