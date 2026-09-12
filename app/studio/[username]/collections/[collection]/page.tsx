"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/lib/hooks/useProfile";
import { useCollection } from "@/lib/hooks/useCollections";
import { supabase } from "@/lib/supabase";
import { actionToast } from "@/lib/utils/toast";
import Loading from "@/components/ui/Loading";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { CollectionIcon } from "@/components/studio/CollectionsShelf";

export default function CollectionPage() {
  const params = useParams();
  const { user } = useAuth();

  const username = params?.username as string;
  const collectionSlug = params?.collection as string;

  const { profile, loading: profileLoading } = useProfile(username, user?.id);
  const { collection, loading: collectionLoading, error, refetch } = useCollection(profile?.id, collectionSlug);
  const isOwner = !!user && !!profile && user.id === profile.id;

  const [deleteItemTarget, setDeleteItemTarget] = useState<string | null>(null);
  const [itemDeleting, setItemDeleting] = useState(false);

  const loading = profileLoading || collectionLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl text-ink mb-2">Collection Not Found</h1>
          <p className="font-body text-muted mb-4">This collection doesn&apos;t exist or has been removed.</p>
          <Link
            href={`/studio/${username}?tab=collections`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:-translate-y-0.5 transition-transform"
          >
            Back to Collections
          </Link>
        </div>
      </div>
    );
  }

  const items = collection.items ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href={`/studio/${username}`} className="hover:text-accent transition-colors">
          @{username}
        </Link>
        <span>/</span>
        <Link href={`/studio/${username}?tab=collections`} className="hover:text-accent transition-colors">
          Collections
        </Link>
        <span>/</span>
        <span className="text-ink font-medium">{collection.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {collection.cover_url ? (
          <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden flex-shrink-0">
            <img src={collection.cover_url} alt={collection.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex-shrink-0 flex items-center justify-center text-3xl text-white bg-gradient-to-br from-purple-primary to-pink-vivid [&>svg]:w-9 [&>svg]:h-9 [&>img]:w-full [&>img]:h-full [&>img]:rounded-2xl [&>img]:object-cover">
            <CollectionIcon collection={collection} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink mb-2">
            {collection.name}
          </h1>
          {collection.description && (
            <p className="font-body text-muted mb-4">{collection.description}</p>
          )}
          <p className="font-ui text-sm text-muted">
            {items.length === 0
              ? "Nothing here yet"
              : `${items.length} ${items.length === 1 ? "piece" : "pieces"}`}
          </p>
        </div>
      </div>

      {/* Pieces */}
      {items.length === 0 ? (
        <div className="py-16 text-center bg-subtle rounded-2xl">
          <svg className="w-12 h-12 mx-auto text-muted/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="font-display text-lg text-ink mb-2">Nothing here yet</h3>
          <p className="font-body text-sm text-muted">
            {isOwner
              ? "Add pieces to this collection when you create a post."
              : "This collection doesn't hold any pieces yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id} className="group/item relative">
              <Link
                href={`/studio/${username}/collections/${collection.slug}/${item.slug}`}
                className="block"
              >
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-purple-primary/5 to-pink-vivid/5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  {item.cover_url ? (
                    <img src={item.cover_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4">
                      <p className="font-body italic text-sm text-ink/70 text-center line-clamp-4">{item.name}</p>
                    </div>
                  )}
                </div>
                <p className="mt-2 font-ui text-sm font-medium text-ink truncate text-center">{item.name}</p>
                <p className="font-body text-xs text-muted truncate text-center">
                  {item.posts_count ? `${item.posts_count} ${item.posts_count === 1 ? "post" : "posts"}` : item.description || ""}
                </p>
              </Link>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => setDeleteItemTarget(item.id)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 hover:bg-red-500 transition-all"
                  title="Remove piece"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={async () => {
          if (!deleteItemTarget) return;
          setItemDeleting(true);
          const { error: deleteError } = await supabase.from("collection_items").delete().eq("id", deleteItemTarget);
          if (deleteError) actionToast.genericError("remove item");
          else await refetch();
          setItemDeleting(false);
          setDeleteItemTarget(null);
        }}
        title="Remove this piece?"
        description="It leaves the collection for good. The posts inside it stay on your studio."
        confirmText="Remove"
        isDanger
        loading={itemDeleting}
      />
    </div>
  );
}
