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

  const renderCollectionIcon = (collection: Collection, size: "sm" | "md" = "sm") => {
    const sizeClass = size === "md" ? "w-10 h-10" : "w-7 h-7";
    const textSize = size === "md" ? "text-xl" : "text-base";
    const letterSize = size === "md" ? "text-sm" : "text-xs";

    if (collection.icon_url) {
      return (
        <img
          src={collection.icon_url}
          alt=""
          className={`${sizeClass} rounded-lg object-cover`}
        />
      );
    }
    if (collection.icon_emoji) {
      return (
        <span className={`${textSize} leading-none`}>
          {String.fromCodePoint(parseInt(collection.icon_emoji, 16))}
        </span>
      );
    }
    return (
      <div className={`${sizeClass} rounded-lg bg-purple-primary/15 flex items-center justify-center text-purple-primary ${letterSize} font-semibold`}>
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
      <div ref={containerRef} className="relative w-full max-w-2xl">
        {/* Main Trigger Button - Full Width */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl border transition-all duration-200 ${
            hasSelection
              ? "border-purple-primary/30 bg-purple-primary/[0.03]"
              : "border-black/10 hover:border-purple-primary/20 bg-white"
          }`}
        >
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            hasSelection
              ? "bg-purple-primary/10"
              : "bg-black/[0.03]"
          }`}>
            {selectedCollection ? (
              renderCollectionIcon(selectedCollection, "md")
            ) : (
              <svg className="w-6 h-6 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1 text-left min-w-0">
            {hasSelection ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-ui text-base font-medium text-ink">
                    {selectedCollection?.name}
                  </span>
                  {selectedItem && (
                    <>
                      <span className="text-muted">/</span>
                      <span className="font-ui text-base text-purple-primary font-medium">
                        {selectedItem.name}
                      </span>
                    </>
                  )}
                </div>
                <p className="font-body text-sm text-muted mt-0.5">
                  {selectedItem ? "Post will be added to this item" : "Post will be added to this collection"}
                </p>
              </>
            ) : (
              <>
                <span className="font-ui text-base font-medium text-ink">
                  Add to Collection
                </span>
                <p className="font-body text-sm text-muted mt-0.5">
                  Organize your post into a collection or item
                </p>
              </>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasSelection && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCollection(null);
                  onSelectItem(null);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-pink-vivid hover:bg-pink-vivid/10 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-black/[0.03] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </button>

        {/* Expanded Panel - Full Width */}
        {isExpanded && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-black/[0.08] overflow-hidden z-50">
            {/* Two Column Layout */}
            <div className="flex min-h-[320px] max-h-[420px]">
              {/* Collections Column */}
              <div className="w-1/2 border-r border-black/[0.06] flex flex-col">
                <div className="px-5 py-3 border-b border-black/[0.06]">
                  <h4 className="font-ui text-sm font-semibold text-ink">
                    Collections
                  </h4>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {/* Create New Collection */}
                  <button
                    onClick={() => {
                      setIsExpanded(false);
                      setShowNewCollectionModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-purple-primary hover:bg-purple-primary/5 transition-colors mb-2"
                  >
                    <div className="w-10 h-10 rounded-xl border-2 border-dashed border-purple-primary/30 flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <span className="font-ui text-sm font-medium">New Collection</span>
                  </button>

                  {/* Divider */}
                  <div className="h-px bg-black/[0.06] my-2" />

                  {/* No Collection Option */}
                  <button
                    onClick={() => {
                      onSelectCollection(null);
                      onSelectItem(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      !selectedCollection
                        ? "bg-purple-primary/10"
                        : "hover:bg-black/[0.02]"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-black/[0.04] flex items-center justify-center">
                      <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <span className={`font-ui text-sm ${!selectedCollection ? "text-purple-primary font-medium" : "text-ink"}`}>
                        No Collection
                      </span>
                      <p className="font-body text-xs text-muted">Post without organizing</p>
                    </div>
                    {!selectedCollection && (
                      <svg className="w-5 h-5 text-purple-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
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
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        selectedCollection?.id === collection.id
                          ? "bg-purple-primary/10"
                          : "hover:bg-black/[0.02]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-primary/5 flex items-center justify-center">
                        {renderCollectionIcon(collection, "md")}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <span className={`block font-ui text-sm truncate ${
                          selectedCollection?.id === collection.id ? "text-purple-primary font-medium" : "text-ink"
                        }`}>
                          {collection.name}
                        </span>
                        <span className="text-xs text-muted">
                          {collection.items_count || 0} items
                        </span>
                      </div>
                      {selectedCollection?.id === collection.id && (
                        <svg className="w-5 h-5 text-purple-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items Column */}
              <div className="w-1/2 flex flex-col bg-black/[0.01]">
                <div className="px-5 py-3 border-b border-black/[0.06]">
                  <h4 className="font-ui text-sm font-semibold text-ink">
                    {selectedCollection ? "Items" : "Select Collection First"}
                  </h4>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {!selectedCollection ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6">
                      <div className="w-14 h-14 rounded-2xl bg-black/[0.04] flex items-center justify-center mb-4">
                        <svg className="w-7 h-7 text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                      </div>
                      <p className="font-body text-sm text-muted">
                        Choose a collection to see its items
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
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-pink-vivid hover:bg-pink-vivid/5 transition-colors mb-2"
                      >
                        <div className="w-10 h-10 rounded-xl border-2 border-dashed border-pink-vivid/30 flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <span className="font-ui text-sm font-medium">New Item</span>
                      </button>

                      {/* Divider */}
                      <div className="h-px bg-black/[0.06] my-2" />

                      {/* Collection Only Option */}
                      <button
                        onClick={() => onSelectItem(null)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                          !selectedItem
                            ? "bg-pink-vivid/10"
                            : "hover:bg-black/[0.02]"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-black/[0.04] flex items-center justify-center">
                          <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </div>
                        <div className="flex-1 text-left">
                          <span className={`font-ui text-sm ${!selectedItem ? "text-pink-vivid font-medium" : "text-ink"}`}>
                            Collection Root
                          </span>
                          <p className="font-body text-xs text-muted">Add directly to collection</p>
                        </div>
                        {!selectedItem && (
                          <svg className="w-5 h-5 text-pink-vivid" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>

                      {/* Empty State */}
                      {selectedCollectionItems.length === 0 && (
                        <div className="py-8 text-center">
                          <p className="font-body text-sm text-muted">
                            No items in this collection
                          </p>
                        </div>
                      )}

                      {/* Items List */}
                      {selectedCollectionItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onSelectItem(item)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                            selectedItem?.id === item.id
                              ? "bg-pink-vivid/10"
                              : "hover:bg-black/[0.02]"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-pink-vivid/5 flex items-center justify-center flex-shrink-0">
                            {item.cover_url ? (
                              <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <svg className="w-5 h-5 text-pink-vivid/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <span className={`block font-ui text-sm truncate ${
                              selectedItem?.id === item.id ? "text-pink-vivid font-medium" : "text-ink"
                            }`}>
                              {item.name}
                            </span>
                            <span className="text-xs text-muted">
                              {item.posts_count || 0} posts
                            </span>
                          </div>
                          {selectedItem?.id === item.id && (
                            <svg className="w-5 h-5 text-pink-vivid flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
            <div className="px-5 py-4 border-t border-black/[0.06] flex items-center justify-between">
              <p className="font-body text-xs text-muted">
                {selectedCollection
                  ? selectedItem
                    ? `Saving to ${selectedCollection.name} / ${selectedItem.name}`
                    : `Saving to ${selectedCollection.name}`
                  : "No collection selected"
                }
              </p>
              <button
                onClick={() => setIsExpanded(false)}
                className="px-5 py-2 rounded-xl bg-purple-primary text-white font-ui text-sm font-medium hover:bg-purple-primary/90 transition-colors"
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
