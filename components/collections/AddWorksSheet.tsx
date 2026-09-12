"use client";

import { useMemo, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Portal from "@/components/ui/Portal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOwnWorks, useCollectionMutations } from "@/lib/hooks/useCollections";
import { notifyCollectionsChanged } from "@/lib/utils/collections";
import { showToast } from "@/lib/utils/toast";
import { stripHtml } from "@/lib/utils/sanitize";
import { PostTypeIcon } from "@/components/feed/PostTypeIcon";
import { getPostTypeTheme } from "@/lib/feed-view/post-type-theme";
import { getTimeAgoWords } from "@/lib/utils/time";
import type { Collection } from "@/lib/types";
import "./collections.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
  /** Works already in the collection, hidden from the list. */
  excludeIds: string[];
  onAdded: () => void;
}

/** "Add works": the owner's published posts not yet in this collection. */
export default function AddWorksSheet({ isOpen, onClose, collection, excludeIds, onAdded }: Props) {
  const { user } = useAuth();
  const { works, loading } = useOwnWorks(user?.id, isOpen);
  const { addPostsToCollection, busy } = useCollectionMutations();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Start clean each time the sheet opens (derived-state reset, no effect).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setQuery("");
      setSelected(new Set());
    }
  }

  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return works
      .filter((w) => !exclude.has(w.id))
      .map((w) => ({ ...w, text: (w.title?.trim() || stripHtml(w.content)).trim() }))
      .filter((w) => !q || w.text.toLowerCase().includes(q) || getPostTypeTheme(w.type).label.toLowerCase().includes(q));
  }, [works, exclude, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await addPostsToCollection(collection.id, ids);
    if (!ok) {
      showToast.error("Couldn't add those works", "Please try again.");
      return;
    }
    showToast.success(ids.length === 1 ? `Added to ${collection.name}` : `Added ${ids.length} works to ${collection.name}`);
    notifyCollectionsChanged();
    onAdded();
    onClose();
  };

  return (
    <Portal>
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title="Add works"
        subtitle={`Choose what goes into ${collection.name}.`}
        busy={busy}
        size="tall"
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-5 py-2.5 rounded-full border border-border-light font-ui text-sm text-muted hover:text-ink hover:border-border-strong transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={add}
              disabled={busy || selected.size === 0}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-white shadow-lg shadow-purple-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {busy ? "Adding…" : selected.size > 0 ? `Add ${selected.size}` : "Add"}
            </button>
          </>
        }
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your works"
          aria-label="Search your works"
          className="collection-pick-search"
        />
        {loading && works.length === 0 ? (
          <p className="font-body text-sm text-muted py-6 text-center">Loading your works…</p>
        ) : candidates.length === 0 ? (
          <p className="font-body text-sm text-muted py-6 text-center">
            {works.length === 0 ? "You haven't published anything yet." : query ? "Nothing matches that." : "Everything you've published is already here."}
          </p>
        ) : (
          <div role="group" aria-label="Your works" className="-mx-2">
            {candidates.map((w) => (
              <button
                key={w.id}
                type="button"
                role="checkbox"
                aria-checked={selected.has(w.id)}
                onClick={() => toggle(w.id)}
                className="collection-pick-row"
              >
                <div className={`collection-pick-thumb ${w.image_url ? "" : "collection-pick-thumb--paper"}`}>
                  {w.image_url ? <img src={w.image_url} alt="" loading="lazy" /> : <PostTypeIcon type={w.type} />}
                </div>
                <div className="collection-pick-body">
                  <div className="collection-pick-name">{w.text || getPostTypeTheme(w.type).label}</div>
                  <div className="collection-pick-sub">
                    {getPostTypeTheme(w.type).label} · {getTimeAgoWords(w.created_at)}
                  </div>
                </div>
                <span className="collection-pick-check" aria-hidden="true">
                  <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </Portal>
  );
}
