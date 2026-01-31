"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateCollectionItem } from "@/lib/hooks/useCollections";
import { supabase } from "@/lib/supabase";
import type { Collection, CollectionItem, CollectionItemMetadata } from "@/lib/types";

interface NewCollectionItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (item: CollectionItem) => void;
  collection: Collection;
}

// Icons for items
const itemIcons = [
  { id: "icon:quill", label: "Quill", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
      <line x1="16" y1="8" x2="2" y2="22"/>
    </svg>
  )},
  { id: "icon:sparkle", label: "Sparkle", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>
    </svg>
  )},
  { id: "icon:heart", label: "Heart", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )},
  { id: "icon:star", label: "Star", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )},
  { id: "icon:book", label: "Book", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  )},
  { id: "icon:music", label: "Music", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  )},
  { id: "icon:bookmark", label: "Bookmark", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  )},
  { id: "icon:award", label: "Award", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  )},
];

// Emoji options for items
const itemEmojiCategories = [
  {
    name: "Creative",
    emojis: [
      { emoji: "1F3A8", label: "Art" },
      { emoji: "270D", label: "Writing" },
      { emoji: "1F4D6", label: "Open Book" },
      { emoji: "1F4DA", label: "Books" },
      { emoji: "1F3B5", label: "Music" },
      { emoji: "1F3AC", label: "Clapper" },
      { emoji: "1F4F7", label: "Camera" },
      { emoji: "2728", label: "Sparkles" },
    ],
  },
  {
    name: "Symbols",
    emojis: [
      { emoji: "2764", label: "Heart" },
      { emoji: "1F49C", label: "Purple Heart" },
      { emoji: "2B50", label: "Star" },
      { emoji: "1F31F", label: "Glowing Star" },
      { emoji: "1F525", label: "Fire" },
      { emoji: "1F48E", label: "Gem" },
      { emoji: "1F3C6", label: "Trophy" },
      { emoji: "1F451", label: "Crown" },
    ],
  },
  {
    name: "Nature",
    emojis: [
      { emoji: "1F33B", label: "Sunflower" },
      { emoji: "1F33A", label: "Hibiscus" },
      { emoji: "1F308", label: "Rainbow" },
      { emoji: "2600", label: "Sun" },
      { emoji: "1F319", label: "Moon" },
      { emoji: "2615", label: "Coffee" },
      { emoji: "1F375", label: "Tea" },
      { emoji: "1F370", label: "Cake" },
    ],
  },
];

