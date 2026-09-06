"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useSavedPosts } from "@/lib/hooks/useFeed";
import { useSavedTakes } from "@/lib/hooks/useTakes";
import { useSavedProducts, useToggleSaveProduct } from "@/lib/hooks/useProducts";
import { supabase } from "@/lib/supabase";
import { transformPostForCard } from "@/lib/feed-view/transform";
import { formatCurrency } from "@/lib/utils/currency";
import { showToast } from "@/lib/utils/toast";
import { PageFrame, PageHeader } from "@/components/layout/PageFrame";
import { TabRow } from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { GalleryFeed } from "@/components/feed/GalleryView";
import TakePostCard from "@/components/takes/TakePostCard";
import { SAVED_KINDS, emptyCopy, keptWord, type SavedKind } from "./words";
import "@/components/takes/takes.css";
import "./saved.css";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const bookmarkFilled = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-3.5L6 21V4z" /></svg>;
const imageMark = <svg viewBox="0 0 24 24" {...stroke}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /></svg>;

function priceWord(min?: number, max?: number): string | null {
  if (min === undefined) return null;
  const money = (n: number) => formatCurrency(n, "USD", { fractionDigits: 0 });
  if (min === 0) return (max ?? 0) > 0 ? "$0 and up" : "Free";
  if (min === max) return money(min);
  return `From ${money(min)}`;
}

/**
 * Everything the signed-in person kept: posts on the gallery wall (the
 * tile's own bookmark removes them), takes in the takes grid and products as
 * plain tiles, each with one remove control. Removing is reversible by
 * saving again, so nothing asks twice.
 */
