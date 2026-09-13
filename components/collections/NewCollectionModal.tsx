"use client";

import { useDialog } from "@/lib/hooks/useDialog";
import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCollectionMutations } from "@/lib/hooks/useCollections";
import { brandedIcons } from "./collectionIcons";
import Portal from "@/components/ui/Portal";
import { supabase } from "@/lib/supabase";
import type { Collection } from "@/lib/types";

interface NewCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fires with the saved row, for a new collection and for an edit. */
  onSaved: (collection: Collection) => void;
  /** Pass the row to edit it; leave out to start a new collection. */
  collection?: Collection | null;
  parentId?: string;
}

// Icons (stored as icon_emoji with "icon:" prefix)


// Emoji options organized by category
const emojiCategories = [
  {
    name: "Creative",
    emojis: [
      { emoji: "1F3A8", label: "Art" },
      { emoji: "1F58C", label: "Paintbrush" },
      { emoji: "270D", label: "Writing" },
      { emoji: "1F4DD", label: "Notes" },
      { emoji: "1F4D6", label: "Open Book" },
      { emoji: "1F4DA", label: "Books" },
      { emoji: "1F4D3", label: "Notebook" },
      { emoji: "1F4DC", label: "Scroll" },
    ],
  },
  {
    name: "Media",
    emojis: [
      { emoji: "1F3B5", label: "Music" },
      { emoji: "1F3B6", label: "Notes" },
      { emoji: "1F3A4", label: "Microphone" },
      { emoji: "1F3AC", label: "Clapper" },
      { emoji: "1F4F7", label: "Camera" },
      { emoji: "1F4F9", label: "Video" },
      { emoji: "1F4FA", label: "TV" },
      { emoji: "1F3A5", label: "Film" },
    ],
  },
  {
    name: "Objects",
    emojis: [
      { emoji: "1F4C1", label: "Folder" },
      { emoji: "1F4CC", label: "Pin" },
      { emoji: "1F4A1", label: "Lightbulb" },
      { emoji: "2B50", label: "Star" },
      { emoji: "1F31F", label: "Glowing Star" },
      { emoji: "1F48E", label: "Gem" },
      { emoji: "1F381", label: "Gift" },
      { emoji: "1F3C6", label: "Trophy" },
    ],
  },
  {
    name: "Nature",
    emojis: [
      { emoji: "1F33B", label: "Sunflower" },
      { emoji: "1F33A", label: "Hibiscus" },
      { emoji: "1F337", label: "Tulip" },
      { emoji: "1F341", label: "Maple Leaf" },
      { emoji: "1F334", label: "Palm Tree" },
      { emoji: "1F308", label: "Rainbow" },
      { emoji: "2600", label: "Sun" },
      { emoji: "1F319", label: "Moon" },
    ],
  },
  {
    name: "Symbols",
    emojis: [
      { emoji: "2764", label: "Heart" },
      { emoji: "1F499", label: "Blue Heart" },
      { emoji: "1F49C", label: "Purple Heart" },
      { emoji: "1F9E1", label: "Orange Heart" },
      { emoji: "2728", label: "Sparkles" },
      { emoji: "1F525", label: "Fire" },
      { emoji: "1F4AB", label: "Dizzy" },
      { emoji: "1F300", label: "Cyclone" },
    ],
  },
  {
    name: "Activities",
    emojis: [
      { emoji: "1F3AE", label: "Gaming" },
      { emoji: "1F3B2", label: "Dice" },
      { emoji: "1F3AF", label: "Target" },
      { emoji: "1F9E9", label: "Puzzle" },
      { emoji: "1F3C3", label: "Running" },
      { emoji: "1F6B4", label: "Cycling" },
      { emoji: "1F3CA", label: "Swimming" },
      { emoji: "1F9D8", label: "Yoga" },
    ],
  },
  {
    name: "Food",
    emojis: [
      { emoji: "2615", label: "Coffee" },
      { emoji: "1F375", label: "Tea" },
      { emoji: "1F370", label: "Cake" },
      { emoji: "1F36D", label: "Lollipop" },
      { emoji: "1F353", label: "Strawberry" },
      { emoji: "1F352", label: "Cherries" },
      { emoji: "1F34E", label: "Apple" },
      { emoji: "1F96A", label: "Sandwich" },
    ],
  },
  {
    name: "Travel",
    emojis: [
      { emoji: "2708", label: "Airplane" },
      { emoji: "1F3D6", label: "Beach" },
      { emoji: "1F3D4", label: "Mountain" },
      { emoji: "1F3E0", label: "House" },
      { emoji: "1F5FC", label: "Tower" },
      { emoji: "1F30D", label: "Globe" },
      { emoji: "1F697", label: "Car" },
      { emoji: "1F6A2", label: "Ship" },
    ],
  },
];

