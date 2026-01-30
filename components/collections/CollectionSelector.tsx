"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCollections } from "@/lib/hooks/useCollections";
import type { Collection, CollectionItem } from "@/lib/types";
import NewCollectionModal from "./NewCollectionModal";
import NewCollectionItemModal from "./NewCollectionItemModal";

interface CollectionSelectorProps {
  selectedCollection: Collection | null;
  selectedItem: CollectionItem | null;
  onSelectCollection: (collection: Collection | null) => void;
  onSelectItem: (item: CollectionItem | null) => void;
  disabled?: boolean;
}

export default function CollectionSelector({
  selectedCollection,
  selectedItem,
  onSelectCollection,
  onSelectItem,
  disabled = false,
}: CollectionSelectorProps) {
  const { user } = useAuth();
  const { collections, loading, refetch } = useCollections(user?.id);

  const [showMenu, setShowMenu] = useState(false);
  const [showItemMenu, setShowItemMenu] = useState(false);
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const itemMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (itemMenuRef.current && !itemMenuRef.current.contains(event.target as Node)) {
        setShowItemMenu(false);
      }
    };

    if (showMenu || showItemMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu, showItemMenu]);

  // Get items for selected collection
  const selectedCollectionItems = selectedCollection?.items || [];

  const handleCollectionCreated = async (collection: Collection) => {
    await refetch();
    onSelectCollection(collection);
    onSelectItem(null);
  };

  const handleItemCreated = async (item: CollectionItem) => {
    await refetch();
    // Find the updated collection with the new item
    const updatedCollections = collections.find(c => c.id === selectedCollection?.id);
    if (updatedCollections) {
      onSelectCollection(updatedCollections);
    }
    onSelectItem(item);
  };

  const renderCollectionIcon = (collection: Collection, size: "sm" | "md" = "sm") => {
    const sizeClasses = size === "sm" ? "w-5 h-5" : "w-6 h-6";
    const textSize = size === "sm" ? "text-[0.5rem]" : "text-[0.6rem]";
    const emojiSize = size === "sm" ? "text-base" : "text-lg";

    if (collection.icon_url) {
      return (
        <img
          src={collection.icon_url}
          alt=""
          className={`${sizeClasses} rounded object-cover`}
        />
      );
    }
    if (collection.icon_emoji) {
      return (
        <span className={emojiSize}>
          {String.fromCodePoint(parseInt(collection.icon_emoji, 16))}
        </span>
      );
    }
    return (
      <div className={`${sizeClasses} rounded bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white ${textSize} font-bold`}>
        {collection.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  if (disabled) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Collection Selector */}
        <div className="relative" ref={menuRef}>
          {selectedCollection ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-purple-primary/30 bg-purple-primary/5 text-purple-primary font-ui text-[0.85rem]">
              <span
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {renderCollectionIcon(selectedCollection)}
                <span className="max-w-[80px] truncate">{selectedCollection.name}</span>
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCollection(null);
                  onSelectItem(null);
                }}
                className="ml-1 hover:text-red-500 cursor-pointer"
                role="button"
                tabIndex={0}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </div>
          ) : (
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/[0.08] bg-white text-muted hover:border-purple-primary hover:text-purple-primary font-ui text-[0.85rem] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Collection</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {/* Collection Menu Dropdown */}
          {showMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-56 max-h-72 overflow-y-auto bg-white rounded-xl shadow-xl border border-black/[0.06] overflow-hidden z-10">
              <div className="px-3 py-2 text-[0.75rem] font-ui text-muted uppercase tracking-wide border-b border-black/[0.06]">
                Add to collection
              </div>

              {/* Create New Collection */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowNewCollectionModal(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 font-ui text-[0.9rem] text-left text-purple-primary hover:bg-purple-primary/5 transition-all border-b border-black/[0.04]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>New Collection</span>
              </button>

              {/* No Collection Option */}
              <button
                onClick={() => {
                  onSelectCollection(null);
                  onSelectItem(null);
                  setShowMenu(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 font-ui text-[0.9rem] text-left transition-all ${
                  !selectedCollection
                    ? "bg-purple-primary/10 text-purple-primary"
                    : "text-ink hover:bg-black/[0.03]"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>No Collection</span>
              </button>

              {/* Loading */}
              {loading && (
                <div className="px-4 py-3 text-center text-muted text-sm">
                  Loading collections...
                </div>
              )}

              {/* Existing Collections */}
              {!loading && collections.length === 0 && (
                <div className="px-4 py-3 text-center text-muted text-sm">
                  No collections yet
                </div>
              )}

              {collections.map((collection) => (
                <button
                  key={collection.id}
                  onClick={() => {
                    onSelectCollection(collection);
                    onSelectItem(null);
                    setShowMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-ui text-[0.9rem] text-left transition-all ${
                    selectedCollection?.id === collection.id
                      ? "bg-purple-primary/10 text-purple-primary"
                      : "text-ink hover:bg-black/[0.03]"
                  }`}
                >
                  {renderCollectionIcon(collection, "md")}
                  <div className="flex-1 min-w-0">
                    <span className="block truncate">{collection.name}</span>
                    {collection.items_count !== undefined && collection.items_count > 0 && (
                      <span className="text-xs text-muted">{collection.items_count} items</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Item Selector (only shown when collection is selected) */}
        {selectedCollection && (
          <div className="relative" ref={itemMenuRef}>
            {selectedItem ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full border border-orange-warm/30 bg-orange-warm/5 text-orange-warm font-ui text-[0.85rem]">
                <span
                  onClick={() => setShowItemMenu(!showItemMenu)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  {selectedItem.cover_url ? (
                    <img src={selectedItem.cover_url} alt="" className="w-4 h-4 rounded object-cover" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  <span className="max-w-[80px] truncate">{selectedItem.name}</span>
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectItem(null);
                  }}
                  className="ml-1 hover:text-red-500 cursor-pointer"
                  role="button"
                  tabIndex={0}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
              </div>
            ) : (
              <button
                onClick={() => setShowItemMenu(!showItemMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-full border border-black/[0.08] bg-white text-muted hover:border-orange-warm hover:text-orange-warm font-ui text-[0.85rem] transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Item</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {/* Item Menu Dropdown */}
            {showItemMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-56 max-h-64 overflow-y-auto bg-white rounded-xl shadow-xl border border-black/[0.06] overflow-hidden z-10">
                <div className="px-3 py-2 text-[0.75rem] font-ui text-muted uppercase tracking-wide border-b border-black/[0.06]">
                  Add to item in {selectedCollection.name}
                </div>

                {/* Create New Item */}
                <button
                  onClick={() => {
                    setShowItemMenu(false);
                    setShowNewItemModal(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 font-ui text-[0.9rem] text-left text-orange-warm hover:bg-orange-warm/5 transition-all border-b border-black/[0.04]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>New Item</span>
                </button>

                {/* No Item Option */}
                <button
                  onClick={() => {
                    onSelectItem(null);
                    setShowItemMenu(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-ui text-[0.9rem] text-left transition-all ${
                    !selectedItem
                      ? "bg-orange-warm/10 text-orange-warm"
                      : "text-ink hover:bg-black/[0.03]"
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Collection only</span>
                </button>

                {/* Existing Items */}
                {selectedCollectionItems.length === 0 && (
                  <div className="px-4 py-3 text-center text-muted text-sm">
                    No items in this collection
                  </div>
                )}

                {selectedCollectionItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectItem(item);
                      setShowItemMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 font-ui text-[0.9rem] text-left transition-all ${
                      selectedItem?.id === item.id
                        ? "bg-orange-warm/10 text-orange-warm"
                        : "text-ink hover:bg-black/[0.03]"
                    }`}
                  >
                    {item.cover_url ? (
                      <img src={item.cover_url} alt="" className="w-6 h-6 rounded object-cover" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-orange-warm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="block truncate">{item.name}</span>
                      {item.posts_count !== undefined && item.posts_count > 0 && (
                        <span className="text-xs text-muted">{item.posts_count} posts</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <NewCollectionModal
        isOpen={showNewCollectionModal}
        onClose={() => setShowNewCollectionModal(false)}
        onCreated={handleCollectionCreated}
      />

      {selectedCollection && (
        <NewCollectionItemModal
          isOpen={showNewItemModal}
          onClose={() => setShowNewItemModal(false)}
          onCreated={handleItemCreated}
          collection={selectedCollection}
        />
      )}
    </>
  );
}
