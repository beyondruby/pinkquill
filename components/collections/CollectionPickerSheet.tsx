"use client";

import { useMemo, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Portal from "@/components/ui/Portal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCollections, usePostCollections, useCollectionMutations } from "@/lib/hooks/useCollections";
import { collectionCountLabel, notifyCollectionsChanged } from "@/lib/utils/collections";
import { showToast } from "@/lib/utils/toast";
import { CollectionIcon } from "./CollectionIcon";
import NewCollectionModal from "./NewCollectionModal";
import type { Collection } from "@/lib/types";
import "./collections.css";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

/**
 * "Add to collection": the owner's collections as a checklist, the post's
 * current memberships pre-checked, "New collection" at the bottom. Saving
 * replaces the post's memberships in one call.
 */
export default function CollectionPickerSheet({ isOpen, onClose, postId }: Props) {
  const { user } = useAuth();
  const { collections, loading, refetch } = useCollections(user?.id, { enabled: isOpen });
  const { refs, refetch: refetchRefs } = usePostCollections(isOpen ? postId : null);
  const { setPostCollections, busy } = useCollectionMutations();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);

  const initial = useMemo(() => new Set(refs.map((r) => r.id)), [refs]);
  // Re-seed the checklist whenever the post's memberships load or the sheet reopens.
  const seed = isOpen ? [...initial].sort().join(",") : null;
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  if (seed !== seededFrom) {
    setSeededFrom(seed);
    if (seed !== null) setSelected(new Set(initial));
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const changed = selected.size !== initial.size || [...selected].some((id) => !initial.has(id));

  const save = async () => {
    const ids = [...selected];
    const ok = await setPostCollections(postId, ids);
    if (!ok) {
      showToast.error("Couldn't update collections", "Please try again.");
      return;
    }
    const added = ids.filter((id) => !initial.has(id)).length;
    const removed = [...initial].filter((id) => !selected.has(id)).length;
    if (added && !removed) {
      const names = collections.filter((c) => ids.includes(c.id) && !initial.has(c.id)).map((c) => c.name);
      showToast.success(added === 1 ? `Added to ${names[0]}` : `Added to ${added} collections`);
    } else if (removed && !added) {
      showToast.info(removed === 1 ? "Removed from the collection" : `Removed from ${removed} collections`);
    } else {
      showToast.success("Collections updated");
    }
    notifyCollectionsChanged();
    refetchRefs();
    onClose();
  };

  const handleCreated = (collection: Collection) => {
    setShowNew(false);
    refetch();
    setSelected((prev) => new Set(prev).add(collection.id));
  };

  return (
    <>
      <Portal>
        <Sheet
          isOpen={isOpen}
          onClose={onClose}
          title="Add to collection"
          subtitle="Pick where this work belongs on your studio."
          busy={busy}
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
                onClick={save}
                disabled={busy || !changed}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-white shadow-lg shadow-purple-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </>
          }
        >
          {loading && collections.length === 0 ? (
            <p className="font-body text-sm text-muted py-6 text-center">Loading your collections…</p>
          ) : collections.length === 0 ? (
            <p className="font-body text-sm text-muted py-4 text-center">You haven&apos;t started a collection yet.</p>
          ) : (
            <div role="group" aria-label="Your collections" className="-mx-2">
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="checkbox"
                  aria-checked={selected.has(c.id)}
                  onClick={() => toggle(c.id)}
                  className="collection-pick-row"
                >
                  <div className="collection-pick-thumb">
                    {c.cover_url ? <img src={c.cover_url} alt="" /> : <CollectionIcon collection={c} />}
                  </div>
                  <div className="collection-pick-body">
                    <div className="collection-pick-name">{c.name}</div>
                    <div className="collection-pick-sub">{collectionCountLabel(c)}</div>
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
          <button type="button" onClick={() => setShowNew(true)} className="collection-chip collection-chip--new">
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            New collection
          </button>
        </Sheet>
      </Portal>
      <NewCollectionModal isOpen={showNew} onClose={() => setShowNew(false)} onSaved={handleCreated} />
    </>
  );
}