export default function SavedLibrary() {
  const { user } = useAuth();
  const { subscribeToUpdates } = useModal();
  const { posts, loading: postsLoading, error: postsError, refetch: refetchPosts } = useSavedPosts(user?.id);
  const { takes, loading: takesLoading, error: takesError, refetch: refetchTakes } = useSavedTakes(user?.id);
  const { products, loading: productsLoading, error: productsError, refetch: refetchProducts } = useSavedProducts(user?.id);
  const { toggle: toggleSaveProduct } = useToggleSaveProduct();
  const [kind, setKind] = useState<SavedKind>("all");
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<string | null>(null);

  // A post unsaved from its tile or the modal leaves the wall; saved again, it comes back.
  useEffect(() => subscribeToUpdates((update) => {
    if (update.field !== "saves") return;
    setRemoved((prev) => {
      const next = new Set(prev);
      if (update.isActive) next.delete(update.postId); else next.add(update.postId);
      return next;
    });
  }), [subscribeToUpdates]);

  const loading = postsLoading || takesLoading || productsLoading;
  const error = postsError || takesError || productsError;

  const visiblePosts = useMemo(() => posts.filter((p) => !removed.has(p.id)), [posts, removed]);
  const visibleTakes = useMemo(() => takes.filter((t) => !removed.has(t.id)), [takes, removed]);
  const visibleProducts = useMemo(() => products.filter((p) => !removed.has(p.id)), [products, removed]);
  const postItems = useMemo(() => visiblePosts.map((original) => ({ original, transformed: transformPostForCard(original) })), [visiblePosts]);
  const total = visiblePosts.length + visibleTakes.length + visibleProducts.length;

  const showPosts = (kind === "all" || kind === "posts") && visiblePosts.length > 0;
  const showTakes = (kind === "all" || kind === "takes") && visibleTakes.length > 0;
  const showProducts = (kind === "all" || kind === "products") && visibleProducts.length > 0;
  const nothing = !showPosts && !showTakes && !showProducts;

  const drop = (id: string) => setRemoved((prev) => new Set([...prev, id]));

  const removeTake = async (id: string) => {
    if (!user || busy) return;
    setBusy(id);
    try {
      const { error: err } = await supabase.from("take_saves").delete().eq("take_id", id).eq("user_id", user.id);
      if (err) throw err;
      drop(id);
      showToast.info("Removed from saved");
    } catch {
      showToast.error("Couldn't remove that", "Please try again");
    } finally {
      setBusy(null);
    }
  };

  const removeProduct = async (id: string) => {
    if (!user || busy) return;
    setBusy(id);
    try {
      const ok = await toggleSaveProduct(id, user.id, true);
      if (!ok) throw new Error("unsave failed");
      drop(id);
      showToast.info("Removed from saved");
    } catch {
      showToast.error("Couldn't remove that", "Please try again");
    } finally {
      setBusy(null);
    }
  };

  const empty = emptyCopy(kind);

  return (
    <PageFrame width="wide" className="pq-saved">
      <PageHeader title="Saved" lede={keptWord(total)} />
      <TabRow<SavedKind>
        className="pq-saved__tabs"
        ariaLabel="Kind of saved thing"
        items={SAVED_KINDS.map((k) => ({
          id: k.id,
          label: k.label,
          count: k.id === "all" ? total : k.id === "posts" ? visiblePosts.length : k.id === "takes" ? visibleTakes.length : visibleProducts.length,
        }))}
        value={kind}
        onChange={setKind}
      />

      {loading ? (
        <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
      ) : error ? (
        <div className="pq-feed-state pq-feed-state--card" role="alert">
          <p className="pq-feed-state__title">Couldn&rsquo;t load your saved things</p>
          <p className="pq-feed-state__text">{error}</p>
          <div className="pq-feed-state__actions">
            <Button variant="secondary" onClick={() => { void refetchPosts(); void refetchTakes(); void refetchProducts(); }}>Try again</Button>
          </div>
        </div>
      ) : nothing ? (
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">{empty.title}</p>
          <p className="pq-feed-state__text">{empty.text}</p>
          <div className="pq-feed-state__actions">
            <Link href={empty.href} className="pq-button pq-button--md pq-button--secondary">{empty.cta}</Link>
          </div>
        </div>
      ) : (
        <div role="tabpanel">
          {showPosts && (
            <section className="pq-saved__section" aria-label="Saved posts">
              {kind === "all" && <h2 className="pq-saved__subhead">Posts</h2>}
              <GalleryFeed items={postItems} />
            </section>
          )}
          {showTakes && (
            <section className="pq-saved__section" aria-label="Saved takes">
              {kind === "all" && <h2 className="pq-saved__subhead">Takes</h2>}
              <div className="takes-grid pq-saved-takes">
                {visibleTakes.map((take) => (
                  <div key={take.id} className="pq-saved-tile">
                    <TakePostCard take={take} variant="grid" />
                    <button
                      type="button"
                      className="pq-icon-button pq-icon-button--filled pq-saved-tile__remove"
                      onClick={() => { void removeTake(take.id); }}
                      disabled={busy === take.id}
                      aria-label={`Remove ${take.caption ? `"${take.caption.slice(0, 40)}"` : "this take"} from saved`}
                    >
                      {bookmarkFilled}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {showProducts && (
            <section className="pq-saved__section" aria-label="Saved products">
              {kind === "all" && <h2 className="pq-saved__subhead">Products</h2>}
              <div className="pq-saved-products">
                {visibleProducts.map((product) => {
                  const image = product.primary_image_url || product.media?.find((m) => m.is_primary)?.media_url || product.media?.[0]?.media_url;
                  const price = priceWord(product.min_price, product.max_price);
                  const seller = product.seller?.display_name || product.seller?.username;
                  return (
                    <div key={product.id} className="pq-saved-tile">
                      <Link href={`/product/${product.id}`} className="pq-saved-product">
                        <span className="pq-saved-product__image">
                          {image ? <img src={image} alt="" loading="lazy" /> : <span className="pq-saved-product__blank">{imageMark}</span>}
                        </span>
                        <span className="pq-saved-product__title">{product.title}</span>
                        <span className="pq-saved-product__meta">
                          {price && <span className="pq-saved-product__price">{price}</span>}
                          {price && seller && " · "}
                          {seller}
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="pq-icon-button pq-icon-button--filled pq-saved-tile__remove"
                        onClick={() => { void removeProduct(product.id); }}
                        disabled={busy === product.id}
                        aria-label={`Remove ${product.title} from saved`}
                      >
                        {bookmarkFilled}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </PageFrame>
  );
}
