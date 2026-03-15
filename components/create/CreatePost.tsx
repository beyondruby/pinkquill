"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunities, useDrafts, useAutoSave, Community, SearchableUser, createNotification, PostDraft } from "@/lib/hooks";
import {
  useCreateTake,
  useSounds,
  useTrendingSounds,
  TakeAspectRatio,
  TakePlaybackSpeed,
  TakeEffect,
  Sound,
} from "@/lib/hooks/useTakes";
import type { CollaboratorWithRole } from "@/components/ui/PeoplePickerModal";
import { PostStyling, JournalMetadata, TextAlignment, LineSpacing, SpotifyTrack, CommunityFlair } from "@/lib/types";
import dynamic from "next/dynamic";

const PeoplePickerModal = dynamic(() => import("@/components/ui/PeoplePickerModal"), { ssr: false });
const FlairPicker = dynamic(() => import("@/components/communities/FlairPicker"), { ssr: false });
const BackgroundPicker = dynamic(() => import("@/components/create/BackgroundPicker"), { ssr: false });
const JournalMetadataPanel = dynamic(() => import("@/components/create/JournalMetadata"), { ssr: false });
const CollectionSelector = dynamic(() => import("@/components/collections/CollectionSelector"), { ssr: false });
import { useAddPostToCollectionItem } from "@/lib/hooks/useCollections";
import type { Collection, CollectionItem } from "@/lib/types";
import DOMPurify from "dompurify";

interface PostTypeOption {
  id: string;
  label: string;
  icon: string;
  placeholder: string;
}

const postTypes: PostTypeOption[] = [
  { id: "thought", label: "Thought", icon: "lightbulb", placeholder: "What's on your mind?" },
  { id: "poem", label: "Poem", icon: "feather", placeholder: "Let your verses flow..." },
  { id: "journal", label: "Journal", icon: "book", placeholder: "Dear diary..." },
  { id: "essay", label: "Essay", icon: "scroll", placeholder: "Begin your exploration..." },
  { id: "blog", label: "Blog", icon: "blog", placeholder: "Share your thoughts with the world..." },
  { id: "story", label: "Story", icon: "bookOpen", placeholder: "Once upon a time..." },
  { id: "letter", label: "Letter", icon: "envelope", placeholder: "Dear reader..." },
  { id: "quote", label: "Quote", icon: "quote", placeholder: "Share words that inspire..." },
  { id: "visual", label: "Visual", icon: "image", placeholder: "Tell the story behind your images..." },
  { id: "take", label: "Take", icon: "video", placeholder: "Share a short video moment..." },
];

const contentWarningPresets = [
  "Sensitive content",
  "Mature themes",
  "Violence",
  "Mental health",
  "Strong language",
];

const MAX_MEDIA_SIZE_BYTES = 50 * 1024 * 1024;

const fontOptions = [
  // Serif fonts - great for literary content
  { id: "default", label: "Crimson Pro", family: "'Crimson Pro', serif" },
  { id: "libre", label: "Libre Baskerville", family: "'Libre Baskerville', serif" },
  { id: "playfair", label: "Playfair Display", family: "'Playfair Display', serif" },
  { id: "lora", label: "Lora", family: "'Lora', serif" },
  { id: "merriweather", label: "Merriweather", family: "'Merriweather', serif" },
  { id: "spectral", label: "Spectral", family: "'Spectral', serif" },
  { id: "eb-garamond", label: "EB Garamond", family: "'EB Garamond', serif" },
  { id: "cormorant", label: "Cormorant Garamond", family: "'Cormorant Garamond', serif" },
  // Sans-serif fonts - clean and modern
  { id: "inter", label: "Inter", family: "'Inter', sans-serif" },
  { id: "josefin", label: "Josefin Sans", family: "'Josefin Sans', sans-serif" },
  { id: "poppins", label: "Poppins", family: "'Poppins', sans-serif" },
  { id: "open-sans", label: "Open Sans", family: "'Open Sans', sans-serif" },
  // Handwriting fonts - personal touch
  { id: "dancing", label: "Dancing Script", family: "'Dancing Script', cursive" },
  { id: "caveat", label: "Caveat", family: "'Caveat', cursive" },
  // Monospace - for code or typewriter effect
  { id: "source-code", label: "Source Code Pro", family: "'Source Code Pro', monospace" },
];

// Take aspect ratio options
const TAKE_ASPECT_RATIOS: { value: TakeAspectRatio; label: string }[] = [
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:5", label: "4:5" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
];

// Take speed options
const TAKE_SPEED_OPTIONS: { value: TakePlaybackSpeed; label: string }[] = [
  { value: 0.25, label: "0.25x" },
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1.0, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2.0, label: "2x" },
  { value: 3.0, label: "3x" },
];

// Take filter options
const TAKE_FILTER_OPTIONS = [
  { name: "none", label: "Normal", style: {} },
  { name: "grayscale", label: "B&W", style: { filter: "grayscale(100%)" } },
  { name: "sepia", label: "Sepia", style: { filter: "sepia(80%)" } },
  { name: "vintage", label: "Vintage", style: { filter: "sepia(30%) contrast(110%) saturate(80%)" } },
  { name: "warm", label: "Warm", style: { filter: "saturate(120%) hue-rotate(-10deg)" } },
  { name: "cool", label: "Cool", style: { filter: "saturate(90%) hue-rotate(20deg)" } },
  { name: "dramatic", label: "Drama", style: { filter: "contrast(130%) saturate(110%)" } },
  { name: "fade", label: "Fade", style: { filter: "contrast(90%) brightness(110%) saturate(80%)" } },
  { name: "vivid", label: "Vivid", style: { filter: "saturate(150%) contrast(110%)" } },
];

const icons: Record<string, React.ReactElement> = {
  video: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  play: (
    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  pause: (
    <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  ),
  lightbulb: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  feather: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  book: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  scroll: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  blog: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  ),
  bookOpen: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  envelope: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  quote: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  ),
  image: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  upload: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  x: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  tag: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  globe: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  lock: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
  bold: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6zM6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
    </svg>
  ),
  italic: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m2 0l-6 16m-2 0h4" />
    </svg>
  ),
  underline: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v7a5 5 0 0010 0V4M5 20h14" />
    </svg>
  ),
  strikethrough: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 4H9a3 3 0 000 6h6a3 3 0 010 6H8M4 12h16" />
    </svg>
  ),
  list: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16M8 6v0M8 12v0M8 18v0" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </svg>
  ),
  orderedList: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  divider: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
    </svg>
  ),
  font: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12l5 8 5-8M9 18h6" />
    </svg>
  ),
  heading: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6v12M20 6v12M4 12h16" />
    </svg>
  ),
  quote2: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
    </svg>
  ),
  textColor: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4L5 20M19 20L12 4M7 16h10" />
    </svg>
  ),
  highlight: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18" />
    </svg>
  ),
  collaborators: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  userTag: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12l2 2-4 4" />
    </svg>
  ),
  plus: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  check: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  background: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  alignLeft: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h14" />
    </svg>
  ),
  alignCenter: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M5 18h14" />
    </svg>
  ),
  alignRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M10 12h10M6 18h14" />
    </svg>
  ),
  alignJustify: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  lineSpacing: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  dropCap: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <text x="2" y="18" fontSize="16" fontFamily="serif" fontWeight="bold">A</text>
      <path d="M14 8h8M14 12h8M14 16h8" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  location: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  spotify: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  ),
  music: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
};

// Color palette for text color and highlighting
const textColors = [
  // Row 1 - White & Very Light
  { id: "white", color: "#ffffff", label: "White" },
  { id: "snow", color: "#f8fafc", label: "Snow" },
  { id: "ivory", color: "#f1f5f9", label: "Ivory" },
  { id: "silver", color: "#e2e8f0", label: "Silver" },
  // Row 2 - Grayscale
  { id: "lightgray", color: "#bbbbbb", label: "Light Gray" },
  { id: "gray", color: "#888888", label: "Gray" },
  { id: "darkgray", color: "#555555", label: "Dark Gray" },
  { id: "black", color: "#1e1e1e", label: "Black" },
  // Row 3 - Warm colors
  { id: "darkred", color: "#991b1b", label: "Dark Red" },
  { id: "red", color: "#dc2626", label: "Red" },
  { id: "orange", color: "#ea580c", label: "Orange" },
  { id: "amber", color: "#d97706", label: "Amber" },
  // Row 4 - Earth & Yellow
  { id: "yellow", color: "#ca8a04", label: "Yellow" },
  { id: "lime", color: "#65a30d", label: "Lime" },
  { id: "green", color: "#16a34a", label: "Green" },
  { id: "emerald", color: "#059669", label: "Emerald" },
  // Row 5 - Cool colors
  { id: "teal", color: "#0d9488", label: "Teal" },
  { id: "cyan", color: "#0891b2", label: "Cyan" },
  { id: "blue", color: "#2563eb", label: "Blue" },
  { id: "indigo", color: "#4f46e5", label: "Indigo" },
  // Row 6 - Purple & Pink
  { id: "violet", color: "#7c3aed", label: "Violet" },
  { id: "purple", color: "#9333ea", label: "Purple" },
  { id: "fuchsia", color: "#c026d3", label: "Fuchsia" },
  { id: "pink", color: "#db2777", label: "Pink" },
  // Row 7 - Light/Pastel colors
  { id: "lightpink", color: "#f9a8d4", label: "Light Pink" },
  { id: "lightpurple", color: "#c4b5fd", label: "Light Purple" },
  { id: "lightblue", color: "#93c5fd", label: "Light Blue" },
  { id: "lightcyan", color: "#67e8f9", label: "Light Cyan" },
  // Row 8 - More Light colors
  { id: "lightgreen", color: "#86efac", label: "Light Green" },
  { id: "lightyellow", color: "#fde047", label: "Light Yellow" },
  { id: "lightorange", color: "#fdba74", label: "Light Orange" },
  { id: "lightrose", color: "#fda4af", label: "Light Rose" },
];

const highlightColors = [
  // Row 1 - Light/White
  { id: "none", color: "transparent", label: "None" },
  { id: "white", color: "#ffffff", label: "White" },
  { id: "lightgray", color: "#f1f5f9", label: "Light Gray" },
  { id: "cream", color: "#fefce8", label: "Cream" },
  // Row 2 - Warm highlights
  { id: "yellow", color: "#fef08a", label: "Yellow" },
  { id: "amber", color: "#fde68a", label: "Amber" },
  { id: "orange", color: "#fed7aa", label: "Orange" },
  { id: "rose", color: "#fda4af", label: "Rose" },
  // Row 3 - Cool highlights
  { id: "lime", color: "#bef264", label: "Lime" },
  { id: "green", color: "#86efac", label: "Green" },
  { id: "cyan", color: "#a5f3fc", label: "Cyan" },
  { id: "blue", color: "#93c5fd", label: "Blue" },
  // Row 4 - Purple/Pink highlights
  { id: "indigo", color: "#a5b4fc", label: "Indigo" },
  { id: "purple", color: "#c4b5fd", label: "Purple" },
  { id: "pink", color: "#f9a8d4", label: "Pink" },
  { id: "lavender", color: "#e9d5ff", label: "Lavender" },
];

interface MediaItem {
  id: string;
  file?: File;
  preview: string;
  caption: string;
  type: "image" | "video";
  isExisting?: boolean;
  media_url?: string;
}

const visibilityOptions = [
  { id: "public", label: "Public", icon: "globe", desc: "Anyone can see" },
  { id: "followers", label: "Followers", icon: "users", desc: "Only followers" },
  { id: "private", label: "Private", icon: "lock", desc: "Only you" },
];

