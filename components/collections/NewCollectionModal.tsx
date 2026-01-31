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

// Icons (stored as icon_emoji with "icon:" prefix)
const brandedIcons = [
  // Row 1 - Creative
  { id: "icon:quill", label: "Quill", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
      <line x1="16" y1="8" x2="2" y2="22"/>
    </svg>
  )},
  { id: "icon:sparkle", label: "Sparkle", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>
      <path d="M5 3l.5 2L7 5.5 5.5 6 5 8l-.5-2L3 5.5 4.5 5 5 3z"/>
      <path d="M19 17l.5 2 1.5.5-1.5.5-.5 2-.5-2-1.5-.5 1.5-.5.5-2z"/>
    </svg>
  )},
  { id: "icon:heart", label: "Heart", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
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
  { id: "icon:camera", label: "Camera", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  )},
  { id: "icon:folder", label: "Folder", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  )},
  { id: "icon:star", label: "Star", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )},
  // Row 2 - More icons
  { id: "icon:pen", label: "Pen", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z"/>
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      <path d="M2 2l7.586 7.586"/>
      <circle cx="11" cy="11" r="2"/>
    </svg>
  )},
  { id: "icon:palette", label: "Palette", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="1.5"/>
      <circle cx="17.5" cy="10.5" r="1.5"/>
      <circle cx="8.5" cy="7.5" r="1.5"/>
      <circle cx="6.5" cy="12.5" r="1.5"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  )},
  { id: "icon:bookmark", label: "Bookmark", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  )},
  { id: "icon:layers", label: "Layers", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  )},
  { id: "icon:globe", label: "Globe", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )},
  { id: "icon:lightning", label: "Lightning", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )},
  { id: "icon:sun", label: "Sun", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )},
  { id: "icon:moon", label: "Moon", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )},
  // Row 3 - More variety
  { id: "icon:gift", label: "Gift", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12"/>
      <rect x="2" y="7" width="20" height="5"/>
      <line x1="12" y1="22" x2="12" y2="7"/>
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
    </svg>
  )},
  { id: "icon:crown", label: "Crown", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>
      <path d="M3 20h18"/>
    </svg>
  )},
  { id: "icon:compass", label: "Compass", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  )},
  { id: "icon:film", label: "Film", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="17" x2="22" y2="17"/>
      <line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  )},
  { id: "icon:headphones", label: "Headphones", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  )},
  { id: "icon:coffee", label: "Coffee", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/>
      <line x1="10" y1="1" x2="10" y2="4"/>
      <line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  )},
  { id: "icon:award", label: "Award", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/>
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  )},
  { id: "icon:diamond", label: "Diamond", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 9 12 22 22 9 12 2"/>
      <line x1="2" y1="9" x2="22" y2="9"/>
      <line x1="12" y1="2" x2="8" y2="9"/>
      <line x1="12" y1="2" x2="16" y2="9"/>
      <line x1="8" y1="9" x2="12" y2="22"/>
      <line x1="16" y1="9" x2="12" y2="22"/>
    </svg>
  )},
];

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

export default function NewCollectionModal({ isOpen, onClose, onCreated }: NewCollectionModalProps) {
  const { user } = useAuth();
  const { createCollection, creating, error } = useCreateCollection(user?.id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconEmoji, setIconEmoji] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setName("");
      setDescription("");
      setIconEmoji(null);
      setIconUrl(null);
      setCoverUrl(null);
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

      const { error: uploadError } = await supabase.storage
        .from("covers")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("covers")
        .getPublicUrl(fileName);

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

  const handleCoverUpload = async (file: File) => {
    if (!user) return;

    setUploadingCover(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `collection-cover-${user.id}-${Date.now()}.${fileExt}`;

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

    const collection = await createCollection(name.trim(), {
      description: description.trim() || undefined,
      iconUrl: iconUrl || undefined,
      iconEmoji: iconEmoji || undefined,
      coverUrl: coverUrl || undefined,
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
                ) : iconEmoji?.startsWith("icon:") ? (
                  <div className="w-10 h-10 text-purple-primary">
                    {brandedIcons.find(i => i.id === iconEmoji)?.icon}
                  </div>
                ) : iconEmoji ? (
                  <span className="text-4xl">{String.fromCodePoint(parseInt(iconEmoji, 16))}</span>
                ) : (
                  <svg className="w-8 h-8 text-purple-primary/50 group-hover:text-purple-primary/70 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </button>

              {/* Emoji & Icon Picker Dropdown */}
              {showEmojiPicker && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-black/[0.08] z-10 overflow-hidden">
                  {/* Scrollable content */}
                  <div className="max-h-80 overflow-y-auto p-4">
                    {/* Icons Section */}
                    <div className="mb-4">
                      <p className="font-ui text-xs font-medium text-purple-primary uppercase tracking-wide mb-2 flex items-center gap-1.5">
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
                            className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-purple-primary/10 transition-colors text-purple-primary ${
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
                        <p className="font-ui text-xs font-medium text-muted uppercase tracking-wide mb-2">
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
                              className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-purple-primary/10 transition-colors ${
                                iconEmoji === option.emoji ? "bg-purple-primary/20 ring-2 ring-purple-primary/30" : ""
                              }`}
                              title={option.label}
                            >
                              <span className="text-lg">{String.fromCodePoint(parseInt(option.emoji, 16))}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Upload custom icon button */}
                  <div className="border-t border-black/[0.06] p-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full py-2.5 text-center text-sm font-medium text-purple-primary hover:bg-purple-primary/5 rounded-xl transition-colors flex items-center justify-center gap-2"
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
                  ? "border-purple-primary/30"
                  : "border-black/[0.12] hover:border-purple-primary/30"
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
                    <div className="w-6 h-6 border-2 border-purple-primary/30 border-t-purple-primary rounded-full animate-spin" />
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
              disabled={!name.trim() || creating || uploading || uploadingCover}
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