export default function NewCollectionModal({ isOpen, onClose, onSaved, collection = null, parentId }: NewCollectionModalProps) {
  const { user } = useAuth();
  const { saveCollection, busy: creating, error } = useCollectionMutations();
  const editing = !!collection;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconEmoji, setIconEmoji] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const retryUpload = useRef<(() => void) | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Seed from the row being edited when opening; clear on close.
  useEffect(() => {
    setUploadError(null);
    retryUpload.current = null;
    setShowEmojiPicker(false);
    if (isOpen && collection) {
      setName(collection.name);
      setDescription(collection.description ?? "");
      setIconEmoji(collection.icon_emoji);
      setIconUrl(collection.icon_url);
      setCoverUrl(collection.cover_url);
    } else if (!isOpen) {
      setName("");
      setDescription("");
      setIconEmoji(null);
      setIconUrl(null);
      setCoverUrl(null);
    }
  }, [isOpen, collection]);

  useDialog(isOpen, modalRef, onClose, creating || uploading || uploadingCover);

  // Handle click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !(creating || uploading || uploadingCover)) {
      onClose();
    }
  };

  const handleIconUpload = async (file: File) => {
    if (!user) return;

    setUploadError(null);
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/collections/icon-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("covers")
        .getPublicUrl(fileName);

      setIconUrl(publicUrl);
      setIconEmoji(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to upload icon:", message);
      setUploadError("Couldn’t upload icon. Please try again.");
      retryUpload.current = () => { void handleIconUpload(file); };
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleIconUpload(file);
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!user) return;

    setUploadError(null);
    setUploadingCover(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/collections/cover-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("covers")
        .getPublicUrl(fileName);

      setCoverUrl(publicUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to upload cover:", message);
      setUploadError("Couldn’t upload cover. Please try again.");
      retryUpload.current = () => { void handleCoverUpload(file); };
    } finally {
      setUploadingCover(false);
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleCoverUpload(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const saved = await saveCollection({
      parentId: collection?.parent_id ?? parentId,
      id: collection?.id,
      name: name.trim(),
      description: description.trim() || null,
      iconUrl: iconUrl || null,
      iconEmoji: iconEmoji || null,
      coverUrl: coverUrl || null,
    });

    if (saved) {
      onSaved(saved);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
    <div
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit collection" : parentId ? "New subcollection" : "New collection"}
        tabIndex={-1}
        className="w-full max-w-md bg-surface rounded-2xl shadow-2xl overflow-hidden animate-scaleIn"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-light flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">{editing ? "Edit collection" : parentId ? "New subcollection" : "New collection"}</h2>
          <button
            onClick={onClose}
              disabled={creating || uploading || uploadingCover}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Icon Selector */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 border-2 border-dashed border-purple-200 flex items-center justify-center hover:border-accent/50 transition-all group"
              >
                {iconUrl ? (
                  <img src={iconUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : iconEmoji?.startsWith("icon:") ? (
                  <div className="w-10 h-10 text-purple-primary">
                    {brandedIcons.find(i => i.id === iconEmoji)?.icon}
                  </div>
                ) : iconEmoji ? (
                  <span className="text-4xl">
                    {/^[0-9A-Fa-f]+$/.test(iconEmoji) ? String.fromCodePoint(parseInt(iconEmoji, 16)) : iconEmoji}
                  </span>
                ) : (
                  <svg className="w-8 h-8 text-purple-primary/50 group-hover:text-accent/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </button>

              {/* Emoji & Icon Picker Dropdown */}
              {showEmojiPicker && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-surface rounded-2xl shadow-xl border border-border-light z-10 overflow-hidden">
                  {/* Scrollable content */}
                  <div className="max-h-80 overflow-y-auto p-4">
                    {/* Icons Section */}
                    <div className="mb-4">
                      <p className="font-ui text-xs font-medium text-purple-primary mb-2 flex items-center gap-1.5">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>
                        </svg>
                        Icons
                      </p>
                      <div className="grid grid-cols-8 gap-1">
                        {brandedIcons.map((icon) => (
                          <button
                            key={icon.id}
                            type="button"
                            onClick={() => {
                              setIconEmoji(icon.id);
                              setIconUrl(null);
                              setShowEmojiPicker(false);
                            }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-purple-50 transition-colors text-purple-primary ${
                              iconEmoji === icon.id ? "bg-purple-primary/20 ring-2 ring-purple-primary/30" : ""
                            }`}
                            title={icon.label}
                          >
                            {icon.icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-black/10 to-transparent mb-4" />

                    {/* Emoji Categories */}
                    {emojiCategories.map((category, categoryIndex) => (
                      <div key={category.name} className={categoryIndex > 0 ? "mt-4" : ""}>
                        <p className="font-ui text-xs font-medium text-muted mb-2">
                          {category.name}
                        </p>
                        <div className="grid grid-cols-8 gap-1">
                          {category.emojis.map((option) => (
                            <button
                              key={option.emoji}
                              type="button"
                              onClick={() => {
                                setIconEmoji(option.emoji);
                                setIconUrl(null);
                                setShowEmojiPicker(false);
                              }}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-purple-50 transition-colors ${
                                iconEmoji === option.emoji ? "bg-purple-primary/20 ring-2 ring-purple-primary/30" : ""
                              }`}
                              title={option.label}
                            >
                              <span className="text-lg">
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

                  {/* Upload custom icon button */}
                  <div className="border-t border-border-light p-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full py-2.5 text-center text-sm font-medium text-purple-primary hover:bg-accent/5 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Upload custom image
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <p className="text-[0.75rem] text-muted">Click to choose icon</p>
          </div>

          {/* Cover Image Upload */}
          <div>
            <label className="block font-ui text-sm font-medium text-ink mb-1.5">
              Cover Image <span className="text-muted text-xs">(optional)</span>
            </label>
            <div
              onClick={() => coverInputRef.current?.click()}
              className={`relative w-full h-32 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden transition-all ${
                coverUrl
                  ? "border-purple-200"
                  : "border-border-strong hover:border-accent/30"
              }`}
            >
              {coverUrl ? (
                <>
                  <img
                    src={coverUrl}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-ui text-sm font-medium">Change cover</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCoverUrl(null);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted">
                  {uploadingCover ? (
                    <div className="w-6 h-6 border-2 border-purple-200 border-t-purple-primary rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-ui">Click to upload cover image</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverFileChange}
              className="hidden"
            />
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
              placeholder="e.g. Mornings, Notes to dancers"
              className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface font-body text-15 text-ink placeholder:text-muted/50 focus:outline-none focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 transition-all"
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
              placeholder="What gathers these works together?"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-border-light bg-surface font-body text-15 text-ink placeholder:text-muted/50 focus:outline-none focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 transition-all resize-none"
            />
          </div>

          {/* Error Message */}
          {uploadError && (
            <div role="alert" className="font-ui text-sm text-red-500">
              <p>{uploadError}</p>
              <button type="button" disabled={creating || uploading || uploadingCover} onClick={() => retryUpload.current?.()} className="py-2 underline underline-offset-2">Try again</button>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={creating || uploading || uploadingCover}
              className="flex-1 px-5 py-2.5 rounded-xl border border-border-light font-ui text-[0.9rem] text-muted hover:text-ink hover:border-border-strong transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || creating || uploading || uploadingCover}
              className="flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.9rem] font-medium text-white shadow-lg shadow-purple-primary/30 hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {creating ? "Saving…" : editing ? "Save" : parentId ? "Create subcollection" : "Create collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
