"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useProfile } from "@/lib/hooks/useProfile";
import { useCollectionBySlug, useCollectionWorks, useCollectionMutations } from "@/lib/hooks/useCollections";
import { toModalPost } from "@/lib/posts/toPostProps";
import { stripHtml } from "@/lib/utils/sanitize";
import { collectionCountLabel, notifyCollectionsChanged, COLLECTIONS_CHANGED_EVENT } from "@/lib/utils/collections";
import { showToast } from "@/lib/utils/toast";
import Loading from "@/components/ui/Loading";
import ActionMenu from "@/components/ui/ActionMenu";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import Portal from "@/components/ui/Portal";
import { PostTypeChip } from "@/components/feed/PostTypeChip";
import { PostTypeIcon } from "@/components/feed/PostTypeIcon";
import { icons } from "@/components/ui/Icons";
import { CollectionIcon } from "./CollectionIcon";
import NewCollectionModal from "./NewCollectionModal";
import AddWorksSheet from "./AddWorksSheet";
import type { Collection, Post } from "@/lib/types";
import "./collections.css";

interface Props {
  username: string;
  slug: string;
  /** Already-loaded row (from the shelf) so the header paints at once. */
  initial?: Collection | null;
  /** Rendered inside the collection modal: show a close button. */
  onClose?: () => void;
}

const PlusIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
  </svg>
);
const ArrangeIcon = (
  <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
  </svg>
);

