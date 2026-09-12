"use client";

import React, { useState } from "react";
import Link from "next/link";
import ActionMenu from "@/components/ui/ActionMenu";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import NewCollectionModal from "@/components/collections/NewCollectionModal";
import type { Collection, CollectionItem } from "@/lib/types";

// Branded icons for collections (matching NewCollectionModal)
const brandedCollectionIcons: Record<string, React.ReactNode> = {
  quill: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
      <line x1="16" y1="8" x2="2" y2="22"/>
    </svg>
  ),
  sparkle: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>
      <path d="M5 3l.5 2L7 5.5 5.5 6 5 8l-.5-2L3 5.5 4.5 5 5 3z"/>
      <path d="M19 17l.5 2 1.5.5-1.5.5-.5 2-.5-2-1.5-.5 1.5-.5.5-2z"/>
    </svg>
  ),
  heart: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  book: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  music: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  ),
  camera: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  folder: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  star: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
};


/** The collection's chosen icon: a branded key, an emoji (raw or hex code point), or an uploaded image. */
export function CollectionIcon({ collection }: { collection: Collection }) {
  if (collection.icon_emoji?.startsWith("icon:")) {
    const icon = brandedCollectionIcons[collection.icon_emoji.replace("icon:", "")];
    if (icon) return <>{icon}</>;
  }
  if (collection.icon_emoji) {
    if (/^[0-9A-Fa-f]+$/.test(collection.icon_emoji)) {
      const codePoint = parseInt(collection.icon_emoji, 16);
      return codePoint <= 0x10ffff ? <span>{String.fromCodePoint(codePoint)}</span> : null;
    }
    return <span>{collection.icon_emoji}</span>;
  }
  if (collection.icon_url) {
    return <img src={collection.icon_url} alt="" />;
  }
  return null;
}

function pieceCount(n: number | undefined): string {
  if (!n) return "Nothing here yet";
  return `${n} ${n === 1 ? "piece" : "pieces"}`;
}

/**
 * Three preview cards fanned like prints on a table. The first pieces of the
 * collection sit at the back (their cover, or their name on paper); the
 * collection's own cover — its icon and name on the brand gradient — is the
 * front card. Blank sheets fill out a stack with fewer than three pieces.
 */
function CollectionStack({ collection }: { collection: Collection }) {
  const items: CollectionItem[] = collection.items ?? [];
  const backing = items.slice(0, 2);
  const cards: React.ReactNode[] = backing.map((item) =>
    item.cover_url ? (
      <div key={item.id} className="studio-collection-card">
        <img src={item.cover_url} alt="" loading="lazy" />
      </div>
    ) : (
      <div key={item.id} className="studio-collection-card studio-collection-card--text">
        <span>{item.name}</span>
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
  onReorder: (collectionIds: string[]) => Promise<void>;
  onDelete: (collectionId: string) => Promise<void>;
  onCreated: () => void;
}

export default function CollectionsShelf({
  collections,
  isOwnProfile,
  username,
  onReorder,
  onDelete,
  onCreated,
}: CollectionsShelfProps) {
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const move = (index: number, delta: -1 | 1) => {
    const next = index + delta;
    if (next < 0 || next >= collections.length) return;
    const order = [...collections];
    [order[index], order[next]] = [order[next], order[index]];
    return onReorder(order.map((c) => c.id));
  };

  return (
    <>
      <div className="studio-collections">
        {collections.map((collection, index) => (
          <div key={collection.id} className="studio-collection">
            <Link
              href={`/studio/${username}/collections/${collection.slug}`}
              className="studio-collection-link"
              aria-label={`${collection.name}, ${pieceCount(collection.items_count)}`}
            >
              <CollectionStack collection={collection} />
              <div className="studio-collection-title">{collection.name}</div>
              <div className="studio-collection-meta">{pieceCount(collection.items_count)}</div>
              {collection.description && (
                <p className="studio-collection-desc">{collection.description}</p>
              )}
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
                    {
                      label: "Move earlier",
                      disabled: index === 0,
                      onSelect: () => move(index, -1),
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      ),
                    },
                    {
                      label: "Move later",
                      disabled: index === collections.length - 1,
                      onSelect: () => move(index, 1),
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      ),
                    },
                    {
                      label: "Delete",
                      onSelect: () => setDeleteTarget(collection),
                      tone: "danger",
                      dividerBefore: true,
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ),
                    },
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
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onCreated={() => {
          setShowNew(false);
          onCreated();
        }}
      />

      <ConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          await onDelete(deleteTarget.id);
          setDeleting(false);
          setDeleteTarget(null);
        }}
        title="Pull this collection from your studio?"
        description="The collection and every piece inside it will leave your shelves for good. No way to set it back up."
        confirmText="Erase it"
        isDanger
        loading={deleting}
      />
    </>
  );
}
