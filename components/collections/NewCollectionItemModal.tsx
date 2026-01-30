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
  const [uploading, setUploading] = useState(false);

  // Metadata fields (for different collection types)
  const [metadata, setMetadata] = useState<CollectionItemMetadata>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setCoverUrl(null);
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
      const filePath = `collections/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("media")
        .getPublicUrl(filePath);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const item = await createItem(collection.id, name.trim(), {
      description: description.trim() || undefined,
      coverUrl: coverUrl || undefined,
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
                  <span className="text-base">{String.fromCodePoint(parseInt(collection.icon_emoji, 16))}</span>
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
          {/* Cover Image */}
          <div>
            <label className="block font-ui text-sm font-medium text-ink mb-2">
              Cover Image <span className="text-muted text-xs">(optional)</span>
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative w-full h-32 rounded-xl bg-gradient-to-br from-purple-primary/5 to-pink-vivid/5 border-2 border-dashed border-purple-primary/20 flex items-center justify-center cursor-pointer hover:border-purple-primary/40 transition-all group overflow-hidden"
            >
              {coverUrl ? (
                <>
                  <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-sm font-medium">Change cover</span>
                  </div>
                </>
              ) : uploading ? (
                <div className="flex flex-col items-center gap-2 text-purple-primary">
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">Uploading...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted group-hover:text-purple-primary transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">Click to add cover image</span>
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