function WorkTile({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const media = [...(post.media || [])].sort((a, b) => a.position - b.position);
  const image = media.find((m) => m.media_type === "image");
  const video = media.find((m) => m.media_type === "video");
  const audio = media.find((m) => m.media_type === "audio") || post.spotify_track;
  const caption = post.title?.trim() || stripHtml(post.content).slice(0, 80);
  const label = post.title?.trim() || stripHtml(post.content).slice(0, 60);

  if (image) {
    return (
      <button type="button" onClick={onOpen} className="collection-work-tile" aria-label={label || "Open work"}>
        <img src={image.media_url} alt={image.caption || ""} loading="lazy" />
      </button>
    );
  }
  if (video || audio) {
    return (
      <button type="button" onClick={onOpen} className="collection-work-tile collection-work-tile--media" aria-label={label || "Open work"}>
        <PostTypeIcon type={post.type} />
        {caption && <span className="collection-work-caption">{caption}</span>}
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="collection-work-tile collection-work-tile--text" aria-label={label || "Open work"}>
      <span className="collection-work-excerpt">{stripHtml(post.content).slice(0, 220) || post.title}</span>
      <PostTypeChip type={post.type} variant="caps" size="xs" />
    </button>
  );
}

/** A collection, opened: header, owner actions and the works as tiles. Shared by the modal and the page. */
export default function CollectionView({ username, slug, initial = null, onClose }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { openPostModal, subscribeToDeletes, subscribeToAuthorBlocks } = useModal();
  const { profile, loading: profileLoading } = useProfile(username, user?.id);
  const { collection: fetched, loading: collectionLoading, refetch: refetchCollection } = useCollectionBySlug(profile?.id, slug);
  const collection = fetched ?? initial;
  const { posts, setPosts, loading: worksLoading, refetch: refetchWorks } = useCollectionWorks(collection?.id, user?.id);
  const { removePostFromCollection, addPostsToCollection, reorderCollectionPosts, deleteCollection, busy } = useCollectionMutations();

  const isOwner = !!user && !!collection && user.id === collection.user_id;
  const [arranging, setArranging] = useState(false);
  const [order, setOrder] = useState<Post[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Deletes and blocks made in the post modal drop the tile here too.
  useEffect(() => {
    const unsubDelete = subscribeToDeletes((id) => setPosts((prev) => prev.filter((p) => p.id !== id)));
    const unsubBlock = subscribeToAuthorBlocks((authorId) => setPosts((prev) => prev.filter((p) => p.author_id !== authorId)));
    return () => {
      unsubDelete();
      unsubBlock();
    };
  }, [subscribeToDeletes, subscribeToAuthorBlocks, setPosts]);

  // Another surface (composer, picker sheet) changed memberships.
  useEffect(() => {
    const handler = () => {
      refetchCollection();
      refetchWorks();
    };
    window.addEventListener(COLLECTIONS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(COLLECTIONS_CHANGED_EVENT, handler);
  }, [refetchCollection, refetchWorks]);

  const open = useCallback((post: Post) => openPostModal(toModalPost(post)), [openPostModal]);

  const startArrange = () => {
    setOrder(posts);
    setArranging(true);
  };
  const move = (index: number, delta: -1 | 1) => {
    setOrder((prev) => {
      const next = index + delta;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  };
  const finishArrange = async () => {
    if (!collection) return;
    const ids = order.map((p) => p.id);
    const unchanged = ids.every((id, i) => posts[i]?.id === id);
    setArranging(false);
    if (unchanged) return;
    setPosts(order);
    const ok = await reorderCollectionPosts(collection.id, ids);
    if (!ok) {
      showToast.error("Couldn't save that order", "Please try again.");
      refetchWorks();
      return;
    }
    notifyCollectionsChanged();
  };

  const remove = async (post: Post) => {
    if (!collection) return;
    const before = posts;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    const ok = await removePostFromCollection(collection.id, post.id);
    if (!ok) {
      setPosts(before);
      showToast.error("Couldn't remove that work", "Please try again.");
      return;
    }
    refetchCollection();
    notifyCollectionsChanged();
    toast.info(`Removed from ${collection.name}`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const back = await addPostsToCollection(collection.id, [post.id]);
          if (back) {
            refetchWorks();
            refetchCollection();
            notifyCollectionsChanged();
          }
        },
      },
    });
  };

  const confirmDelete = async () => {
    if (!collection) return;
    setDeleting(true);
    const ok = await deleteCollection(collection.id);
    setDeleting(false);
    if (!ok) {
      showToast.error("Couldn't delete this collection", "Please try again.");
      return;
    }
    setShowDelete(false);
    notifyCollectionsChanged();
    showToast.success(`${collection.name} is gone`);
    if (onClose) onClose();
    else router.push(`/studio/${username}?tab=collections`);
  };

  const shown = arranging ? order : posts;
  const excludeIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const countLabel = collection ? collectionCountLabel({ works_count: fetched ? collection.works_count : posts.length, type_counts: collection.type_counts }) : "";

  if ((profileLoading || collectionLoading) && !collection) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loading />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="py-24 text-center">
        <h2 className="font-display text-2xl text-ink mb-2">Collection not found</h2>
        <p className="font-body text-muted">It may have been pulled from the studio.</p>
      </div>
    );
  }

  return (
    <div className="collection-view">
      <div className="collection-view-head">
        <div className="collection-view-cover">
          {collection.cover_url ? <img src={collection.cover_url} alt="" /> : <CollectionIcon collection={collection} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="collection-view-title">{collection.name}</h1>
              {collection.description && <p className="collection-view-desc">{collection.description}</p>}
              <p className="collection-view-meta">
                {countLabel}
                {profile && (
                  <>
                    {" · "}
                    <a href={`/studio/${username}`} className="hover:text-ink transition-colors" onClick={onClose}>
                      {profile.display_name || `@${username}`}
                    </a>
                  </>
                )}
              </p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close collection"
                className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton transition-colors shrink-0"
              >
                {icons.close}
              </button>
            )}
          </div>
          {isOwner && (
            <div className="collection-view-actions mt-3">
              {arranging ? (
                <button type="button" onClick={finishArrange} disabled={busy} className="collection-pill collection-pill--primary">
                  Done arranging
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setShowAdd(true)} className="collection-pill collection-pill--primary">
                    {PlusIcon} Add works
                  </button>
                  <button type="button" onClick={() => setShowEdit(true)} className="collection-pill">
                    {icons.edit} Edit
                  </button>
                  {posts.length > 1 && (
                    <button type="button" onClick={startArrange} className="collection-pill">
                      {ArrangeIcon} Arrange
                    </button>
                  )}
                  <ActionMenu
                    widthClassName="w-44"
                    align="end"
                    label="More"
                    buttonClassName="collection-pill"
                    buttonIconClassName="w-4 h-4"
                    portal
                    items={[{ label: "Delete collection", onSelect: () => setShowDelete(true), tone: "danger", icon: icons.trash }]}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {worksLoading && posts.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loading />
        </div>
      ) : shown.length === 0 ? (
        <div className="collection-empty">
          <p>Nothing here yet.</p>
          {isOwner && (
            <button type="button" onClick={() => setShowAdd(true)} className="collection-pill collection-pill--primary mt-4">
              {PlusIcon} Add works
            </button>
          )}
        </div>
      ) : (
        <div className={`collection-works ${arranging ? "collection-works--arranging" : ""}`}>
          {shown.map((post, index) => (
            <div key={post.id} className="collection-work">
              <WorkTile post={post} onOpen={() => !arranging && open(post)} />
              {post.title && <div className="collection-work-title">{post.title}</div>}
              {isOwner && !arranging && (
                <div className="collection-work-menu">
                  <ActionMenu
                    widthClassName="w-52"
                    align="end"
                    label="Options for this work"
                    buttonClassName="collection-work-menu-btn"
                    buttonIconClassName="w-4 h-4"
                    portal
                    items={[
                      { label: "Open", onSelect: () => open(post), icon: icons.comment },
                      { label: "Remove from collection", onSelect: () => remove(post), tone: "danger", icon: icons.trash, dividerBefore: true },
                    ]}
                  />
                </div>
              )}
              {arranging && (
                <div className="collection-work-arrange">
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move earlier">
                    {icons.chevronLeft}
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === shown.length - 1} aria-label="Move later">
                    {icons.chevronRight}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isOwner && (
        <>
          <NewCollectionModal
            isOpen={showEdit}
            onClose={() => setShowEdit(false)}
            collection={collection}
            onSaved={() => {
              refetchCollection();
              notifyCollectionsChanged();
            }}
          />
          <AddWorksSheet
            isOpen={showAdd}
            onClose={() => setShowAdd(false)}
            collection={collection}
            excludeIds={excludeIds}
            onAdded={() => {
              refetchWorks();
              refetchCollection();
            }}
          />
          <Portal>
            <ConfirmationModal
              isOpen={showDelete}
              onClose={() => setShowDelete(false)}
              onConfirm={confirmDelete}
              title="Pull this collection from your studio?"
              description="The collection leaves your shelves for good. The works inside it stay published."
              confirmText="Erase it"
              isDanger
              loading={deleting}
            />
          </Portal>
        </>
      )}
    </div>
  );
}
