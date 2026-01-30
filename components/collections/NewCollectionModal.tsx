"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateCollection } from "@/lib/hooks/useCollections";
import { supabase } from "@/lib/supabase";
import type { Collection } from "@/lib/types";

interface NewCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (collection: Collection) => void;
}

// Common emoji options for collections
const emojiOptions = [
  { emoji: "1F4DA", label: "Books" },
  { emoji: "1F3B5", label: "Music" },
  { emoji: "1F3A8", label: "Art" },
  { emoji: "270D", label: "Writing" },
  { emoji: "1F4F7", label: "Photos" },
  { emoji: "1F3AC", label: "Videos" },
  { emoji: "1F4DD", label: "Notes" },
  { emoji: "2764", label: "Favorites" },
  { emoji: "1F31F", label: "Featured" },
  { emoji: "1F4C1", label: "Folder" },
  { emoji: "1F4CC", label: "Pinned" },
  { emoji: "1F4A1", label: "Ideas" },
];

export default function NewCollectionModal({ isOpen, onClose, onCreated }: NewCollectionModalProps) {
  const { user } = useAuth();
  const { createCollection, creating, error } = useCreateCollection(user?.id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconEmoji, setIconEmoji] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setIconEmoji(null);
      setIconUrl(null);
      setShowEmojiPicker(false);
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

  const handleIconUpload = async (file: File) => {
    if (!user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `collection-icon-${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `collections/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("media")
        .getPublicUrl(filePath);

      setIconUrl(publicUrl);
      setIconEmoji(null);
    } catch (err: any) {
      console.error("Failed to upload icon:", err?.message || err);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const collection = await createCollection(name.trim(), {
      description: description.trim() || undefined,
      iconUrl: iconUrl || undefined,
      iconEmoji: iconEmoji || undefined,
    });

    if (collection) {
      onCreated(collection);
      onClose();
    }
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
        <div className="px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">New Collection</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.05] transition-colors"
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
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 border-2 border-dashed border-purple-primary/30 flex items-center justify-center hover:border-purple-primary/50 transition-all group"
              >
                {iconUrl ? (
                  <img src={iconUrl} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : iconEmoji ? (
                  <span className="text-4xl">{String.fromCodePoint(parseInt(iconEmoji, 16))}</span>
                ) : (
                  <svg className="w-8 h-8 text-purple-primary/50 group-hover:text-purple-primary/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </button>

              {/* Emoji Picker Dropdown */}
              {showEmojiPicker && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-3 bg-white rounded-xl shadow-xl border border-black/[0.06] z-10">
                  <div className="grid grid-cols-6 gap-2 mb-3">
                    {emojiOptions.map((option) => (
                      <button
                        key={option.emoji}
                        type="button"
                        onClick={() => {
                          setIconEmoji(option.emoji);
                          setIconUrl(null);
                          setShowEmojiPicker(false);
                        }}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-purple-primary/10 transition-colors ${
                          iconEmoji === option.emoji ? "bg-purple-primary/20" : ""
                        }`}
                        title={option.label}
                      >
                        <span className="text-xl">{String.fromCodePoint(parseInt(option.emoji, 16))}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmojiPicker(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full py-2 text-center text-sm text-purple-primary hover:bg-purple-primary/5 rounded-lg transition-colors"
                  >
                    Upload custom icon
                  </button>
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

          {/* Name Input */}
          <div>
            <label className="block font-ui text-sm font-medium text-ink mb-1.5">
              Collection Name <span className="text-pink-vivid">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Music, Books, Writings..."
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
              placeholder="What will this collection contain?"
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
              {creating ? "Creating..." : "Create Collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
