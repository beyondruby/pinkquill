"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ActionMenu from "@/components/ui/ActionMenu";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import NewCollectionModal from "@/components/collections/NewCollectionModal";
import { CollectionIcon } from "@/components/collections/CollectionIcon";
import { useModal } from "@/components/providers/ModalProvider";
import { useCollectionMutations } from "@/lib/hooks/useCollections";
import { collectionCountLabel, collectionPath, COLLECTIONS_CHANGED_EVENT, notifyCollectionsChanged } from "@/lib/utils/collections";
import { showToast } from "@/lib/utils/toast";
import { icons } from "@/components/ui/Icons";
import type { Collection } from "@/lib/types";

/**
 * Three cards fanned like prints on a table. The first two works sit at the
 * back (their first image, or an excerpt on paper); the collection's own
 * cover — its icon and name on the brand gradient — is the front card. Blank
 * sheets fill out a stack with fewer than two works.
 */
function CollectionStack({ collection }: { collection: Collection }) {
  const previews = (collection.previews ?? []).slice(0, 2);
  const cards: React.ReactNode[] = previews.map((p) =>
    p.kind === "image" && p.src ? (
      <div key={p.post_id} className="studio-collection-card">
        <img src={p.src} alt="" loading="lazy" />
      </div>
    ) : (
      <div key={p.post_id} className="studio-collection-card studio-collection-card--text">
        <span>{p.text}</span>
      </div>
    )
  );
  while (cards.length < 2) {
    cards.push(<div key={`blank-${cards.length}`} className="studio-collection-card studio-collection-card--blank" />);
  }
  cards.push(
    collection.cover_url ? (
      <div key="cover" className="studio-collection-card">
        <img src={collection.cover_url} alt="" loading="lazy" />
      </div>
    ) : (
      <div key="cover" className="studio-collection-card studio-collection-card--cover">
        <div className="studio-collection-cover-icon"><CollectionIcon collection={collection} /></div>
        <span>{collection.name}</span>
      </div>
    )
  );
  return <div className="studio-collection-stack">{cards}</div>;
}

interface CollectionsShelfProps {
  collections: Collection[];
  isOwnProfile: boolean;
  username: string;
  /** Refetch after any write here or on another surface. */
  onChanged: () => void;
}

export default function CollectionsShelf({ collections, isOwnProfile, username, onChanged }: CollectionsShelfProps) {
  const { openCollectionModal } = useModal();
  const { reorderCollections, deleteCollection, busy } = useCollectionMutations();
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [editTarget, setEditTarget] = useState<Collection | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    window.addEventListener(COLLECTIONS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(COLLECTIONS_CHANGED_EVENT, onChanged);
  }, [onChanged]);

  const move = async (index: number, delta: -1 | 1) => {
    const next = index + delta;
    if (next < 0 || next >= collections.length) return;
    const order = [...collections];
    [order[index], order[next]] = [order[next], order[index]];
    const ok = await reorderCollections(order.map((c) => c.id));
    if (!ok) showToast.error("Couldn't move that collection", "Please try again.");
    onChanged();
  };

  return (
    <>
      <div className="studio-collections">
        {collections.map((collection, index) => (
          <div key={collection.id} className="studio-collection">
            <Link
              href={collectionPath(username, collection.slug)}
              className="studio-collection-link"
              aria-label={`${collection.name}, ${collectionCountLabel(collection)}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                openCollectionModal({ username, slug: collection.slug, collection });
              }}
            >
              <CollectionStack collection={collection} />
              <div className="studio-collection-title">{collection.name}</div>
              <div className="studio-collection-meta">{collectionCountLabel(collection)}</div>
              {collection.description && <p className="studio-collection-desc">{collection.description}</p>}
            </Link>

            {isOwnProfile && (
              <div className="studio-collection-menu studio-touch-reveal">
                <ActionMenu
                  widthClassName="w-44"
                  align="end"
                  label={`Options for ${collection.name}`}
                  buttonClassName="studio-collection-menu-btn"
                  buttonIconClassName="w-4 h-4"
                  items={[
                    { label: "Edit", onSelect: () => setEditTarget(collection), icon: icons.edit },
                    { label: "Move earlier", disabled: index === 0 || busy, onSelect: () => move(index, -1), icon: icons.chevronLeft, dividerBefore: true },
                    { label: "Move later", disabled: index === collections.length - 1 || busy, onSelect: () => move(index, 1), icon: icons.chevronRight },
                    { label: "Delete", onSelect: () => setDeleteTarget(collection), tone: "danger", dividerBefore: true, icon: icons.trash },
                  ]}
                />
              </div>
            )}
          </div>
        ))}

        {isOwnProfile && (
          <div className="studio-collection studio-collection--new">
            <button type="button" className="studio-collection-link" onClick={() => setShowNew(true)}>
              <div className="studio-collection-stack">
                <div className="studio-collection-card" />
                <div className="studio-collection-card" />
                <div className="studio-collection-card">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v14M5 12h14" />
                  </svg>
                </div>
              </div>
              <div className="studio-collection-title">New collection</div>
              <div className="studio-collection-meta">Gather works into a set</div>
            </button>
          </div>
        )}
      </div>

      <NewCollectionModal
        isOpen={showNew || !!editTarget}
        collection={editTarget}
        onClose={() => {
          setShowNew(false);
          setEditTarget(null);
        }}
        onSaved={(saved) => {
          onChanged();
          if (!editTarget) openCollectionModal({ username, slug: saved.slug, collection: saved });
        }}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const ok = await deleteCollection(deleteTarget.id);
          if (!ok) showToast.error("Couldn't delete this collection", "Please try again.");
          setDeleteTarget(null);
          notifyCollectionsChanged();
        }}
        title="Pull this collection from your studio?"
        description="The collection leaves your shelves for good. The works inside it stay published."
        confirmText="Erase it"
        isDanger
        loading={busy}
      />
    </>
  );
}
