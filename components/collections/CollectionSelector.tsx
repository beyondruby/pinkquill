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

  const [isExpanded, setIsExpanded] = useState(false);
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isExpanded]);

  const selectedCollectionItems = selectedCollection?.items || [];

  const handleCollectionCreated = async (collection: Collection) => {
    await refetch();
    onSelectCollection(collection);
    onSelectItem(null);
  };

  const handleItemCreated = async (item: CollectionItem) => {
    await refetch();
    const updatedCollections = collections.find(c => c.id === selectedCollection?.id);
    if (updatedCollections) {
      onSelectCollection(updatedCollections);
    }
    onSelectItem(item);
  };

  const renderCollectionIcon = (collection: Collection) => {
    if (collection.icon_url) {
      return (
        <img
          src={collection.icon_url}
          alt=""
          className="w-6 h-6 rounded-lg object-cover"
        />
      );
    }
    if (collection.icon_emoji) {
      return (
        <span className="text-lg leading-none">
          {String.fromCodePoint(parseInt(collection.icon_emoji, 16))}
        </span>
      );
    }
    return (
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white text-[0.55rem] font-bold">
        {collection.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  if (disabled) {
    return null;
  }

  const hasSelection = selectedCollection || selectedItem;

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Main Trigger Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`group relative flex items-center gap-3 px-5 py-3 rounded-2xl border-2 border-dashed transition-all duration-300 ${
            hasSelection
              ? "border-purple-primary/40 bg-gradient-to-r from-purple-primary/5 to-pink-vivid/5"
              : "border-black/10 hover:border-purple-primary/30 hover:bg-purple-primary/[0.02]"
          }`}
        >
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            hasSelection
              ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/25"
              : "bg-black/[0.04] text-muted group-hover:bg-purple-primary/10 group-hover:text-purple-primary"
          }`}>
            {selectedCollection ? (
              renderCollectionIcon(selectedCollection)
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            )}
          </div>

          {/* Text Content */}
          <div className="text-left">
            {hasSelection ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-ui text-[0.9rem] font-medium text-ink">
                    {selectedCollection?.name}
                  </span>
                  {selectedItem && (
                    <>
                      <svg className="w-3 h-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="font-ui text-[0.85rem] text-purple-primary">
                        {selectedItem.name}
                      </span>
                    </>
                  )}
                </div>
                <p className="font-body text-[0.75rem] text-muted">
                  {selectedItem ? "Adding to this item" : "Adding to collection"}
                </p>
              </>
            ) : (
              <>
                <span className="font-ui text-[0.9rem] font-medium text-ink group-hover:text-purple-primary transition-colors">
                  Add to Collection
                </span>
                <p className="font-body text-[0.75rem] text-muted">
                  Organize your post
                </p>
              </>
            )}
          </div>

          {/* Chevron / Clear */}
          <div className="ml-auto pl-3">
            {hasSelection ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCollection(null);
                  onSelectItem(null);
                }}
                className="w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            ) : (
              <svg className={`w-5 h-5 text-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </button>

        {/* Expanded Panel */}
        {isExpanded && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl shadow-black/10 border border-black/[0.06] overflow-hidden z-50 animate-fadeIn">
            {/* Two Column Layout */}
            <div className="flex min-h-[280px] max-h-[400px]">
              {/* Collections Column */}
              <div className="w-1/2 border-r border-black/[0.06] flex flex-col">
                <div className="px-4 py-3 border-b border-black/[0.06] bg-gradient-to-r from-purple-primary/5 to-transparent">
                  <h4 className="font-ui text-[0.8rem] font-semibold text-purple-primary uppercase tracking-wide">
                    Collections
                  </h4>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {/* Create New */}
                  <button
                    onClick={() => {
                      setIsExpanded(false);
                      setShowNewCollectionModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-purple-primary hover:bg-purple-primary/5 transition-all mb-1"
                  >
                    <div className="w-8 h-8 rounded-lg border-2 border-dashed border-purple-primary/40 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <span className="font-ui text-[0.85rem] font-medium">New Collection</span>
                  </button>

                  {/* No Collection */}
                  <button
                    onClick={() => {
                      onSelectCollection(null);
                      onSelectItem(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      !selectedCollection
                        ? "bg-purple-primary/10 text-purple-primary"
                        : "text-muted hover:bg-black/[0.03]"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-black/[0.04] flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <span className="font-ui text-[0.85rem]">None</span>
                  </button>

                  {/* Loading */}
                  {loading && (
                    <div className="py-8 text-center">
                      <div className="w-6 h-6 mx-auto border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Collections List */}
                  {!loading && collections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => {
                        onSelectCollection(collection);
                        onSelectItem(null);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        selectedCollection?.id === collection.id
                          ? "bg-purple-primary/10"
                          : "hover:bg-black/[0.03]"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
                        {renderCollectionIcon(collection)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className={`block font-ui text-[0.85rem] truncate ${
                          selectedCollection?.id === collection.id ? "text-purple-primary font-medium" : "text-ink"
                        }`}>
                          {collection.name}
                        </span>
                        <span className="text-[0.7rem] text-muted">
                          {collection.items_count || 0} items
                        </span>
                      </div>
                      {selectedCollection?.id === collection.id && (
                        <svg className="w-4 h-4 text-purple-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Column */}
              <div className="w-1/2 flex flex-col">
                <div className="px-4 py-3 border-b border-black/[0.06] bg-gradient-to-r from-orange-warm/5 to-transparent">
                  <h4 className="font-ui text-[0.8rem] font-semibold text-orange-warm uppercase tracking-wide">
                    {selectedCollection ? `Items in ${selectedCollection.name}` : "Select a Collection"}
                  </h4>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {!selectedCollection ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                      <div className="w-12 h-12 rounded-2xl bg-black/[0.04] flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                      </div>
                      <p className="font-body text-[0.8rem] text-muted">
                        Select a collection first to choose an item
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Create New Item */}
                      <button
                        onClick={() => {
                          setIsExpanded(false);
                          setShowNewItemModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-orange-warm hover:bg-orange-warm/5 transition-all mb-1"
                      >
                        <div className="w-8 h-8 rounded-lg border-2 border-dashed border-orange-warm/40 flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <span className="font-ui text-[0.85rem] font-medium">New Item</span>
                      </button>

                      {/* No Item (Collection Only) */}
                      <button
                        onClick={() => onSelectItem(null)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                          !selectedItem
                            ? "bg-orange-warm/10 text-orange-warm"
                            : "text-muted hover:bg-black/[0.03]"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-black/[0.04] flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </div>
                        <span className="font-ui text-[0.85rem]">Collection only</span>
                      </button>

                      {/* Items List */}
                      {selectedCollectionItems.length === 0 && (
                        <div className="py-8 text-center">
                          <p className="font-body text-[0.8rem] text-muted">
                            No items yet
                          </p>
                        </div>
                      )}

                      {selectedCollectionItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onSelectItem(item)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                            selectedItem?.id === item.id
                              ? "bg-orange-warm/10"
                              : "hover:bg-black/[0.03]"
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-orange-warm/10 to-pink-vivid/10 flex items-center justify-center">
                            {item.cover_url ? (
                              <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <svg className="w-4 h-4 text-orange-warm/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <span className={`block font-ui text-[0.85rem] truncate ${
                              selectedItem?.id === item.id ? "text-orange-warm font-medium" : "text-ink"
                            }`}>
                              {item.name}
                            </span>
                            <span className="text-[0.7rem] text-muted">
                              {item.posts_count || 0} posts
                            </span>
                          </div>
                          {selectedItem?.id === item.id && (
                            <svg className="w-4 h-4 text-orange-warm" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-black/[0.06] bg-black/[0.02] flex justify-end">
              <button
                onClick={() => setIsExpanded(false)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-[0.85rem] font-medium shadow-lg shadow-purple-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                Done
              </button>
            </div>
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
