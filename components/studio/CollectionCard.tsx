"use client";

import { useState } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/types";
import ActionMenu from "@/components/ui/ActionMenu";
import ConfirmationModal from "@/components/ui/ConfirmationModal";

interface CollectionCardProps {
  collection: Collection;
  isOwnProfile: boolean;
  username: string;
  onToggleCollapse: () => void;
  onDelete: () => void | Promise<void>;
  onDeleteItem: (itemId: string) => void | Promise<void>;
  index: number;
  totalCount: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

/** The named marks a collection can carry (stored as `icon:<key>`). */
const collectionMarks: Record<string, React.ReactNode> = {
  quill: <svg viewBox="0 0 24 24" {...stroke}><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /></svg>,
  sparkle: <svg viewBox="0 0 24 24" {...stroke}><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" /><path d="M5 3l.5 2L7 5.5 5.5 6 5 8l-.5-2L3 5.5 4.5 5 5 3z" /><path d="M19 17l.5 2 1.5.5-1.5.5-.5 2-.5-2-1.5-.5 1.5-.5.5-2z" /></svg>,
  heart: <svg viewBox="0 0 24 24" {...stroke}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  book: <svg viewBox="0 0 24 24" {...stroke}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>,
  music: <svg viewBox="0 0 24 24" {...stroke}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>,
  camera: <svg viewBox="0 0 24 24" {...stroke}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>,
  folder: <svg viewBox="0 0 24 24" {...stroke}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  star: <svg viewBox="0 0 24 24" {...stroke}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
};
const boxMark = <svg viewBox="0 0 24 24" {...stroke}><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
const imageMark = <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /></svg>;
const chevron = <svg viewBox="0 0 24 24" {...stroke}><path d="M6 9l6 6 6-6" /></svg>;

/** The collection's mark: a named icon, an emoji (stored as text or a hex code point), an image, or a box. */
export function CollectionMark({ collection }: { collection: Pick<Collection, "icon_emoji" | "icon_url"> }) {
  const raw = collection.icon_emoji;
  if (raw?.startsWith("icon:")) {
    const mark = collectionMarks[raw.slice(5)];
    if (mark) return <span className="pq-collection__mark" aria-hidden="true">{mark}</span>;
  }
  if (raw) {
    let glyph = raw;
    if (/^[0-9A-Fa-f]+$/.test(raw)) {
      const codePoint = parseInt(raw, 16);
      if (!Number.isNaN(codePoint) && codePoint > 0) {
        try { glyph = String.fromCodePoint(codePoint); } catch { glyph = raw; }
      }
    }
    return <span className="pq-collection__mark pq-collection__mark--emoji" aria-hidden="true">{glyph}</span>;
  }
  if (collection.icon_url) return <span className="pq-collection__mark" aria-hidden="true"><img src={collection.icon_url} alt="" /></span>;
  return <span className="pq-collection__mark" aria-hidden="true">{boxMark}</span>;
}

function countWord(n: number | undefined, one: string, many: string): string {
  const count = n ?? 0;
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * One collection: its mark, name, how many things are in it, the owner's
 * controls (order, edit, delete) and a grid of its items. Collapsing hides
 * the grid; nothing is hidden behind hover.
 */
export default function CollectionCard({
  collection, isOwnProfile, username, onToggleCollapse, onDelete, onDeleteItem, index, totalCount, onMoveUp, onMoveDown,
}: CollectionCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [itemDeleting, setItemDeleting] = useState(false);
  const items = collection.items || [];
  const open = !collection.is_collapsed;
  const base = `/studio/${username}/collections/${collection.slug}`;
  const targetItem = items.find((i) => i.id === deleteItemTarget);

  return (
    <article className="pq-collection" aria-label={collection.name}>
      <header className="pq-collection__head">
        <CollectionMark collection={collection} />
        <div className="pq-collection__text">
          <h3 className="pq-collection__name">{collection.name}</h3>
          <p className="pq-collection__meta">{countWord(collection.items_count ?? items.length, "item", "items")}</p>
          {collection.description && <p className="pq-collection__desc">{collection.description}</p>}
        </div>
        <div className="pq-collection__actions">
          {isOwnProfile && totalCount > 1 && (
            <>
              <button type="button" className="pq-icon-button" onClick={onMoveUp} disabled={index === 0} aria-label={`Move ${collection.name} up`}>
                <svg viewBox="0 0 24 24" {...stroke}><path d="M6 15l6-6 6 6" /></svg>
              </button>
              <button type="button" className="pq-icon-button" onClick={onMoveDown} disabled={index === totalCount - 1} aria-label={`Move ${collection.name} down`}>
                {chevron}
              </button>
            </>
          )}
          <button type="button" className="pq-icon-button pq-collection__toggle" onClick={onToggleCollapse} aria-expanded={open} aria-label={open ? `Hide ${collection.name}` : `Show ${collection.name}`}>
            {chevron}
          </button>
          {isOwnProfile && (
            <ActionMenu
              buttonClassName="pq-icon-button"
              buttonAriaLabel={`More for ${collection.name}`}
              widthClassName="w-44"
              items={[
                { label: "Edit", href: `${base}/edit` },
                { label: "Delete", onSelect: () => setConfirmDelete(true), tone: "danger", dividerBefore: true },
              ]}
            />
          )}
        </div>
      </header>

      {open && (
        items.length > 0 ? (
          <div className="pq-collection__items">
            {items.map((item) => (
              <div key={item.id} className="pq-collection-item">
                <Link href={`${base}/${item.slug}`} className="pq-collection-item__tile" aria-label={item.name}>
                  {item.cover_url ? <img src={item.cover_url} alt="" loading="lazy" /> : <span className="pq-collection-item__blank">{imageMark}</span>}
                </Link>
                {isOwnProfile && (
                  <button type="button" className="pq-icon-button pq-collection-item__remove" onClick={() => setDeleteItemTarget(item.id)} aria-label={`Remove ${item.name}`}>
                    <svg viewBox="0 0 24 24" {...stroke}><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                )}
                <Link href={`${base}/${item.slug}`} className="pq-collection-item__name">{item.name}</Link>
                <span className="pq-collection-item__meta">{countWord(item.posts_count, "post", "posts")}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="pq-collection__empty">
            {isOwnProfile ? "Nothing in here yet. Add items when you post." : "Nothing in this collection yet."}
          </p>
        )
      )}

      <ConfirmationModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setDeleting(true);
          await onDelete();
          setDeleting(false);
          setConfirmDelete(false);
        }}
        title={`Delete ${collection.name}?`}
        description="The collection and every item in it go for good. The posts themselves stay."
        confirmText="Delete collection"
        isDanger
        loading={deleting}
      />
      <ConfirmationModal
        isOpen={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={async () => {
          if (!deleteItemTarget) return;
          setItemDeleting(true);
          await onDeleteItem(deleteItemTarget);
          setItemDeleting(false);
          setDeleteItemTarget(null);
        }}
        title={`Remove ${targetItem?.name || "this item"}?`}
        description="It leaves the collection for good. The posts in it stay on your studio."
        confirmText="Remove"
        isDanger
        loading={itemDeleting}
      />
    </article>
  );
}