export default function CreatePost() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  // Edit mode
  const editPostId = searchParams.get("edit");
  const isEditing = !!editPostId;
  const [loadingPost, setLoadingPost] = useState(isEditing);
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);

  // Community selection - only fetch when user is loaded
  const communitySlug = searchParams.get("community");
  const { communities: userCommunities, loading: communitiesLoading } = useCommunities(user?.id, 'joined');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);

  // Post flair (for community posts)
  const [selectedFlair, setSelectedFlair] = useState<CommunityFlair | null>(null);

  // Collection selection
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedCollectionItem, setSelectedCollectionItem] = useState<CollectionItem | null>(null);
  const { addPost: addPostToCollectionItem } = useAddPostToCollectionItem();

  // Set community from URL param (wait for auth and communities to load)
  useEffect(() => {
    if (communitySlug && userCommunities.length > 0 && !communitiesLoading && !authLoading) {
      const community = userCommunities.find(c => c.slug === communitySlug);
      if (community) {
        setSelectedCommunity(community);
      }
    }
  }, [communitySlug, userCommunities, communitiesLoading, authLoading]);

  // Clear flair when community changes
  useEffect(() => {
    if (isEditing) return;
    setSelectedFlair(null);
  }, [selectedCommunity?.id, isEditing]);

  // In edit mode, hydrate selected community from loaded membership list when available.
  useEffect(() => {
    if (!isEditing) return;
    if (!editingCommunityId || userCommunities.length === 0) return;
    const matchedCommunity = userCommunities.find((community) => community.id === editingCommunityId);
    if (matchedCommunity) {
      setSelectedCommunity(matchedCommunity);
    }
  }, [editingCommunityId, isEditing, userCommunities]);

  const [selectedType, setSelectedType] = useState("thought");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState("public");
  const isCommunityPost = isEditing
    ? Boolean(selectedCommunity?.id || editingCommunityId)
    : Boolean(selectedCommunity?.id);
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showTextColorMenu, setShowTextColorMenu] = useState(false);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [charCount, setCharCount] = useState(0);

  // Community posts are always public.
  useEffect(() => {
    if (isCommunityPost && visibility !== "public") {
      setVisibility("public");
    }
  }, [isCommunityPost, visibility]);

  // Formatting state
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  // Media
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [deletedMediaIds, setDeletedMediaIds] = useState<string[]>([]);

  // Content Warning
  const [hasContentWarning, setHasContentWarning] = useState(false);
  const [contentWarning, setContentWarning] = useState("");

  // Collaborators & Mentions
  const [collaborators, setCollaborators] = useState<CollaboratorWithRole[]>([]);
  const [taggedPeople, setTaggedPeople] = useState<SearchableUser[]>([]);
  const [showCollaboratorPicker, setShowCollaboratorPicker] = useState(false);
  const [showTagPeoplePicker, setShowTagPeoplePicker] = useState(false);

  // Creative Styling
  const [styling, setStyling] = useState<PostStyling>({});
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [textAlignment, setTextAlignment] = useState<TextAlignment>("left");
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>("normal");
  const [dropCapEnabled, setDropCapEnabled] = useState(false);

  // Journal Metadata
  const [journalMetadata, setJournalMetadata] = useState<JournalMetadata>({});
  const [postLocation, setPostLocation] = useState("");

  // Spotify Track
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [showSpotifyPicker, setShowSpotifyPicker] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);


  // Initial content for edit mode (set after editor mounts)
  const [initialContent, setInitialContent] = useState<string | null>(null);
  const [initialTitle, setInitialTitle] = useState<string | null>(null);

  // Take-specific state
  const [takeVideoFile, setTakeVideoFile] = useState<File | null>(null);
  const [takeVideoPreview, setTakeVideoPreview] = useState<string | null>(null);
  const [takeVideoDuration, setTakeVideoDuration] = useState<number>(0);
  const [takeCaption, setTakeCaption] = useState("");
  const [isTakePreviewPlaying, setIsTakePreviewPlaying] = useState(false);
  const [takeDragActive, setTakeDragActive] = useState(false);
  const [takeValidationError, setTakeValidationError] = useState<string | null>(null);

  // Take creative options
  const [takeAspectRatio, setTakeAspectRatio] = useState<TakeAspectRatio>("9:16");
  const [takePlaybackSpeed, setTakePlaybackSpeed] = useState<TakePlaybackSpeed>(1.0);
  const [takeSelectedFilter, setTakeSelectedFilter] = useState("none");
  const [takeEffects, setTakeEffects] = useState<TakeEffect[]>([]);
  const [takeSelectedSound, setTakeSelectedSound] = useState<Sound | null>(null);
  const [takeSoundStartTime, setTakeSoundStartTime] = useState(0);
  const [takeOriginalVolume, setTakeOriginalVolume] = useState(100);
  const [takeAddedVolume, setTakeAddedVolume] = useState(100);
  const [takeAllowSoundUse, setTakeAllowSoundUse] = useState(true);
  const [takeThumbnailFile, setTakeThumbnailFile] = useState<File | null>(null);
  const [takeThumbnailPreview, setTakeThumbnailPreview] = useState<string | null>(null);
  const [takeThumbnailFromVideo, setTakeThumbnailFromVideo] = useState<string | null>(null);
  const [takeEditorTab, setTakeEditorTab] = useState<"details" | "effects" | "sound" | "cover" | "ratio">("details");
  const [takeSoundSearch, setTakeSoundSearch] = useState("");
  const [takeShowSoundPicker, setTakeShowSoundPicker] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const takeAudioRef = useRef<HTMLAudioElement>(null);
  const [takeSoundPlaying, setTakeSoundPlaying] = useState(false);

  // Take creation hook
  const { createTake, uploading: takeUploading, progress: takeProgress, error: takeError } = useCreateTake();

  // Sound hooks for takes
  const { sounds: trendingSounds = [] } = useTrendingSounds(10) || { sounds: [] };
  const { sounds: searchedSounds = [], loading: searchingSounds = false } = useSounds(user?.id, {
    search: takeSoundSearch,
    limit: 20,
  }) || { sounds: [], loading: false };
  const displaySounds = takeSoundSearch ? searchedSounds : trendingSounds;

  // Drafts
  const { saveDraft, deleteDraft, getMostRecentDraft } = useDrafts(user?.id);
  const [showDraftRecovery, setShowDraftRecovery] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState<PostDraft | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const isTakeMode = selectedType === "take";

  // Auto-save draft callback
  const getDraftData = useCallback(() => {
    // Don't auto-save takes or when editing existing posts
    if (isTakeMode || isEditing) return null;

    const title = titleRef.current?.innerText?.trim() || "";
    const content = editorRef.current?.innerHTML || "";

    // Don't save empty drafts
    if (!title && !content && mediaItems.length === 0) {
      return null;
    }

    return {
      type: selectedType,
      title,
      content,
      visibility: visibility as PostDraft["visibility"],
      contentWarning: hasContentWarning ? contentWarning : "",
      collaborators: collaborators.map(c => ({
        id: c.id,
        username: c.username,
        display_name: c.display_name,
        avatar_url: c.avatar_url,
        role: c.role
      })),
      mentions: taggedPeople.map(p => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url
      })),
      communityId: selectedCommunity?.id || null,
      communityName: selectedCommunity?.name,
      flair: selectedFlair,
      tags,
      mediaMetadata: mediaItems.map(m => ({
        id: m.id,
        preview: m.preview,
        type: m.type,
        caption: m.caption
      })),
      styling: styling as PostDraft["styling"],
      textAlignment,
      lineSpacing,
      dropCap: dropCapEnabled,
      postLocation,
      journalMetadata,
      spotifyTrack,
    };
  }, [isTakeMode, isEditing, selectedType, visibility, hasContentWarning, contentWarning, collaborators, taggedPeople, selectedCommunity, selectedFlair, tags, mediaItems, styling, textAlignment, lineSpacing, dropCapEnabled, postLocation, journalMetadata, spotifyTrack]);

  // Auto-save every 30 seconds
  useAutoSave(getDraftData, {
    enabled: !isEditing && !isTakeMode,
    interval: 30000, // 30 seconds
    saveDraft,
    onSave: (id) => {
      setCurrentDraftId(id);
    }
  });
  const currentType = postTypes.find((t) => t.id === selectedType);

  // Collapsible section state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  // Load existing post data when editing
  useEffect(() => {
    if (!editPostId || !user) return;

    const loadPost = async () => {
      setLoadingPost(true);
      try {
        // Fetch post data with flair
        const { data: post, error: postError } = await supabase
          .from("posts")
          .select(`
            *,
            media:post_media (
              id,
              media_url,
              media_type,
              caption,
              position
            ),
            flair:community_flairs (
              id,
              community_id,
              name,
              color,
              emoji,
              position,
              created_at
            )
          `)
          .eq("id", editPostId)
          .single();

        if (postError || !post) {
          setError("Post not found");
          setLoadingPost(false);
          return;
        }

        // Verify ownership
        if (post.author_id !== user.id) {
          setError("You can only edit your own posts");
          setLoadingPost(false);
          return;
        }

        // Set form values
        setSelectedType(post.type || "thought");
        setInitialTitle(post.title || "");
        setVisibility(post.visibility || "public");
        setEditingCommunityId(post.community_id || null);
        if (post.community_id) {
          const matchedCommunity = userCommunities.find((community) => community.id === post.community_id);
          if (matchedCommunity) {
            setSelectedCommunity(matchedCommunity);
          }
        } else {
          setSelectedCommunity(null);
        }
        setHasContentWarning(!!post.content_warning);
        setContentWarning(post.content_warning || "");
        setTags([]);
        setSpotifyTrack(post.spotify_track || null);
        setPostLocation(post.post_location || "");
        setJournalMetadata(post.metadata || {});

        const loadedStyling = (post.styling || {}) as PostStyling;
        setStyling(loadedStyling);
        setTextAlignment(loadedStyling.textAlignment || "left");
        setLineSpacing(loadedStyling.lineSpacing || "normal");
        setDropCapEnabled(Boolean(loadedStyling.dropCap));

        // Store content to be set after editor mounts
        setInitialContent(post.content || "");

        // Set existing media
        if (post.media && post.media.length > 0) {
          const existingMedia: MediaItem[] = post.media
            .sort((a: { position: number }, b: { position: number }) => a.position - b.position)
            .map((m: { id: string; media_url: string; media_type: string; caption: string | null }) => ({
              id: m.id,
              preview: m.media_url,
              media_url: m.media_url,
              caption: m.caption || "",
              type: m.media_type as "image" | "video",
              isExisting: true,
            }));
          setMediaItems(existingMedia);
        }

        // Load tags
        const { data: postTags } = await supabase
          .from("post_tags")
          .select("tag:tags(name)")
          .eq("post_id", editPostId);

        if (postTags && Array.isArray(postTags)) {
          const tagNames: string[] = [];
          for (const pt of postTags) {
            // Handle Supabase relationship response which could be array or object
            const tagData = pt.tag as unknown;
            if (tagData && typeof tagData === "object" && "name" in tagData) {
              const name = (tagData as { name: string }).name;
              if (name) tagNames.push(name);
            }
          }
          setTags(tagNames);
        }

        // Set flair if exists (handle Supabase array response)
        if (post.flair) {
          const flairData = Array.isArray(post.flair) ? post.flair[0] : post.flair;
          if (flairData && flairData.id) {
            setSelectedFlair(flairData);
          }
        }

        // Load collaborators
        try {
          const { data: collabData } = await supabase
            .from("post_collaborators")
            .select(`
              role,
              status,
              user:profiles!post_collaborators_user_id_fkey (
                id,
                username,
                display_name,
                avatar_url,
                is_verified
              )
            `)
            .eq("post_id", editPostId);

          if (collabData && Array.isArray(collabData)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const loadedCollaborators: CollaboratorWithRole[] = (collabData as any[])
              .filter((c) => {
                const u = Array.isArray(c.user) ? c.user[0] : c.user;
                return u && c.status === 'accepted';
              })
              .map((c) => {
                const u = Array.isArray(c.user) ? c.user[0] : c.user;
                return {
                  id: u.id,
                  username: u.username,
                  display_name: u.display_name,
                  avatar_url: u.avatar_url,
                  is_verified: u.is_verified,
                  role: c.role || undefined,
                };
              });
            setCollaborators(loadedCollaborators);
          }
        } catch (collabErr) {
          console.warn("Could not load collaborators:", collabErr);
        }

        // Load tagged people (mentions)
        try {
          const { data: mentionData } = await supabase
            .from("post_mentions")
            .select(`
              user:profiles!post_mentions_user_id_fkey (
                id,
                username,
                display_name,
                avatar_url,
                is_verified
              )
            `)
            .eq("post_id", editPostId);

          if (mentionData && Array.isArray(mentionData)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const loadedMentions: SearchableUser[] = (mentionData as any[])
              .filter((m) => {
                const u = Array.isArray(m.user) ? m.user[0] : m.user;
                return u;
              })
              .map((m) => {
                const u = Array.isArray(m.user) ? m.user[0] : m.user;
                return {
                  id: u.id,
                  username: u.username,
                  display_name: u.display_name,
                  avatar_url: u.avatar_url,
                  is_verified: u.is_verified,
                };
              });
            setTaggedPeople(loadedMentions);
          }
        } catch (mentionErr) {
          console.warn("Could not load mentions:", mentionErr);
        }
      } catch (err) {
        console.error("Error loading post:", err);
        setError("Failed to load post");
      } finally {
        setLoadingPost(false);
      }
    };

    loadPost();
  }, [editPostId, user, userCommunities]);

  // Set initial content once editor mounts (for edit mode)
  useEffect(() => {
    if (initialContent !== null && editorRef.current && !loadingPost) {
      editorRef.current.innerHTML = DOMPurify.sanitize(initialContent);
      setCharCount(editorRef.current.innerText.length);
      // Clear initial content so this only runs once
      setInitialContent(null);
    }
  }, [initialContent, loadingPost]);

  // Set initial title once title editor mounts (for edit mode)
  useEffect(() => {
    if (initialTitle !== null && titleRef.current && !loadingPost) {
      titleRef.current.innerHTML = DOMPurify.sanitize(initialTitle);
      setInitialTitle(null);
    }
  }, [initialTitle, loadingPost]);

  // Update formatting state on selection change
  const updateFormattingState = useCallback(() => {
    setIsBold(document.queryCommandState("bold"));
    setIsItalic(document.queryCommandState("italic"));
    setIsUnderline(document.queryCommandState("underline"));
  }, []);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside the dropdown menus
      if (!target.closest('[data-dropdown-menu]')) {
        setShowFontMenu(false);
        setShowTextColorMenu(false);
        setShowHighlightMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format commands
  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    updateFormattingState();
  };

  const handleBold = () => execFormat("bold");
  const handleItalic = () => execFormat("italic");
  const handleUnderline = () => execFormat("underline");
  const handleStrikethrough = () => execFormat("strikeThrough");
  const handleBulletList = () => execFormat("insertUnorderedList");
  const handleOrderedList = () => execFormat("insertOrderedList");
  const handleDivider = () => execFormat("insertHTML", "<hr class='editor-divider' />");
  const handleBlockquote = () => execFormat("formatBlock", "blockquote");
  const handleHeading = () => execFormat("formatBlock", "h2");
  const handleParagraph = () => execFormat("formatBlock", "p");

  const handleFontChange = (fontFamily: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setShowFontMenu(false);
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      // No text selected, just close menu
      setShowFontMenu(false);
      return;
    }

    // Extract the selected content
    const selectedContent = range.extractContents();

    // Create a span with the font style
    const span = document.createElement("span");
    span.style.fontFamily = fontFamily;
    span.appendChild(selectedContent);

    // Insert the styled span
    range.insertNode(span);

    // Restore selection
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);

    setShowFontMenu(false);
  };

  const handleTextColor = (color: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setShowTextColorMenu(false);
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      setShowTextColorMenu(false);
      return;
    }

    const selectedContent = range.extractContents();
    const span = document.createElement("span");
    span.style.color = color;
    span.appendChild(selectedContent);
    range.insertNode(span);

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);

    setShowTextColorMenu(false);
  };

  const handleHighlight = (color: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setShowHighlightMenu(false);
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      setShowHighlightMenu(false);
      return;
    }

    const selectedContent = range.extractContents();
    const span = document.createElement("span");
    if (color === "transparent") {
      span.style.backgroundColor = "";
    } else {
      span.style.backgroundColor = color;
      span.style.borderRadius = "2px";
      span.style.padding = "0 2px";
    }
    span.appendChild(selectedContent);
    range.insertNode(span);

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.addRange(newRange);

    setShowHighlightMenu(false);
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || "";
      setCharCount(text.length);
    }
    updateFormattingState();
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && tags.length < 20 && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  };

  // Spotify URL handler
  const parseSpotifyUrl = (url: string): string | null => {
    // Match various Spotify URL formats
    const patterns = [
      /spotify\.com\/track\/([a-zA-Z0-9]+)/,
      /spotify\.com\/intl-[a-z]+\/track\/([a-zA-Z0-9]+)/,
      /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const fetchSpotifyTrack = async (url: string) => {
    setLoadingSpotify(true);
    setSpotifyError(null);

    const trackId = parseSpotifyUrl(url);
    if (!trackId) {
      setSpotifyError("Please paste a valid Spotify track URL");
      setLoadingSpotify(false);
      return;
    }

    try {
      // Use Spotify oEmbed API (no auth required)
      const oEmbedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
      const response = await fetch(oEmbedUrl);

      if (!response.ok) {
        throw new Error("Could not fetch track info");
      }

      const data = await response.json();

      // Parse the title which is usually "Song Name - Artist"
      const titleParts = data.title?.split(" - ") || ["Unknown", "Unknown Artist"];
      const trackName = titleParts[0] || "Unknown";
      const artistName = titleParts.slice(1).join(" - ") || "Unknown Artist";

      const track: SpotifyTrack = {
        id: trackId,
        name: trackName,
        artist: artistName,
        album: "", // oEmbed doesn't provide album name
        albumArt: data.thumbnail_url || "",
        externalUrl: `https://open.spotify.com/track/${trackId}`,
      };

      setSpotifyTrack(track);
      setShowSpotifyPicker(false);
      setSpotifyUrl("");
    } catch {
      setSpotifyError("Could not fetch track info. Please check the URL.");
    } finally {
      setLoadingSpotify(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 20 - mediaItems.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);
    const validationErrors: string[] = [];

    filesToAdd.forEach((file) => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (!isImage && !isVideo) {
        validationErrors.push(`${file.name} is not a supported image or video format.`);
        return;
      }

      if (file.size > MAX_MEDIA_SIZE_BYTES) {
        validationErrors.push(`${file.name} exceeds the 50MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const newItem: MediaItem = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          preview: event.target?.result as string,
          caption: "",
          type: isVideo ? "video" : "image",
        };
        setMediaItems((prev) => [...prev, newItem]);
      };
      reader.readAsDataURL(file);
    });

    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveMedia = (id: string) => {
    const item = mediaItems.find((m) => m.id === id);
    if (item?.isExisting) {
      setDeletedMediaIds((prev) => [...prev, id]);
    }
    setMediaItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCaptionChange = (id: string, caption: string) => {
    setMediaItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, caption } : item))
    );
  };

  // Take-specific handlers
  const handleTakeVideoSelect = useCallback((file: File) => {
    setTakeValidationError(null);

    if (!file.type.startsWith("video/")) {
      setTakeValidationError("Please select a video file");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setTakeValidationError("Video must be under 100MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const durationCheckUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(durationCheckUrl);
      if (video.duration > 90) {
        setTakeValidationError("Video must be 90 seconds or less");
        URL.revokeObjectURL(previewUrl);
        return;
      }
      setTakeVideoDuration(Math.round(video.duration));
      setTakeVideoFile(file);
      setTakeVideoPreview(previewUrl);
    };
    video.onerror = () => {
      URL.revokeObjectURL(durationCheckUrl);
      URL.revokeObjectURL(previewUrl);
      setTakeValidationError("Could not load video file");
    };
    video.src = durationCheckUrl;
  }, []);

  const handleTakeDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setTakeDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleTakeVideoSelect(file);
    },
    [handleTakeVideoSelect]
  );

  const handleTakeDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setTakeDragActive(true);
  }, []);

  const handleTakeDragLeave = useCallback(() => {
    setTakeDragActive(false);
  }, []);

  const handleTakeInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleTakeVideoSelect(file);
    },
    [handleTakeVideoSelect]
  );

  const handleRemoveTakeVideo = useCallback(() => {
    if (takeVideoPreview) {
      URL.revokeObjectURL(takeVideoPreview);
    }
    if (takeThumbnailPreview) {
      URL.revokeObjectURL(takeThumbnailPreview);
    }
    setTakeVideoFile(null);
    setTakeVideoPreview(null);
    setTakeVideoDuration(0);
    setTakeThumbnailFile(null);
    setTakeThumbnailPreview(null);
    setTakeThumbnailFromVideo(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  }, [takeVideoPreview, takeThumbnailPreview]);

  // Generate thumbnail from video frame
  const handleGenerateThumbnailFromVideo = useCallback(() => {
    if (!videoPreviewRef.current || !takeVideoPreview) return;
    const video = videoPreviewRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setTakeThumbnailFromVideo(dataUrl);
    }
  }, [takeVideoPreview]);

  const handleToggleTakePreview = useCallback(() => {
    if (videoPreviewRef.current) {
      if (isTakePreviewPlaying) {
        videoPreviewRef.current.pause();
      } else {
        videoPreviewRef.current.play();
      }
      setIsTakePreviewPlaying(!isTakePreviewPlaying);
    }
  }, [isTakePreviewPlaying]);

  // Cleanup take preview URL on unmount
  useEffect(() => {
    return () => {
      if (takeVideoPreview) {
        URL.revokeObjectURL(takeVideoPreview);
      }
    };
  }, [takeVideoPreview]);

  // Extract tags from take caption (hashtags)
  useEffect(() => {
    if (isTakeMode && takeCaption) {
      const hashtags = takeCaption.match(/#[\w]+/g);
      if (hashtags) {
        const newTags = hashtags.map((tag) => tag.slice(1).toLowerCase());
        setTags((prev) => [...new Set([...prev, ...newTags])]);
      }
    }
  }, [takeCaption, isTakeMode]);

  // Check for recoverable draft on mount (not in edit mode)
  useEffect(() => {
    if (isEditing) return;

    const recentDraft = getMostRecentDraft();
    if (recentDraft) {
      // Only show recovery if draft is less than 7 days old
      const draftAge = Date.now() - new Date(recentDraft.updatedAt).getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (draftAge < sevenDays) {
        setRecoveredDraft(recentDraft);
        setShowDraftRecovery(true);
      }
    }
  }, [isEditing, getMostRecentDraft]);

  // Handle recovering a draft
  const handleRecoverDraft = useCallback(() => {
    if (!recoveredDraft) return;

    // Set post type
    setSelectedType(recoveredDraft.type);

    // Set title
    if (titleRef.current && recoveredDraft.title) {
      titleRef.current.innerText = recoveredDraft.title;
    }

    // Set content (needs to wait for editor to mount)
    setTimeout(() => {
      if (editorRef.current && recoveredDraft.content) {
        editorRef.current.innerHTML = DOMPurify.sanitize(recoveredDraft.content);
        setCharCount(editorRef.current.innerText.length);
      }
    }, 100);

    // Set other state
    setVisibility(recoveredDraft.visibility);
    setHasContentWarning(Boolean(recoveredDraft.contentWarning));
    setContentWarning(recoveredDraft.contentWarning || "");
    setTags(recoveredDraft.tags || []);
    setCollaborators(recoveredDraft.collaborators.map(c => ({
      ...c,
      role: c.role || "collaborator",
      is_verified: false // Default for recovered drafts
    })));
    setTaggedPeople(recoveredDraft.mentions.map(m => ({
      ...m,
      is_verified: false // Default for recovered drafts
    })));
    if (recoveredDraft.styling) {
      setStyling(recoveredDraft.styling as PostStyling);
    }
    setTextAlignment(
      recoveredDraft.textAlignment ||
      recoveredDraft.styling?.textAlignment ||
      "left"
    );
    setLineSpacing(
      recoveredDraft.lineSpacing ||
      recoveredDraft.styling?.lineSpacing ||
      "normal"
    );
    setDropCapEnabled(
      Boolean(recoveredDraft.dropCap ?? recoveredDraft.styling?.dropCap)
    );
    setPostLocation(recoveredDraft.postLocation || "");
    setJournalMetadata(recoveredDraft.journalMetadata || {});
    setSpotifyTrack(recoveredDraft.spotifyTrack || null);
    setSelectedFlair(recoveredDraft.flair || null);

    if (recoveredDraft.communityId) {
      const matchedCommunity = userCommunities.find((community) => community.id === recoveredDraft.communityId);
      if (matchedCommunity) {
        setSelectedCommunity(matchedCommunity);
      }
    } else {
      setSelectedCommunity(null);
    }

    // Set current draft ID so we update instead of create new
    setCurrentDraftId(recoveredDraft.id);
    setShowDraftRecovery(false);
  }, [recoveredDraft, userCommunities]);

  // Handle dismissing draft recovery
  const handleDismissDraftRecovery = useCallback(() => {
    setShowDraftRecovery(false);
    setRecoveredDraft(null);
  }, []);

  // Handle deleting recovered draft
  const handleDeleteRecoveredDraft = useCallback(() => {
    if (recoveredDraft) {
      deleteDraft(recoveredDraft.id);
    }
    setShowDraftRecovery(false);
    setRecoveredDraft(null);
  }, [recoveredDraft, deleteDraft]);

  // Save draft handler
  const handleSaveDraft = useCallback(() => {
    if (isTakeMode) return; // Takes can't be saved as drafts

    const title = titleRef.current?.innerText?.trim() || "";
    const content = editorRef.current?.innerHTML || "";

    // Don't save empty drafts
    if (!title && !content && mediaItems.length === 0) {
      setError("Nothing to save - add some content first");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setDraftSaveStatus("saving");

    const draftData = {
      type: selectedType,
      title,
      content,
      visibility: visibility as PostDraft["visibility"],
      contentWarning: hasContentWarning ? contentWarning : "",
      collaborators: collaborators.map(c => ({
        id: c.id,
        username: c.username,
        display_name: c.display_name,
        avatar_url: c.avatar_url,
        role: c.role,
      })),
      mentions: taggedPeople.map(p => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
      })),
      communityId: selectedCommunity?.id || null,
      communityName: selectedCommunity?.name,
      flair: selectedFlair,
      tags,
      mediaMetadata: mediaItems.map(m => ({
        id: m.id,
        preview: m.preview,
        type: m.type,
        caption: m.caption,
      })),
      styling: styling,
      textAlignment,
      lineSpacing,
      dropCap: dropCapEnabled,
      postLocation,
      journalMetadata,
      spotifyTrack,
    };

    const id = saveDraft(draftData, currentDraftId || undefined);
    setCurrentDraftId(id);
    setDraftSaveStatus("saved");

    // Reset status after 2 seconds
    setTimeout(() => setDraftSaveStatus("idle"), 2000);
  }, [
    isTakeMode,
    selectedType,
    visibility,
    hasContentWarning,
    contentWarning,
    collaborators,
    taggedPeople,
    selectedCommunity,
    selectedFlair,
    tags,
    mediaItems,
    styling,
    textAlignment,
    lineSpacing,
    dropCapEnabled,
    postLocation,
    journalMetadata,
    spotifyTrack,
    saveDraft,
    currentDraftId,
  ]);

  // Delete current draft after successful publish
  const clearCurrentDraft = useCallback(() => {
    if (currentDraftId) {
      deleteDraft(currentDraftId);
      setCurrentDraftId(null);
    }
  }, [currentDraftId, deleteDraft]);

  const handlePublish = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    // Handle Take creation separately
    if (isTakeMode) {
      if (!takeVideoFile) {
        setError("Please upload a video to create a Take.");
        return;
      }

      // Convert thumbnail from video to file if needed
      let finalThumbnailFile = takeThumbnailFile;
      if (!finalThumbnailFile && takeThumbnailFromVideo) {
        try {
          const response = await fetch(takeThumbnailFromVideo);
          const blob = await response.blob();
          finalThumbnailFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
        } catch (err) {
          console.warn("Could not convert thumbnail:", err);
        }
      }

      const result = await createTake(user.id, {
        videoFile: takeVideoFile,
        thumbnailFile: finalThumbnailFile || undefined,
        caption: takeCaption.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        contentWarning: hasContentWarning ? contentWarning.trim() : undefined,
        communityId: selectedCommunity?.id || undefined,
        duration: takeVideoDuration,
        aspectRatio: takeAspectRatio,
        effects: takeEffects,
        playbackSpeed: takePlaybackSpeed,
        allowSoundUse: takeAllowSoundUse,
        soundId: takeSelectedSound?.id || undefined,
        soundStartTime: takeSoundStartTime,
        originalAudioVolume: takeOriginalVolume,
        addedSoundVolume: takeAddedVolume,
      });

      if (result) {
        router.push("/takes");
      }
      return;
    }

    const rawContent = editorRef.current?.innerHTML || "";
    const plainText = editorRef.current?.innerText || "";
    const titleText = titleRef.current?.innerText?.trim() || "";

    // Clean up HTML content - convert &nbsp; to regular spaces
    const cleanHtml = (html: string) => {
      return html
        .replace(/&nbsp;/g, ' ')           // Replace &nbsp; with regular space
        .replace(/ {2,}/g, ' ')            // Collapse multiple consecutive spaces (not newlines)
        .replace(/^ +| +$/gm, '')          // Trim spaces from start/end of each line
        .trim();
    };

    const content = cleanHtml(rawContent);

    if (!plainText.trim()) {
      setError("Please write something before publishing.");
      return;
    }

    // Extract hashtags from content and merge with manually added tags
    const contentHashtags = plainText.match(/#[\w]+/g);
    const allTags = [...tags];
    if (contentHashtags) {
      const extractedTags = contentHashtags.map((tag) => tag.slice(1).toLowerCase());
      extractedTags.forEach((tag) => {
        if (!allTags.includes(tag)) {
          allTags.push(tag);
        }
      });
    }

    setLoading(true);
    setError(null);

    try {
      let postId: string;
      let failedMediaUploads = 0;
      const postVisibility = isCommunityPost ? "public" : visibility;

      const postStyling: PostStyling = {
        background: styling.background,
        textAlignment: textAlignment,
        lineSpacing: lineSpacing,
        dropCap: dropCapEnabled,
      };

      const persistedStyling = Object.keys(postStyling).some(
        (key) =>
          postStyling[key as keyof PostStyling] !== undefined &&
          postStyling[key as keyof PostStyling] !== "left" &&
          postStyling[key as keyof PostStyling] !== "normal" &&
          postStyling[key as keyof PostStyling] !== false
      )
        ? postStyling
        : null;

      const postMetadata =
        selectedType === "journal" && Object.keys(journalMetadata).length > 0
          ? journalMetadata
          : null;

      if (isEditing && editPostId) {
        // Update existing post
        const { error: updateError } = await supabase
          .from("posts")
          .update({
            type: selectedType,
            title: titleText || null,
            content: content.trim(),
            visibility: postVisibility,
            content_warning: hasContentWarning ? contentWarning.trim() || null : null,
            styling: persistedStyling,
            post_location: postLocation.trim() || null,
            metadata: postMetadata,
            spotify_track: spotifyTrack,
            flair_id: selectedFlair?.id || null,
          })
          .eq("id", editPostId);

        if (updateError) {
          console.error("Post update error:", updateError);
          throw new Error(`Failed to update post: ${updateError.message}`);
        }

        postId = editPostId;

        // Delete removed media
        if (deletedMediaIds.length > 0) {
          await supabase.from("post_media").delete().in("id", deletedMediaIds);
        }

        // Update captions for existing media
        for (const item of mediaItems.filter((m) => m.isExisting)) {
          await supabase
            .from("post_media")
            .update({ caption: item.caption.trim() || null })
            .eq("id", item.id);
        }

        // Handle tags - delete old and add new
        await supabase.from("post_tags").delete().eq("post_id", editPostId);
      } else {
        // Create new post atomically with collaborators + mentions in a single RPC transaction.
        type CreatePostWithRelationsResult = {
          success?: boolean;
          post_id?: string;
          status?: string;
          collaborators_added?: number;
          mentions_added?: number;
          error?: string;
        };

        const { data: createdPostResult, error: postError } = await supabase.rpc(
          "create_post_with_relations",
          {
            p_type: selectedType,
            p_title: titleText || null,
            p_content: content.trim(),
            p_visibility: postVisibility,
            p_content_warning: hasContentWarning ? contentWarning.trim() || null : null,
            p_community_id: selectedCommunity?.id || null,
            p_flair_id: selectedFlair?.id || null,
            p_styling: persistedStyling,
            p_post_location: postLocation.trim() || null,
            p_metadata: postMetadata,
            p_spotify_track: spotifyTrack,
            p_collaborators: collaborators.map((c) => ({ id: c.id, role: c.role || null })),
            p_mentions: taggedPeople.map((t) => t.id),
          }
        );

        if (postError) {
          console.error("Post creation RPC error:", postError);
          throw new Error(`Failed to create post: ${postError.message}`);
        }

        const rpcResult = createdPostResult as CreatePostWithRelationsResult | null;
        if (!rpcResult?.success || !rpcResult.post_id) {
          throw new Error(rpcResult?.error || "Failed to create post");
        }

        postId = rpcResult.post_id;
      }

      // Upload new media files
      const newMediaItems = mediaItems.filter((m) => !m.isExisting && m.file);
      if (newMediaItems.length > 0) {
        const startPosition = mediaItems.filter((m) => m.isExisting).length;
        for (let i = 0; i < newMediaItems.length; i++) {
          const item = newMediaItems[i];
          if (!item.file) continue;

          const fileExt = item.file.name.split(".").pop();
          const fileName = `${user.id}/${postId}/${startPosition + i}-${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("post-media")
            .upload(fileName, item.file, { cacheControl: '31536000' });

          if (uploadError) {
            console.error("Storage upload error:", uploadError);
            failedMediaUploads += 1;
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("post-media")
            .getPublicUrl(fileName);

          const { error: mediaInsertError } = await supabase.from("post_media").insert({
            post_id: postId,
            media_url: urlData.publicUrl,
            media_type: item.type,
            caption: item.caption.trim() || null,
            position: startPosition + i,
          });

          if (mediaInsertError) {
            console.error("Post media insert error:", mediaInsertError);
            failedMediaUploads += 1;
            continue;
          }
        }
      }

      // Add tags (including hashtags extracted from content)
      if (allTags.length > 0) {
        for (const tagName of allTags) {
          const { data: existingTag } = await supabase
            .from("tags")
            .select("id")
            .eq("name", tagName.toLowerCase())
            .single();

          let tagId = existingTag?.id;

          if (!tagId) {
            const { data: newTag } = await supabase
              .from("tags")
              .insert({ name: tagName.toLowerCase() })
              .select()
              .single();
            tagId = newTag?.id;
          }

          if (tagId) {
            await supabase.from("post_tags").insert({
              post_id: postId,
              tag_id: tagId,
            });
          }
        }
      }

      // Save collaborators and mentions
      if (collaborators.length > 0 || taggedPeople.length > 0) {
        if (isEditing) {
          // When editing, update collaborators and mentions
          // Delete removed collaborators and mentions, keep existing accepted ones
          try {
            // For collaborators: delete ones no longer in list, add new ones
            const { data: existingCollabs } = await supabase
              .from("post_collaborators")
              .select("user_id, status")
              .eq("post_id", postId);

            const currentCollabIds = new Set(collaborators.map(c => c.id));
            type ExistingCollab = { user_id: string; status: string };
            const existingCollabIds = new Set((existingCollabs || []).map((c: ExistingCollab) => c.user_id));

            // Delete removed collaborators
            const collabsToRemove = (existingCollabs || [])
              .filter((c: ExistingCollab) => !currentCollabIds.has(c.user_id))
              .map((c: ExistingCollab) => c.user_id);

            if (collabsToRemove.length > 0) {
              await supabase
                .from("post_collaborators")
                .delete()
                .eq("post_id", postId)
                .in("user_id", collabsToRemove);
            }

            // Add new collaborators (ones not already in the list)
            const newCollabs = collaborators.filter(c => !existingCollabIds.has(c.id));
            if (newCollabs.length > 0) {
              await supabase.from("post_collaborators").insert(
                newCollabs.map(c => ({
                  post_id: postId,
                  user_id: c.id,
                  role: c.role || null,
                  status: "accepted", // Auto-accept for edits since they're already collaborating
                }))
              );
            }

            // Update roles for existing collaborators
            for (const collab of collaborators) {
              if (existingCollabIds.has(collab.id)) {
                await supabase
                  .from("post_collaborators")
                  .update({ role: collab.role || null })
                  .eq("post_id", postId)
                  .eq("user_id", collab.id);
              }
            }
          } catch (collabErr) {
            console.warn("Could not update collaborators:", collabErr);
          }

          // For mentions: delete ones no longer in list, add new ones
          try {
            const { data: existingMentions } = await supabase
              .from("post_mentions")
              .select("user_id")
              .eq("post_id", postId);

            const currentMentionIds = new Set(taggedPeople.map(t => t.id));
            type ExistingMention = { user_id: string };
            const existingMentionIds = new Set((existingMentions || []).map((m: ExistingMention) => m.user_id));

            // Delete removed mentions
            const mentionsToRemove = (existingMentions || [])
              .filter((m: ExistingMention) => !currentMentionIds.has(m.user_id))
              .map((m: ExistingMention) => m.user_id);

            if (mentionsToRemove.length > 0) {
              await supabase
                .from("post_mentions")
                .delete()
                .eq("post_id", postId)
                .in("user_id", mentionsToRemove);
            }

            // Add new mentions
            const newMentions = taggedPeople.filter(t => !existingMentionIds.has(t.id));
            if (newMentions.length > 0) {
              await supabase.from("post_mentions").insert(
                newMentions.map(t => ({
                  post_id: postId,
                  user_id: t.id,
                }))
              );
            }
          } catch (mentionErr) {
            console.warn("Could not update mentions:", mentionErr);
          }
        } else {
          // New post relations are already saved by RPC; fire notifications as a best-effort side effect.
          try {
            if (collaborators.length > 0) {
              await Promise.all(
                collaborators.map((collab) =>
                  createNotification(
                    collab.id,
                    user.id,
                    "collaboration_invite",
                    postId
                  )
                )
              );
            }

            if (taggedPeople.length > 0) {
              await Promise.all(
                taggedPeople.map((mention) =>
                  createNotification(
                    mention.id,
                    user.id,
                    "mention",
                    postId
                  )
                )
              );
            }
          } catch (notificationErr) {
            console.warn("Could not create collaboration/mention notifications:", notificationErr);
          }
        }
      } else if (isEditing) {
        // If editing and no collaborators/mentions, clear existing ones
        try {
          await supabase.from("post_collaborators").delete().eq("post_id", postId);
          await supabase.from("post_mentions").delete().eq("post_id", postId);
        } catch (clearErr) {
          console.warn("Could not clear collaborators/mentions:", clearErr);
        }
      }

      // Clear draft after successful publish
      clearCurrentDraft();

      // Add post to collection item if selected
      if (selectedCollectionItem && !isEditing) {
        try {
          await addPostToCollectionItem(selectedCollectionItem.id, postId);
        } catch (collectionErr) {
          console.warn("Could not add post to collection:", collectionErr);
        }
      }

      // Navigate based on context
      if (isEditing) {
        if (failedMediaUploads > 0) {
          router.push(`/post/${postId}?media_failed=${failedMediaUploads}`);
        } else {
          router.push(`/post/${postId}`);
        }
      } else if (collaborators.length > 0) {
        // Collaborator posts stay in draft until collaborators accept.
        router.push("/pending-collaborations?created=1");
      } else if (selectedCommunity) {
        router.push(`/community/${selectedCommunity.slug}`);
      } else {
        if (failedMediaUploads > 0) {
          router.push(`/post/${postId}?media_failed=${failedMediaUploads}`);
        } else {
          router.push("/");
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to publish post";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const currentVisibility = visibilityOptions.find((v) => v.id === visibility);
  const flairCommunityId = selectedCommunity?.id || editingCommunityId;

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-warm/20 to-pink-vivid/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-ink mb-2">Sign in to create</h2>
          <p className="text-muted font-body mb-6">Create an account to start sharing your work</p>
          <button
            onClick={() => router.push("/login")}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loadingPost) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-10 h-10 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-body text-muted">Loading post...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
    <div className="max-w-4xl mx-auto px-6 py-12">

      {/* Header */}
      <h1 className="text-center text-3xl md:text-4xl font-display font-bold text-ink mb-10">
        {isEditing ? (
          <>
            <span className="bg-gradient-to-r from-orange-warm to-pink-vivid bg-clip-text text-transparent">Edit</span>{" "}
            <span className="bg-gradient-to-r from-pink-vivid to-purple-primary bg-clip-text text-transparent">your post</span>
          </>
        ) : (
          <>
            Let&apos;s{" "}
            <span className="bg-gradient-to-r from-orange-warm to-pink-vivid bg-clip-text text-transparent">create</span>{" "}
            <span className="bg-gradient-to-r from-pink-vivid to-purple-primary bg-clip-text text-transparent">something</span>
          </>
        )}
      </h1>

      {/* Draft Recovery Banner */}
      {showDraftRecovery && recoveredDraft && (
        <div className="mb-6 rounded-2xl border border-purple-primary/15 bg-gradient-to-r from-purple-primary/[0.04] via-white to-pink-vivid/[0.04] p-5 animate-fadeIn">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-ui text-[0.95rem] font-semibold text-ink mb-1">
                You have an unsaved draft
              </h3>
              <p className="font-body text-[0.85rem] text-muted mb-3">
                {recoveredDraft.title ? `"${recoveredDraft.title.substring(0, 50)}${recoveredDraft.title.length > 50 ? '...' : ''}"` : 'Untitled'}
                {' · '}
                {new Date(recoveredDraft.updatedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleRecoverDraft}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.85rem] font-medium text-white shadow-md shadow-purple-primary/30 hover:-translate-y-0.5 hover:shadow-lg transition-all"
                >
                  Continue Editing
                </button>
                <button
                  onClick={handleDismissDraftRecovery}
                  className="px-4 py-2 rounded-full border border-black/[0.08] bg-white font-ui text-[0.85rem] text-muted hover:border-purple-primary hover:text-purple-primary transition-all"
                >
                  Start Fresh
                </button>
                <button
                  onClick={handleDeleteRecoveredDraft}
                  className="px-4 py-2 rounded-full font-ui text-[0.85rem] text-red-500 hover:bg-red-50 transition-all"
                >
                  Delete Draft
                </button>
              </div>
            </div>
            <button
              onClick={handleDismissDraftRecovery}
              className="p-1.5 rounded-full hover:bg-black/5 text-muted transition-all flex-shrink-0"
            >
              {icons.x}
            </button>
          </div>
        </div>
      )}

      {/* Post Type Selector */}
      <div className="mb-10">
        <p className="text-center text-sm font-ui text-muted uppercase tracking-wider mb-5">Choose a format</p>
        <div className="flex flex-wrap justify-center gap-3">
          {postTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-ui text-sm font-medium transition-all duration-300 ${
                selectedType === type.id
                  ? "shadow-xl shadow-pink-vivid/20 text-ink"
                  : "shadow-md hover:shadow-lg hover:-translate-y-0.5 text-muted"
              }`}
              style={{
                border: selectedType === type.id ? "2px solid transparent" : "1px solid rgba(0,0,0,0.05)",
                backgroundImage: selectedType === type.id
                  ? "linear-gradient(white, white), linear-gradient(to right, #8e44ad, #ff007f, #ff9f43)"
                  : undefined,
                backgroundOrigin: "border-box",
                backgroundClip: selectedType === type.id ? "padding-box, border-box" : undefined,
              }}
            >
              <span className={selectedType === type.id ? "text-pink-vivid" : "text-muted"}>
                {icons[type.icon]}
              </span>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Collection Selector */}
      {!isEditing && !isTakeMode && (
        <div className="mb-8">
          <label className="block text-sm font-ui font-semibold text-ink mb-3">
            Collection <span className="text-muted font-normal">(optional)</span>
          </label>
          <CollectionSelector
            selectedCollection={selectedCollection}
            selectedItem={selectedCollectionItem}
            onSelectCollection={setSelectedCollection}
            onSelectItem={setSelectedCollectionItem}
          />
        </div>
      )}

      {/* Editor */}
      <div>

        {/* Take Mode - Enhanced Video Upload Section */}
        {isTakeMode && (
          <div className="p-6">
            {/* Hidden audio for sound preview */}
            <audio ref={takeAudioRef} onEnded={() => setTakeSoundPlaying(false)} />

            {/* Upload State */}
            {!takeVideoPreview ? (
              <div
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all max-w-md mx-auto ${
                  takeDragActive
                    ? "border-[#8e44ad] bg-[#8e44ad]/5"
                    : "border-black/[0.08] hover:border-[#8e44ad]/50 hover:bg-[#8e44ad]/[0.02]"
                }`}
                onDrop={handleTakeDrop}
                onDragOver={handleTakeDragOver}
                onDragLeave={handleTakeDragLeave}
                onClick={() => videoInputRef.current?.click()}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#8e44ad] to-[#ff007f] flex items-center justify-center text-white">
                  {icons.video}
                </div>
                <p className="font-ui text-[1rem] text-ink font-medium mb-1">Upload your Take</p>
                <p className="font-body text-[0.85rem] text-muted">Drag & drop or click to browse</p>
                <p className="font-body text-[0.75rem] text-muted/60 mt-3">MP4 or MOV · Max 90 seconds · Max 100MB</p>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/mov"
                  onChange={handleTakeInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              /* Video Uploaded - Show editor */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Video Preview */}
                <div>
                  <div className="relative mx-auto" style={{ maxWidth: "300px" }}>
                    <div
                      className="relative rounded-2xl overflow-hidden bg-black shadow-xl"
                      style={{ aspectRatio: takeAspectRatio.replace(":", "/") }}
                    >
                      <video
                        ref={videoPreviewRef}
                        src={takeVideoPreview}
                        className="w-full h-full object-contain"
                        style={TAKE_FILTER_OPTIONS.find(f => f.name === takeSelectedFilter)?.style}
                        loop
                        playsInline
                        muted={takeOriginalVolume === 0}
                        onClick={handleToggleTakePreview}
                        onLoadedData={handleGenerateThumbnailFromVideo}
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={handleToggleTakePreview}
                      >
                        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center text-[#6b2d8b]">
                          {isTakePreviewPlaying ? icons.pause : icons.play}
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveTakeVideo}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-all"
                      >
                        {icons.x}
                      </button>
                      <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full bg-black/60 text-white font-ui text-[0.75rem]">
                          {takeVideoDuration}s
                        </span>
                        <span className="px-2 py-1 rounded-full bg-black/60 text-white font-ui text-[0.75rem]">
                          {takeAspectRatio}
                        </span>
                      </div>
                      {takeSelectedSound && (
                        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-pink-500/90 text-white font-ui text-[0.7rem] flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                          <span className="truncate max-w-[80px]">{takeSelectedSound.name}</span>
                        </div>
                      )}
                      {takeSelectedFilter !== "none" && (
                        <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-purple-500/90 text-white font-ui text-[0.7rem]">
                          {TAKE_FILTER_OPTIONS.find(f => f.name === takeSelectedFilter)?.label}
                        </div>
                      )}
                    </div>
                  </div>

                  {takeValidationError && (
                    <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 font-ui text-[0.85rem] flex items-center gap-2">
                      {icons.warning}
                      {takeValidationError}
                    </div>
                  )}
                </div>

                {/* Right: Editor Sections */}
                <div className="space-y-6">
                  {/* Caption */}
                  <div>
                    <textarea
                      value={takeCaption}
                      onChange={(e) => setTakeCaption(e.target.value)}
                      placeholder="Write a caption..."
                      maxLength={500}
                      rows={3}
                      className="w-full p-3 rounded-xl border border-black/[0.08] bg-[#fafafa] font-body text-[0.9rem] text-ink resize-none outline-none focus:border-[#8e44ad] focus:bg-white transition-all placeholder:text-muted/50"
                    />
                    <div className="text-right font-ui text-[0.7rem] text-muted mt-1">{takeCaption.length}/500</div>
                  </div>

                  {/* Filters Section */}
                  <div className="border-t border-black/[0.06] pt-5">
                    <button
                      onClick={() => setTakeEditorTab(takeEditorTab === "effects" ? "details" : "effects")}
                      className="w-full flex items-center justify-between mb-3"
                    >
                      <span className="font-ui text-[0.8rem] font-medium text-ink">Filters</span>
                      <svg className={`w-4 h-4 text-muted transition-transform ${takeEditorTab === "effects" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    {takeEditorTab === "effects" && (
                      <div className="space-y-4">
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                          {TAKE_FILTER_OPTIONS.map((filter) => (
                            <button
                              key={filter.name}
                              onClick={() => {
                                setTakeSelectedFilter(filter.name);
                                if (filter.name !== "none") {
                                  setTakeEffects([{ type: "filter", name: filter.name }]);
                                } else {
                                  setTakeEffects([]);
                                }
                              }}
                              className={`flex-shrink-0 flex flex-col items-center gap-1.5 transition-all`}
                            >
                              <div
                                className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                                  takeSelectedFilter === filter.name
                                    ? "border-[#8e44ad] ring-2 ring-[#8e44ad]/20"
                                    : "border-transparent"
                                }`}
                              >
                                <div
                                  className="w-full h-full bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400"
                                  style={filter.style}
                                />
                              </div>
                              <span className={`text-[0.65rem] font-medium ${takeSelectedFilter === filter.name ? "text-[#6b2d8b]" : "text-muted"}`}>
                                {filter.label}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div>
                          <p className="font-ui text-[0.75rem] text-muted mb-2">Speed</p>
                          <div className="flex gap-1.5">
                            {TAKE_SPEED_OPTIONS.map((speed) => (
                              <button
                                key={speed.value}
                                onClick={() => setTakePlaybackSpeed(speed.value)}
                                className={`flex-1 py-1.5 rounded-lg text-[0.75rem] font-medium transition-all ${
                                  takePlaybackSpeed === speed.value
                                    ? "bg-ink text-white"
                                    : "bg-gray-100 text-muted hover:bg-gray-200"
                                }`}
                              >
                                {speed.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sound Section */}
                  <div className="border-t border-black/[0.06] pt-5">
                    <button
                      onClick={() => setTakeEditorTab(takeEditorTab === "sound" ? "details" : "sound")}
                      className="w-full flex items-center justify-between mb-3"
                    >
                      <span className="font-ui text-[0.8rem] font-medium text-ink">
                        {takeSelectedSound ? `Sound: ${takeSelectedSound.name}` : "Add Sound"}
                      </span>
                      <svg className={`w-4 h-4 text-muted transition-transform ${takeEditorTab === "sound" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    {takeEditorTab === "sound" && (
                      <div className="space-y-3">
                        {takeSelectedSound ? (
                          <div className="flex items-center gap-3 p-3 bg-[#fafafa] rounded-xl">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white flex-shrink-0">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{takeSelectedSound.name}</p>
                              <p className="text-xs text-muted truncate">{takeSelectedSound.artist || "Original Sound"}</p>
                            </div>
                            <button onClick={() => setTakeSelectedSound(null)} className="p-1.5 hover:bg-black/10 rounded-full text-muted">{icons.x}</button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              placeholder="Search sounds..."
                              value={takeSoundSearch}
                              onChange={(e) => setTakeSoundSearch(e.target.value)}
                              className="w-full p-2.5 rounded-lg border border-black/[0.08] bg-[#fafafa] text-sm outline-none focus:border-[#8e44ad]"
                            />
                            <div className="max-h-36 overflow-y-auto space-y-1">
                              {searchingSounds ? (
                                <p className="text-center py-3 text-muted text-sm">Searching...</p>
                              ) : displaySounds.length === 0 ? (
                                <p className="text-center py-3 text-muted text-sm">No sounds found</p>
                              ) : (
                                displaySounds.map((sound) => (
                                  <button
                                    key={sound.id}
                                    onClick={() => { setTakeSelectedSound(sound); setTakeEditorTab("details"); }}
                                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white flex-shrink-0">
                                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                                    </div>
                                    <div className="flex-1 min-w-0 text-left">
                                      <p className="text-sm font-medium truncate">{sound.name}</p>
                                      <p className="text-[0.7rem] text-muted truncate">{sound.artist || "Original"}</p>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        )}
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted w-20">Original</span>
                            <input type="range" min="0" max="100" value={takeOriginalVolume} onChange={(e) => setTakeOriginalVolume(Number(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500" />
                            <span className="text-xs text-muted w-8 text-right">{takeOriginalVolume}%</span>
                          </div>
                          {takeSelectedSound && (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted w-20">Added</span>
                              <input type="range" min="0" max="100" value={takeAddedVolume} onChange={(e) => setTakeAddedVolume(Number(e.target.value))} className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500" />
                              <span className="text-xs text-muted w-8 text-right">{takeAddedVolume}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Aspect Ratio Section */}
                  <div className="border-t border-black/[0.06] pt-5">
                    <button
                      onClick={() => setTakeEditorTab(takeEditorTab === "ratio" ? "details" : "ratio")}
                      className="w-full flex items-center justify-between mb-3"
                    >
                      <span className="font-ui text-[0.8rem] font-medium text-ink">Aspect Ratio</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[0.75rem] text-muted">{takeAspectRatio}</span>
                        <svg className={`w-4 h-4 text-muted transition-transform ${takeEditorTab === "ratio" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                      </div>
                    </button>
                    {takeEditorTab === "ratio" && (
                      <div className="flex gap-2">
                        {TAKE_ASPECT_RATIOS.map((ar) => {
                          const [w, h] = ar.value.split(":").map(Number);
                          const isVertical = h > w;
                          return (
                            <button
                              key={ar.value}
                              onClick={() => setTakeAspectRatio(ar.value)}
                              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${
                                takeAspectRatio === ar.value
                                  ? "bg-ink text-white"
                                  : "bg-gray-50 text-muted hover:bg-gray-100"
                              }`}
                            >
                              <div
                                className={`border-2 rounded-sm ${takeAspectRatio === ar.value ? 'border-white' : 'border-current'}`}
                                style={{ width: isVertical ? 12 : 18, height: isVertical ? 18 : (w === h ? 12 : 10) }}
                              />
                              <span className="text-[0.65rem] font-medium">{ar.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Cover Section */}
                  <div className="border-t border-black/[0.06] pt-5">
                    <button
                      onClick={() => setTakeEditorTab(takeEditorTab === "cover" ? "details" : "cover")}
                      className="w-full flex items-center justify-between mb-3"
                    >
                      <span className="font-ui text-[0.8rem] font-medium text-ink">Cover</span>
                      <svg className={`w-4 h-4 text-muted transition-transform ${takeEditorTab === "cover" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    {takeEditorTab === "cover" && (
                      <div className="grid grid-cols-2 gap-2">
                        {takeThumbnailFromVideo ? (
                          <button
                            onClick={() => { setTakeThumbnailPreview(null); setTakeThumbnailFile(null); }}
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${!takeThumbnailPreview ? "border-[#8e44ad]" : "border-transparent hover:border-gray-300"}`}
                          >
                            <img src={takeThumbnailFromVideo} alt="" className="w-full h-full object-cover" />
                            <span className="absolute bottom-1 left-1 right-1 text-[0.6rem] text-white text-center bg-black/50 rounded px-1 py-0.5">From Video</span>
                          </button>
                        ) : (
                          <div className="aspect-video rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-muted text-xs">Loading...</div>
                        )}
                        <button
                          onClick={() => thumbnailInputRef.current?.click()}
                          className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${takeThumbnailPreview ? "border-[#8e44ad]" : "border-dashed border-gray-200 hover:border-gray-300"}`}
                        >
                          {takeThumbnailPreview ? (
                            <>
                              <img src={takeThumbnailPreview} alt="" className="w-full h-full object-cover" />
                              <span className="absolute bottom-1 left-1 right-1 text-[0.6rem] text-white text-center bg-black/50 rounded px-1 py-0.5">Custom</span>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50">
                              <svg className="w-5 h-5 text-gray-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              <span className="text-[0.65rem] text-muted">Upload</span>
                            </div>
                          )}
                          <input ref={thumbnailInputRef} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file && file.type.startsWith("image/")) { setTakeThumbnailFile(file); setTakeThumbnailPreview(URL.createObjectURL(file)); }}} className="hidden" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Regular Post Mode - Title Input */}
        {!isTakeMode && (
          <div className="mb-6">
            <label className="block text-sm font-ui font-semibold text-ink mb-3">
              Title <span className="text-pink-vivid">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm p-[1px]">
                <div className="w-full h-full rounded-xl bg-white" />
              </div>
              <div className="relative flex items-center">
                <div
                  ref={titleRef}
                  contentEditable
                  onKeyUp={updateFormattingState}
                  onMouseUp={updateFormattingState}
                  onKeyDown={(e) => {
                    if (e.key === "Tab" && !e.shiftKey) {
                      e.preventDefault();
                      editorRef.current?.focus();
                    }
                  }}
                  data-placeholder="Give your creation a title..."
                  className="title-editor w-full px-4 py-3.5 pr-12 rounded-xl text-xl font-display font-bold text-ink bg-transparent outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted/40 empty:before:font-normal"
                />
                <div className="absolute right-4 text-orange-warm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Formatting Toolbar - Hidden in Take mode */}
        {!isTakeMode && (
        <div className="mb-4 px-4 py-2.5 rounded-xl bg-gray-50/80 border border-black/[0.04] flex items-center gap-1 flex-wrap">
          {/* Text Formatting */}
          <div className="flex items-center gap-1 pr-3 border-r border-black/10">
            <button
              onClick={handleBold}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                isBold ? "bg-purple-primary text-white" : "hover:bg-black/5 text-muted"
              }`}
              title="Bold (Ctrl+B)"
            >
              {icons.bold}
            </button>
            <button
              onClick={handleItalic}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                isItalic ? "bg-purple-primary text-white" : "hover:bg-black/5 text-muted"
              }`}
              title="Italic (Ctrl+I)"
            >
              {icons.italic}
            </button>
            <button
              onClick={handleUnderline}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                isUnderline ? "bg-purple-primary text-white" : "hover:bg-black/5 text-muted"
              }`}
              title="Underline (Ctrl+U)"
            >
              {icons.underline}
            </button>
            <button
              onClick={handleStrikethrough}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-black/5 text-muted transition-all"
              title="Strikethrough"
            >
              {icons.strikethrough}
            </button>
          </div>

          {/* Block Formatting */}
          <div className="flex items-center gap-1 px-3 border-r border-black/10">
            <button
              onClick={handleHeading}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-black/5 text-muted transition-all"
              title="Heading"
            >
              {icons.heading}
            </button>
            <button
              onClick={handleBlockquote}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-black/5 text-muted transition-all"
              title="Quote"
            >
              {icons.quote2}
            </button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-1 px-3 border-r border-black/10">
            <button
              onClick={handleBulletList}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-black/5 text-muted transition-all"
              title="Bullet List"
            >
              {icons.list}
            </button>
            <button
              onClick={handleOrderedList}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-black/5 text-muted transition-all"
              title="Numbered List"
            >
              {icons.orderedList}
            </button>
            <button
              onClick={handleDivider}
              className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-black/5 text-muted transition-all"
              title="Horizontal Line"
            >
              {icons.divider}
            </button>
          </div>

          {/* Font Selector */}
          <div className="relative pl-3" data-dropdown-menu>
            <button
              onClick={() => {
                setShowFontMenu(!showFontMenu);
                setShowTextColorMenu(false);
                setShowHighlightMenu(false);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-black/5 text-muted transition-all font-ui text-[0.85rem]"
            >
              {icons.font}
              <span>Font</span>
              {icons.chevronDown}
            </button>

            {showFontMenu && (
              <div className="absolute top-full left-0 md:left-0 right-0 md:right-auto mt-1 w-56 max-h-80 overflow-y-auto bg-white rounded-xl shadow-xl border border-black/[0.06] z-50">
                {fontOptions.map((font) => (
                  <button
                    key={font.id}
                    onClick={() => handleFontChange(font.family)}
                    className="w-full px-4 py-2.5 text-left transition-all hover:bg-black/[0.03] text-ink text-[0.9rem]"
                    style={{ fontFamily: font.family }}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text Color */}
          <div className="relative" data-dropdown-menu>
            <button
              onClick={() => {
                setShowTextColorMenu(!showTextColorMenu);
                setShowHighlightMenu(false);
                setShowFontMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-black/5 text-muted transition-all"
              title="Text Color"
            >
              {icons.textColor}
              <div className="w-4 h-1 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500" />
            </button>

            {showTextColorMenu && (
              <div className="absolute top-full left-0 md:left-0 right-0 md:right-auto mt-2 w-[220px] bg-white rounded-2xl shadow-2xl border border-black/[0.08] z-50 overflow-hidden">
                <div className="px-3 py-2 bg-black/[0.02] border-b border-black/[0.06]">
                  <span className="font-ui text-xs font-medium text-muted uppercase tracking-wide">Text Color</span>
                </div>
                <div className="p-3 max-h-[400px] overflow-y-auto">
                  {/* White & Light */}
                  <div className="mb-3">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">White & Light</span>
                    <div className="flex gap-2 mt-1.5">
                      {textColors.slice(0, 4).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleTextColor(c.color)}
                          className="w-10 h-10 rounded-xl border border-black/10 hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Grayscale */}
                  <div className="mb-3">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Grayscale</span>
                    <div className="flex gap-2 mt-1.5">
                      {textColors.slice(4, 8).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleTextColor(c.color)}
                          className="w-10 h-10 rounded-xl border-2 border-transparent hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Warm */}
                  <div className="mb-3">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Warm</span>
                    <div className="flex gap-2 mt-1.5">
                      {textColors.slice(8, 12).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleTextColor(c.color)}
                          className="w-10 h-10 rounded-xl border-2 border-transparent hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Nature */}
                  <div className="mb-3">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Nature</span>
                    <div className="flex gap-2 mt-1.5">
                      {textColors.slice(12, 16).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleTextColor(c.color)}
                          className="w-10 h-10 rounded-xl border-2 border-transparent hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Cool */}
                  <div className="mb-3">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Cool</span>
                    <div className="flex gap-2 mt-1.5">
                      {textColors.slice(16, 20).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleTextColor(c.color)}
                          className="w-10 h-10 rounded-xl border-2 border-transparent hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Vibrant */}
                  <div className="mb-3">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Vibrant</span>
                    <div className="flex gap-2 mt-1.5">
                      {textColors.slice(20, 24).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleTextColor(c.color)}
                          className="w-10 h-10 rounded-xl border-2 border-transparent hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Light Pastels */}
                  <div className="mb-3">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Light</span>
                    <div className="flex gap-2 mt-1.5">
                      {textColors.slice(24, 28).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleTextColor(c.color)}
                          className="w-10 h-10 rounded-xl border-2 border-transparent hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Soft */}
                  <div>
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Soft</span>
                    <div className="flex gap-2 mt-1.5">
                      {textColors.slice(28, 32).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleTextColor(c.color)}
                          className="w-10 h-10 rounded-xl border-2 border-transparent hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Highlight */}
          <div className="relative" data-dropdown-menu>
            <button
              onClick={() => {
                setShowHighlightMenu(!showHighlightMenu);
                setShowTextColorMenu(false);
                setShowFontMenu(false);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-black/5 text-muted transition-all"
              title="Highlight"
            >
              {icons.highlight}
              <div className="w-4 h-1 rounded-full bg-gradient-to-r from-yellow-300 via-green-300 to-blue-300" />
            </button>

            {showHighlightMenu && (
              <div className="absolute top-full left-0 md:left-0 right-0 md:right-auto mt-2 w-[220px] bg-white rounded-2xl shadow-2xl border border-black/[0.08] z-50 overflow-hidden">
                <div className="px-3 py-2 bg-black/[0.02] border-b border-black/[0.06]">
                  <span className="font-ui text-xs font-medium text-muted uppercase tracking-wide">Highlight</span>
                </div>
                <div className="p-3">
                  {/* Remove highlight option */}
                  <button
                    onClick={() => handleHighlight("transparent")}
                    className="w-full mb-3 px-3 py-2 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 text-muted text-sm font-ui flex items-center justify-center gap-2 transition-all"
                  >
                    <span>✕</span>
                    <span>Remove Highlight</span>
                  </button>
                  {/* White & Light */}
                  <div className="mb-2">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Light</span>
                    <div className="flex gap-2 mt-1.5">
                      {highlightColors.slice(1, 4).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleHighlight(c.color)}
                          className="w-11 h-11 rounded-xl border border-black/10 hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Warm highlights */}
                  <div className="mb-2">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Warm</span>
                    <div className="flex gap-2 mt-1.5">
                      {highlightColors.slice(4, 8).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleHighlight(c.color)}
                          className="w-11 h-11 rounded-xl border-2 border-white shadow-sm hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Cool highlights */}
                  <div className="mb-2">
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Cool</span>
                    <div className="flex gap-2 mt-1.5">
                      {highlightColors.slice(8, 12).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleHighlight(c.color)}
                          className="w-11 h-11 rounded-xl border-2 border-white shadow-sm hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Purple/Pink */}
                  <div>
                    <span className="font-ui text-[10px] text-muted/60 uppercase tracking-wide">Purple & Pink</span>
                    <div className="flex gap-2 mt-1.5">
                      {highlightColors.slice(12, 16).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => handleHighlight(c.color)}
                          className="w-11 h-11 rounded-xl border-2 border-white shadow-sm hover:border-purple-400 hover:shadow-lg transition-all"
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Text Alignment */}
          <div className="flex items-center gap-0.5 pl-3 border-l border-black/10">
            {(['left', 'center', 'right', 'justify'] as TextAlignment[]).map((align) => (
              <button
                key={align}
                onClick={() => setTextAlignment(align)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  textAlignment === align
                    ? "bg-purple-primary text-white"
                    : 'hover:bg-black/5 text-muted'
                }`}
                title={`Align ${align}`}
              >
                {icons[`align${align.charAt(0).toUpperCase() + align.slice(1)}` as keyof typeof icons]}
              </button>
            ))}
          </div>

          {/* Line Spacing */}
          <div className="flex items-center gap-0.5 pl-3 border-l border-black/10">
            {(['normal', 'relaxed', 'loose'] as LineSpacing[]).map((spacing) => (
              <button
                key={spacing}
                onClick={() => setLineSpacing(spacing)}
                className={`px-2 py-1 rounded-lg font-ui text-xs transition-all ${
                  lineSpacing === spacing
                    ? "bg-purple-primary text-white"
                    : 'hover:bg-black/5 text-muted'
                }`}
                title={`Line spacing ${spacing}`}
              >
                {spacing === 'normal' ? '1x' : spacing === 'relaxed' ? '1.5x' : '2x'}
              </button>
            ))}
          </div>

          {/* Drop Cap */}
          <button
            onClick={() => setDropCapEnabled(!dropCapEnabled)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ml-2 transition-all ${
              dropCapEnabled
                ? "bg-purple-primary text-white"
                : 'hover:bg-black/5 text-muted'
            }`}
            title="Drop Cap"
          >
            {icons.dropCap}
          </button>

          {/* Background */}
          <div className="flex items-center gap-1 pl-3 border-l border-black/10 ml-2">
            <button
              onClick={() => setShowBackgroundPicker(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                styling.background
                  ? "bg-purple-primary/10 text-purple-primary"
                  : "hover:bg-purple-primary/10 text-muted hover:text-purple-primary"
              }`}
              title="Background"
            >
              {icons.background}
              <span className="font-ui text-[0.8rem] hidden sm:inline">Background</span>
            </button>
          </div>
        </div>
        )}

        {/* Content Editor - Hidden in Take mode */}
        {!isTakeMode && (
        <div className="mb-6">
          <label className="block text-sm font-ui font-semibold text-ink mb-3">
            Content <span className="text-pink-vivid">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm p-[1px]">
              <div className="w-full h-full rounded-xl bg-white" />
            </div>
            <div className="relative">
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                onKeyUp={updateFormattingState}
                onMouseUp={updateFormattingState}
                data-placeholder={currentType?.placeholder || "Let your thoughts flow freely..."}
                className={`editor-content w-full min-h-[320px] px-5 py-4 rounded-xl font-body text-[1.05rem] text-ink bg-transparent outline-none ${
                  textAlignment === 'left' ? 'text-left' :
                  textAlignment === 'center' ? 'text-center' :
                  textAlignment === 'right' ? 'text-right' :
                  'text-justify'
                } ${
                  lineSpacing === 'normal' ? 'leading-relaxed' :
                  lineSpacing === 'relaxed' ? 'leading-[2]' :
                  'leading-[2.5]'
                } ${dropCapEnabled ? 'drop-cap-enabled' : ''}`}
              />
            </div>
          </div>
        </div>
        )}

        {/* Media Section */}
        {!isTakeMode && (
          <div className="mb-8">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            <label className="block text-sm font-ui font-semibold text-ink mb-3">
              Media {mediaItems.length > 0 && <span className="text-muted font-normal">({mediaItems.length}/20)</span>}
            </label>

            {mediaItems.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl border border-dashed border-pink-vivid/25 bg-gradient-to-br from-pink-50/50 via-white to-purple-50/30 p-10 flex flex-col items-center gap-4 hover:border-pink-vivid/40 hover:shadow-sm transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <svg className="w-7 h-7 text-pink-vivid/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="font-ui text-sm font-medium text-ink/70 group-hover:text-ink transition-colors">Add photos or videos</p>
                  <p className="font-ui text-xs text-muted mt-1">Drag & drop or click to browse — up to 20 files</p>
                </div>
              </button>
            ) : (
              <div className="rounded-2xl border border-black/[0.06] bg-gradient-to-br from-white via-pink-50/20 to-purple-50/15 p-5">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {mediaItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="relative rounded-xl overflow-hidden bg-gray-100 group shadow-sm"
                    >
                      <div className="aspect-square">
                        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-[0.65rem] font-bold flex items-center justify-center z-10 shadow-sm">
                          {index + 1}
                        </div>
                        <button
                          onClick={() => handleRemoveMedia(item.id)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 z-10"
                        >
                          {icons.x}
                        </button>
                        {item.type === "video" ? (
                          <video src={item.preview} className="w-full h-full object-cover" />
                        ) : (
                          <img src={item.preview} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="px-2.5 py-2 bg-white">
                        <input
                          type="text"
                          value={item.caption}
                          onChange={(e) => handleCaptionChange(item.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Add a caption..."
                          className="w-full font-ui text-xs text-ink bg-transparent outline-none placeholder:text-muted/50"
                        />
                      </div>
                    </div>
                  ))}
                  {mediaItems.length < 20 && (
                    <div className="relative rounded-xl overflow-hidden">
                      <div className="aspect-square">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-full rounded-xl border border-dashed border-pink-vivid/25 bg-white/60 flex flex-col items-center justify-center gap-2 text-muted hover:border-pink-vivid/50 hover:text-pink-vivid transition-all"
                        >
                          {icons.plus}
                          <span className="text-xs font-ui font-medium">Add more</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}


        {/* Extras */}
        {!isTakeMode && (
        <div className="mb-8 border-t border-black/[0.06] pt-6">
          <p className="text-sm font-ui text-muted uppercase tracking-wider mb-4">Extras</p>

          {/* Soundtrack */}
          <div className="mb-2">
            <button
              onClick={() => toggleSection('soundtrack')}
              className="w-full flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[#1DB954]">{icons.spotify}</span>
                <span className="font-ui text-sm font-medium text-ink">Soundtrack</span>
                {spotifyTrack && <span className="w-2 h-2 rounded-full bg-[#1DB954]" />}
              </div>
              <svg className={`w-4 h-4 text-muted transition-transform ${expandedSections.has('soundtrack') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>

          {expandedSections.has('soundtrack') && (
          <div className="pb-3">
          {spotifyTrack ? (
            // Show selected track
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-[#1DB954]/5 to-[#191414]/5 border border-[#1DB954]/20">
              {spotifyTrack.albumArt && (
                <img
                  src={spotifyTrack.albumArt}
                  alt={spotifyTrack.album || spotifyTrack.name}
                  className="w-14 h-14 rounded-lg shadow-lg object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-ui text-sm font-medium text-ink truncate">
                  {spotifyTrack.name}
                </p>
                <p className="font-ui text-[0.8rem] text-muted truncate">
                  {spotifyTrack.artist}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={spotifyTrack.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center text-white hover:scale-105 transition-transform"
                >
                  {icons.music}
                </a>
                <button
                  onClick={() => setSpotifyTrack(null)}
                  className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-muted hover:text-red-500 transition-colors"
                >
                  {icons.x}
                </button>
              </div>
            </div>
          ) : showSpotifyPicker ? (
            // Show URL input
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && spotifyUrl.trim()) {
                      e.preventDefault();
                      fetchSpotifyTrack(spotifyUrl.trim());
                    }
                  }}
                  placeholder="Paste Spotify track URL..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#1DB954]/30 bg-white font-ui text-sm text-ink focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]/30 transition-all placeholder:text-muted/50"
                  autoFocus
                />
                <button
                  onClick={() => spotifyUrl.trim() && fetchSpotifyTrack(spotifyUrl.trim())}
                  disabled={loadingSpotify || !spotifyUrl.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#1DB954] font-ui text-sm font-medium text-white hover:bg-[#1ed760] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingSpotify ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    "Add"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowSpotifyPicker(false);
                    setSpotifyUrl("");
                    setSpotifyError(null);
                  }}
                  className="px-3 py-2.5 rounded-xl border border-black/10 font-ui text-sm text-muted hover:bg-black/[0.03] transition-colors"
                >
                  Cancel
                </button>
              </div>
              {spotifyError && (
                <p className="font-ui text-sm text-red-500">{spotifyError}</p>
              )}
              <p className="font-ui text-[0.75rem] text-muted/70">
                Copy a track link from Spotify app or web player
              </p>
            </div>
          ) : (
            // Show add button
            <button
              onClick={() => setShowSpotifyPicker(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#1DB954]/20 bg-white hover:border-[#1DB954]/50 hover:bg-[#1DB954]/5 transition-all"
            >
              <span className="text-[#1DB954]">{icons.music}</span>
              <span className="font-ui text-sm text-ink">Add a song</span>
            </button>
          )}
          </div>
          )}
          </div>

          {/* Journal Mood */}
          {selectedType === 'journal' && (
          <div className="mb-2">
            <button
              onClick={() => toggleSection('journal')}
              className="w-full flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-purple-primary">{icons.book}</span>
                <span className="font-ui text-sm font-medium text-ink">Journal Mood</span>
              </div>
              <svg className={`w-4 h-4 text-muted transition-transform ${expandedSections.has('journal') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
            {expandedSections.has('journal') && (
              <div className="pb-2 pl-1">
                <JournalMetadataPanel
                  value={journalMetadata}
                  onChange={setJournalMetadata}
                  location={postLocation}
                  onLocationChange={setPostLocation}
                />
              </div>
            )}
          </div>
          )}

          {/* Location */}
          {selectedType !== 'journal' && (
          <div className="mb-2">
            <button
              onClick={() => toggleSection('location')}
              className="w-full flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-pink-vivid">{icons.location}</span>
                <span className="font-ui text-sm font-medium text-ink">Location</span>
                {postLocation && <span className="w-2 h-2 rounded-full bg-pink-vivid" />}
              </div>
              <svg className={`w-4 h-4 text-muted transition-transform ${expandedSections.has('location') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
            {expandedSections.has('location') && (
              <div className="pb-2 pl-1">
                <input
                  type="text"
                  value={postLocation}
                  onChange={(e) => setPostLocation(e.target.value)}
                  placeholder="Where are you writing from?"
                  className="w-full px-4 py-2.5 rounded-xl border border-black/[0.08] bg-white font-ui text-sm text-ink focus:outline-none focus:border-pink-vivid transition-colors placeholder:text-muted/50"
                />
              </div>
            )}
          </div>
          )}

        {/* Tags Section */}
        <div className="mb-8">
          <label className="block text-sm font-ui font-semibold text-ink mb-3">
            Tags <span className="text-muted font-normal">({tags.length}/20)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm p-[1px]">
              <div className="w-full h-full rounded-xl bg-white" />
            </div>
            <div className="relative flex flex-wrap gap-2 px-4 py-3 rounded-xl">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-orange-warm/10 to-pink-vivid/10 text-pink-vivid rounded-full font-ui text-[0.85rem] font-medium"
                >
                  #{tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 transition-colors">
                    {icons.x}
                  </button>
                </span>
              ))}
              {tags.length < 20 && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={handleAddTag}
                  placeholder="Add tags..."
                  className="flex-1 min-w-[100px] font-ui text-sm bg-transparent border-none outline-none placeholder:text-muted/50"
                />
              )}
            </div>
          </div>
        </div>

          {/* Collaborators */}
          <div className="mb-2">
            <button
              onClick={() => toggleSection('collaborators')}
              className="w-full flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-purple-primary">{icons.collaborators}</span>
                <span className="font-ui text-sm font-medium text-ink">Collaborators</span>
                {collaborators.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-warm/10 to-pink-vivid/10 text-pink-vivid font-ui text-[0.7rem] font-medium">
                    {collaborators.length}
                  </span>
                )}
              </div>
              <svg className={`w-4 h-4 text-muted transition-transform ${expandedSections.has('collaborators') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>

            {expandedSections.has('collaborators') && (
            <div className="pb-2 pl-1">
              <div className="flex items-center justify-end mb-2">
                <button
                  onClick={() => setShowCollaboratorPicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-primary text-white rounded-full font-ui text-[0.8rem] font-medium hover:bg-purple-primary/90 transition-all"
                >
                  {icons.plus}
                  Add
                </button>
              </div>

              {collaborators.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {collaborators.map((user) => (
                    <div
                      key={user.id}
                      className="inline-flex items-center gap-2 pl-1 pr-2 py-1 bg-white rounded-full border border-black/[0.08] shadow-sm"
                    >
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.display_name || user.username} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white text-xs font-medium">
                          {(user.display_name || user.username)[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-ink font-ui">{user.display_name || user.username}</span>
                      {user.role && (
                        <span className="text-xs px-2 py-0.5 bg-gradient-to-r from-orange-warm/10 to-pink-vivid/10 text-pink-vivid rounded-full font-ui font-medium">{user.role}</span>
                      )}
                      <button onClick={() => setCollaborators(collaborators.filter((c) => c.id !== user.id))} className="w-4 h-4 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center transition-colors">{icons.x}</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted font-body">Invite people to collaborate on this post</p>
              )}

              {collaborators.length > 0 && !isEditing && (
                <p className="mt-2 text-xs text-muted font-ui">Post will publish after all collaborators accept</p>
              )}
            </div>
            )}
          </div>

          {/* Tag People */}
          <div className="mb-2">
            <button
              onClick={() => toggleSection('tagPeople')}
              className="w-full flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-pink-vivid">{icons.userTag}</span>
                <span className="font-ui text-sm font-medium text-ink">Tag People</span>
                {taggedPeople.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-warm/10 to-pink-vivid/10 text-pink-vivid font-ui text-[0.7rem] font-medium">
                    {taggedPeople.length}
                  </span>
                )}
              </div>
              <svg className={`w-4 h-4 text-muted transition-transform ${expandedSections.has('tagPeople') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>

            {expandedSections.has('tagPeople') && (
            <div className="pb-2 pl-1">
              <div className="flex items-center justify-end mb-2">
                <button
                  onClick={() => setShowTagPeoplePicker(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-primary text-white rounded-full font-ui text-[0.8rem] font-medium hover:bg-purple-primary/90 transition-all"
                >
                  {icons.plus}
                  Add
                </button>
              </div>

              {taggedPeople.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {taggedPeople.map((user) => (
                    <div key={user.id} className="inline-flex items-center gap-2 pl-1 pr-2 py-1 bg-white rounded-full border border-black/[0.08] shadow-sm">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.display_name || user.username} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-vivid to-purple-primary flex items-center justify-center text-white text-xs font-medium">
                          {(user.display_name || user.username)[0].toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-medium text-ink font-ui">@{user.username}</span>
                      <button onClick={() => setTaggedPeople(taggedPeople.filter((t) => t.id !== user.id))} className="w-4 h-4 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center transition-colors">{icons.x}</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted font-body">Tag people mentioned in this post</p>
              )}
            </div>
            )}
          </div>

          {/* Content Warning */}
          <div className="mb-2">
            <button
              onClick={() => toggleSection('contentWarning')}
              className="w-full flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-red-500">{icons.warning}</span>
                <span className="font-ui text-sm font-medium text-ink">Content Warning</span>
                {hasContentWarning && <span className="w-2 h-2 rounded-full bg-red-500" />}
              </div>
              <svg className={`w-4 h-4 text-muted transition-transform ${expandedSections.has('contentWarning') ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>

            {expandedSections.has('contentWarning') && (
            <div className="pb-2 pl-1">
              <div className="flex items-center justify-between mb-3">
                <span className="font-ui text-sm text-muted">Mark as sensitive</span>
                <button
                  onClick={() => setHasContentWarning(!hasContentWarning)}
                  className={`w-11 h-6 rounded-full transition-all relative ${
                    hasContentWarning ? "bg-gradient-to-r from-pink-vivid to-purple-primary" : "bg-gray-300"
                  }`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${hasContentWarning ? "left-5" : "left-0.5"}`} />
                </button>
              </div>

              {hasContentWarning && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={contentWarning}
                    onChange={(e) => setContentWarning(e.target.value)}
                    placeholder="Describe the sensitive content..."
                    className="w-full px-4 py-2.5 rounded-xl border border-red-200 bg-white font-body text-sm text-ink outline-none focus:border-red-400 transition-all placeholder:text-muted/50"
                  />
                  <div className="flex flex-wrap gap-2">
                    {contentWarningPresets.map((preset) => (
                      <button key={preset} onClick={() => setContentWarning(preset)} className="px-3 py-1.5 rounded-full border border-red-200 bg-white font-ui text-[0.75rem] text-red-500 hover:bg-red-50 transition-all">{preset}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

        </div>
        )}

        {/* Error Message */}
        {(error || takeError) && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-sm text-red-600 font-body">{error || takeError}</p>
          </div>
        )}

        {/* Take Upload Progress */}
        {isTakeMode && takeUploading && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="font-ui text-sm text-muted">Uploading your Take...</span>
              <span className="font-ui text-sm font-medium text-pink-vivid">{Math.round(takeProgress)}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm transition-all duration-500"
                style={{ width: `${takeProgress}%` }}
              />
            </div>
          </div>
        )}

      </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-8 border-t border-black/[0.06]">
          <div className="flex items-center gap-3">
            {/* Visibility Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  if (isCommunityPost) return;
                  setShowVisibilityMenu(!showVisibilityMenu);
                }}
                disabled={isCommunityPost}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border bg-white font-ui text-[0.85rem] transition-all ${
                  isCommunityPost
                    ? "border-[#8e44ad]/30 text-[#6b2d8b] cursor-not-allowed"
                    : "border-black/[0.08] text-muted hover:border-[#8e44ad] hover:text-[#6b2d8b]"
                }`}
              >
                {icons[currentVisibility?.icon || "globe"]}
                {isCommunityPost ? "Community (Public)" : currentVisibility?.label}
                {!isCommunityPost && icons.chevronDown}
              </button>

              {showVisibilityMenu && !isCommunityPost && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-xl border border-black/[0.06] overflow-hidden z-10">
                  {visibilityOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setVisibility(option.id);
                        setShowVisibilityMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 font-ui text-[0.9rem] text-left transition-all ${
                        visibility === option.id
                          ? "bg-[#f3e8f7] text-[#6b2d8b]"
                          : "text-ink hover:bg-black/[0.03]"
                      }`}
                    >
                      {icons[option.icon]}
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-[0.75rem] text-muted">{option.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Community Selector */}
            {!isEditing && (userCommunities.length > 0 || communitiesLoading || authLoading) && (
              <div className="relative">
                {selectedCommunity ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#8e44ad]/30 bg-[#8e44ad]/5 text-[#6b2d8b] font-ui text-[0.85rem]">
                    <span
                      onClick={() => setShowCommunityMenu(!showCommunityMenu)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      {selectedCommunity.avatar_url ? (
                        <img
                          src={selectedCommunity.avatar_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#8e44ad] to-[#8e44ad] flex items-center justify-center text-white text-[0.5rem] font-bold">
                          {selectedCommunity.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="max-w-[100px] truncate">{selectedCommunity.name}</span>
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCommunity(null);
                      }}
                      className="ml-1 hover:text-red-500 cursor-pointer"
                      role="button"
                      tabIndex={0}
                    >
                      {icons.x}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={() => !(communitiesLoading || authLoading) && setShowCommunityMenu(!showCommunityMenu)}
                    disabled={communitiesLoading || authLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border border-black/[0.08] bg-white text-muted hover:border-[#8e44ad] hover:text-[#6b2d8b] font-ui text-[0.85rem] transition-all ${(communitiesLoading || authLoading) ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    {(communitiesLoading || authLoading) ? (
                      <div className="w-4 h-4 border-2 border-muted/30 border-t-muted rounded-full animate-spin" />
                    ) : (
                      icons.users
                    )}
                    <span>{(communitiesLoading || authLoading) ? 'Loading...' : 'Community'}</span>
                    {!(communitiesLoading || authLoading) && icons.chevronDown}
                  </button>
                )}

                {showCommunityMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 max-h-64 overflow-y-auto bg-white rounded-xl shadow-xl border border-black/[0.06] overflow-hidden z-10">
                    <div className="px-3 py-2 text-[0.75rem] font-ui text-muted uppercase tracking-wide border-b border-black/[0.06]">
                      Post to community
                    </div>
                    <button
                      onClick={() => {
                        setSelectedCommunity(null);
                        setShowCommunityMenu(false);
                      }}
                        className={`w-full flex items-center gap-3 px-4 py-3 font-ui text-[0.9rem] text-left transition-all ${
                          !selectedCommunity
                            ? "bg-[#f3e8f7] text-[#6b2d8b]"
                            : "text-ink hover:bg-black/[0.03]"
                        }`}
                    >
                      {icons.globe}
                      <span>Personal Feed</span>
                    </button>
                    {userCommunities.map((community) => (
                      <button
                        key={community.id}
                        onClick={() => {
                          setSelectedCommunity(community);
                          setShowCommunityMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 font-ui text-[0.9rem] text-left transition-all ${
                          selectedCommunity?.id === community.id
                            ? "bg-[#f3e8f7] text-[#6b2d8b]"
                            : "text-ink hover:bg-black/[0.03]"
                        }`}
                      >
                        {community.avatar_url ? (
                          <img
                            src={community.avatar_url}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#8e44ad] to-[#8e44ad] flex items-center justify-center text-white text-[0.6rem] font-bold">
                            {community.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{community.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Flair Picker (show for community posts, including edit mode) */}
            {flairCommunityId && (
              <FlairPicker
                communityId={flairCommunityId}
                selectedFlairId={selectedFlair?.id || null}
                onSelect={setSelectedFlair}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isTakeMode && (
              <button
                onClick={handleSaveDraft}
                disabled={draftSaveStatus === "saving"}
                className={`flex items-center gap-2 px-6 py-3 rounded-full font-ui font-semibold transition-all ${
                  draftSaveStatus === "saved"
                    ? "bg-green-500 text-white"
                  : draftSaveStatus === "saving"
                    ? "bg-purple-primary/70 text-white cursor-wait"
                    : "bg-purple-primary text-white hover:bg-purple-primary/90"
                }`}
              >
                {draftSaveStatus === "saving" ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : draftSaveStatus === "saved" ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Draft Saved
                  </>
                ) : (
                  "Save Draft"
                )}
              </button>
            )}
            <button
              onClick={handlePublish}
              disabled={loading || takeUploading || (isTakeMode && !takeVideoFile)}
              className="flex items-center gap-2 px-10 py-3 rounded-full border-2 border-transparent font-ui font-semibold text-orange-warm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(white, white) padding-box, linear-gradient(to right, #ff9f43, #ff007f) border-box",
              }}
            >
              {isTakeMode
                ? takeUploading
                  ? `Uploading... ${Math.round(takeProgress)}%`
                  : "Post Take"
                : loading
                ? isEditing
                  ? "Updating..."
                  : "Publishing..."
                : isEditing
                ? "Update"
                : "Publish"}
            </button>
          </div>
        </div>

      {/* Character Count - Hidden in Take mode */}
      {!isTakeMode && (
        <div className="flex justify-end mt-4">
          <span
            className={`font-ui text-[0.8rem] ${
              charCount > 10000
                ? "text-red-500"
                : charCount > 8000
                ? "text-orange-500"
                : "text-muted"
            }`}
          >
            {charCount.toLocaleString()} characters
          </span>
        </div>
      )}

      </div>

      {/* Collaborators Picker Modal */}
      {user && (
        <PeoplePickerModal
          isOpen={showCollaboratorPicker}
          onClose={() => setShowCollaboratorPicker(false)}
          onConfirm={(selected) => setCollaborators(selected)}
          currentUserId={user.id}
          mode="collaborators"
          initialSelected={collaborators}
          maxSelections={10}
          excludeIds={taggedPeople.map((t) => t.id)}
        />
      )}

      {/* Tag People Picker Modal */}
      {user && (
        <PeoplePickerModal
          isOpen={showTagPeoplePicker}
          onClose={() => setShowTagPeoplePicker(false)}
          onConfirm={(selected) => setTaggedPeople(selected)}
          currentUserId={user.id}
          mode="mentions"
          initialSelected={taggedPeople}
          maxSelections={50}
          excludeIds={collaborators.map((c) => c.id)}
        />
      )}

      {/* Background Picker Modal */}
      {showBackgroundPicker && (
        <BackgroundPicker
          value={styling.background || null}
          onChange={(background) => setStyling({ ...styling, background: background || undefined })}
          onClose={() => setShowBackgroundPicker(false)}
        />
      )}
    </div>
  );
}
