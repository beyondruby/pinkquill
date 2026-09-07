"use client";

/**
 * ReactionsSheet — "who reacted" for a post or take (Phase 6). A tab per
 * reaction type with its count, people listed newest first with a follow
 * button. Reads `get_<kind>_reactors`; the Phase 4 read policies decide
 * what the viewer may see.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Sheet from "@/components/ui/Sheet";
import { Spinner } from "@/components/ui/Loading";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useFollow } from "@/lib/hooks/useProfile";
import { actionToast } from "@/lib/utils/toast";
import type { EngagementKind } from "@/lib/engagement/store";
import type { ReactionType, ReactionCounts, FollowStatus } from "@/lib/types";
import { getReactionIcon, REACTION_OPTIONS } from "./ReactionPicker";

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
const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100";

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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return;
    setRows([]);
    setHasMore(false);
    void load(tab, null);
  }, [isOpen, tab, load]);

  useEffect(() => {
    if (!isOpen) setTab("all");
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const tabs: Array<{ key: ReactionType | "all"; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.total },
    ...REACTION_OPTIONS.filter((o) => counts[o.type] > 0).map((o) => ({ key: o.type, label: o.label, count: counts[o.type] })),
  ];

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

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Reactions" ariaLabel="People who reacted">
      {tabs.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-ui text-[0.8rem] whitespace-nowrap transition-colors ${
                tab === t.key ? "bg-purple-primary/10 text-purple-primary" : "bg-subtle text-muted hover:text-ink"
              }`}
            >
              {t.key !== "all" && <span className="w-4 h-4">{getReactionIcon(t.key)}</span>}
              {t.label}
              <span className="tabular-nums opacity-80">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      <ul className="-mx-1">
        {rows.map((r) => {
          const name = r.display_name || r.username;
          const following = r.follow_status === "accepted";
          const requested = r.follow_status === "pending";
          return (
            <li key={r.user_id} className="flex items-center gap-3 px-1 py-2">
              <Link href={`/studio/${r.username}`} onClick={onClose} className="flex items-center gap-3 min-w-0 flex-1">
                <span className="relative flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.avatar_url || DEFAULT_AVATAR} alt="" className="w-10 h-10 rounded-full object-cover" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-surface shadow flex items-center justify-center">
                    <span className="w-3.5 h-3.5">{getReactionIcon(r.reaction_type)}</span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-ui text-[0.9rem] font-medium text-ink truncate">{name}</span>
                  <span className="block font-ui text-[0.75rem] text-muted truncate">@{r.username}</span>
                </span>
              </Link>
              {!r.is_me && (
                <button
                  type="button"
                  onClick={() => void toggleFollow(r)}
                  disabled={busy.has(r.user_id)}
                  aria-pressed={following || requested}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full font-ui text-[0.78rem] font-medium transition-colors disabled:opacity-60 ${
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
      </ul>

      {loading && (
        <div className="flex justify-center py-4">
          <Spinner size="sm" className="text-purple-primary" />
        </div>
      )}
      {!loading && rows.length === 0 && (
        <p className="text-center font-body text-sm text-muted py-6">No reactions yet.</p>
      )}
      {!loading && hasMore && (
        <button
          type="button"
          onClick={() => void load(tab, rows[rows.length - 1]?.created_at ?? null)}
          className="w-full py-2 rounded-full font-ui text-[0.8rem] text-purple-primary hover:bg-purple-primary/5 transition-colors"
        >
          Show more
        </button>
      )}
    </Sheet>
  );
}