export default function NewCollectionItemModal({
  isOpen,
  onClose,
  onCreated,
  collection
}: NewCollectionItemModalProps) {
  const { user } = useAuth();
  const { createItem, creating, error } = useCreateCollectionItem(user?.id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [iconEmoji, setIconEmoji] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Metadata fields (for different collection types)
  const [metadata, setMetadata] = useState<CollectionItemMetadata>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setCoverUrl(null);
      setIconEmoji(null);
      setShowIconPicker(false);
      setMetadata({});
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `collection-item-cover-${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("covers")
        .getPublicUrl(fileName);

      setCoverUrl(publicUrl);
    } catch (err: any) {
      console.error("Failed to upload cover:", err?.message || err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleCoverUpload(file);
    }
  };

  const handleIconUpload = async (file: File) => {
    if (!user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `collection-item-icon-${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("covers")
        .getPublicUrl(fileName);

      // Store as special icon URL format
      setIconEmoji(`url:${publicUrl}`);
      setShowIconPicker(false);
    } catch (err: any) {
      console.error("Failed to upload icon:", err?.message || err);
    } finally {
      setUploading(false);
    }
  };

  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleIconUpload(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const item = await createItem(collection.id, name.trim(), {
      description: description.trim() || undefined,
      coverUrl: coverUrl || undefined,
      iconEmoji: iconEmoji || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    if (item) {
      onCreated(item);
      onClose();
    }
  };

  // Get placeholder text based on collection name
  const getPlaceholderText = () => {
    const collectionNameLower = collection.name.toLowerCase();
    if (collectionNameLower.includes("music") || collectionNameLower.includes("album")) {
      return "e.g., My Favorite Album, Summer Playlist...";
    }
    if (collectionNameLower.includes("book")) {
      return "e.g., The Great Gatsby, My Reading Journal...";
    }
    if (collectionNameLower.includes("writ") || collectionNameLower.includes("journal")) {
      return "e.g., Travel Journals, Poetry Collection...";
    }
    return "e.g., My Project, Collection Item...";
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Add to Collection</h2>
              <p className="text-sm text-muted flex items-center gap-1.5 mt-0.5">
                <span>Adding to</span>
                {collection.icon_emoji ? (
                  <span className="text-base">
                    {/^[0-9A-Fa-f]+$/.test(collection.icon_emoji)
                      ? String.fromCodePoint(parseInt(collection.icon_emoji, 16))
                      : collection.icon_emoji}
                  </span>
                ) : collection.icon_url ? (
                  <img src={collection.icon_url} alt="" className="w-4 h-4 rounded object-cover" />
                ) : null}
                <span className="font-medium text-purple-primary">{collection.name}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.05] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Icon and Cover Row */}
          <div className="flex gap-4">
            {/* Icon Selector */}
            <div className="flex-shrink-0">
              <label className="block font-ui text-sm font-medium text-ink mb-2">
                Icon
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 border-2 border-dashed border-purple-primary/30 flex items-center justify-center hover:border-purple-primary/50 transition-all group"
                >
                  {iconEmoji?.startsWith("url:") ? (
                    <img src={iconEmoji.replace("url:", "")} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : iconEmoji?.startsWith("icon:") ? (
                    <div className="w-8 h-8 text-purple-primary">
                      {itemIcons.find(i => i.id === iconEmoji)?.icon}
                    </div>
                  ) : iconEmoji ? (
                    <span className="text-2xl">
                      {/^[0-9A-Fa-f]+$/.test(iconEmoji)
                        ? String.fromCodePoint(parseInt(iconEmoji, 16))
                        : iconEmoji}
                    </span>
                  ) : (
                    <svg className="w-6 h-6 text-purple-primary/50 group-hover:text-purple-primary/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  )}
                </button>

                {/* Icon Picker Dropdown */}
                {showIconPicker && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-black/[0.08] z-10 overflow-hidden">
                    <div className="max-h-64 overflow-y-auto p-3">
                      {/* Icons */}
                      <div className="mb-3">
                        <p className="font-ui text-xs font-medium text-purple-primary uppercase tracking-wide mb-2">Icons</p>
                        <div className="grid grid-cols-8 gap-1">
                          {itemIcons.map((icon) => (
                            <button
                              key={icon.id}
                              type="button"
                              onClick={() => {
                                setIconEmoji(icon.id);
                                setShowIconPicker(false);
                              }}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-purple-primary/10 transition-colors text-purple-primary ${
                                iconEmoji === icon.id ? "bg-purple-primary/20 ring-2 ring-purple-primary/30" : ""
                              }`}
                              title={icon.label}
                            >
                              <div className="w-4 h-4">{icon.icon}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="h-px bg-gradient-to-r from-transparent via-black/10 to-transparent mb-3" />

                      {/* Emojis */}
                      {itemEmojiCategories.map((category) => (
                        <div key={category.name} className="mb-3 last:mb-0">
                          <p className="font-ui text-xs font-medium text-muted uppercase tracking-wide mb-1.5">{category.name}</p>
                          <div className="grid grid-cols-8 gap-1">
                            {category.emojis.map((option) => (
                              <button
                                key={option.emoji}
                                type="button"
                                onClick={() => {
                                  setIconEmoji(option.emoji);
                                  setShowIconPicker(false);
                                }}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center hover:bg-purple-primary/10 transition-colors ${
                                  iconEmoji === option.emoji ? "bg-purple-primary/20 ring-2 ring-purple-primary/30" : ""
                                }`}
                                title={option.label}
                              >
                                <span className="text-base">
                                  {/^[0-9A-Fa-f]+$/.test(option.emoji)
                                    ? String.fromCodePoint(parseInt(option.emoji, 16))
                                    : option.emoji}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Upload custom icon */}
                    <div className="border-t border-black/[0.06] p-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowIconPicker(false);
                          iconInputRef.current?.click();
                        }}
                        className="w-full py-2 text-center text-xs font-medium text-purple-primary hover:bg-purple-primary/5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Upload image
                      </button>
                    </div>
                  </div>
                )}

                <input
                  ref={iconInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleIconFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Cover Image */}
            <div className="flex-1">
              <label className="block font-ui text-sm font-medium text-ink mb-2">
                Cover Image <span className="text-muted text-xs">(optional)</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-full h-16 rounded-xl bg-gradient-to-br from-purple-primary/5 to-pink-vivid/5 border-2 border-dashed border-purple-primary/20 flex items-center justify-center cursor-pointer hover:border-purple-primary/40 transition-all group overflow-hidden"
              >
                {coverUrl ? (
                  <>
                    <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-medium">Change</span>
                    </div>
                  </>
                ) : uploading ? (
                  <div className="flex items-center gap-2 text-purple-primary">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-xs">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted group-hover:text-purple-primary transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">Add cover image</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block font-ui text-sm font-medium text-ink mb-1.5">
              Name <span className="text-pink-vivid">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={getPlaceholderText()}
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white font-body text-[0.95rem] text-ink placeholder:text-muted/50 focus:outline-none focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 transition-all"
              required
            />
          </div>

          {/* Description Input */}
          <div>
            <label className="block font-ui text-sm font-medium text-ink mb-1.5">
              Description <span className="text-muted text-xs">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a brief description..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white font-body text-[0.95rem] text-ink placeholder:text-muted/50 focus:outline-none focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 transition-all resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-2.5 rounded-xl border border-black/[0.08] font-ui text-[0.9rem] text-muted hover:text-ink hover:border-black/20 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || creating || uploading}
              className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.9rem] font-medium text-white shadow-lg shadow-purple-primary/30 hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
