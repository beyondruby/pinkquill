"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunities, Community, SearchableUser, saveCollaboratorsAndMentions } from "@/lib/hooks";
import { useCreateTake } from "@/lib/hooks/useTakes";
import PeoplePickerModal, { CollaboratorWithRole } from "@/components/ui/PeoplePickerModal";
import { PostStyling, PostBackground, JournalMetadata, TextAlignment, LineSpacing, DividerStyle, SpotifyTrack } from "@/lib/types";
import BackgroundPicker from "@/components/create/BackgroundPicker";
import JournalMetadataPanel from "@/components/create/JournalMetadata";

const postTypes = [
  { id: "thought", label: "Thought", icon: "lightbulb", placeholder: "What's on your mind?" },
  { id: "take", label: "Take", icon: "video", placeholder: "Share a short video moment..." },
  { id: "poem", label: "Poem", icon: "feather", placeholder: "Let your verses flow..." },
  { id: "journal", label: "Journal", icon: "book", placeholder: "Dear diary..." },
  { id: "essay", label: "Essay", icon: "scroll", placeholder: "Begin your exploration..." },
  { id: "screenplay", label: "Screenplay", icon: "film", placeholder: "FADE IN..." },
  { id: "story", label: "Story", icon: "bookOpen", placeholder: "Once upon a time..." },
  { id: "letter", label: "Letter", icon: "envelope", placeholder: "Dear reader..." },
  { id: "quote", label: "Quote", icon: "quote", placeholder: "Share words that inspire..." },
  { id: "visual", label: "Visual", icon: "image", placeholder: "Tell the story behind your images..." },
];

const contentWarningPresets = [
  "Sensitive content",
  "Mature themes",
  "Violence",
  "Mental health",
  "Strong language",
];

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
  film: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
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
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);

  // Edit mode
  const editPostId = searchParams.get("edit");
  const isEditing = !!editPostId;
  const [loadingPost, setLoadingPost] = useState(isEditing);

  // Community selection
  const communitySlug = searchParams.get("community");
  const { communities: userCommunities } = useCommunities(user?.id, 'joined');
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);

  // Set community from URL param
  useEffect(() => {
    if (communitySlug && userCommunities.length > 0) {
      const community = userCommunities.find(c => c.slug === communitySlug);
      if (community) {
        setSelectedCommunity(community);
      }
    }
  }, [communitySlug, userCommunities]);

  const [selectedType, setSelectedType] = useState("thought");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showTextColorMenu, setShowTextColorMenu] = useState(false);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [charCount, setCharCount] = useState(0);

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

  // Take creation hook
  const { createTake, uploading: takeUploading, progress: takeProgress, error: takeError } = useCreateTake();

  const isTakeMode = selectedType === "take";
  const currentType = postTypes.find((t) => t.id === selectedType);

  // Load existing post data when editing
  useEffect(() => {
    if (!editPostId || !user) return;

    const loadPost = async () => {
      setLoadingPost(true);
      try {
        // Fetch post data
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
        setHasContentWarning(!!post.content_warning);
        setContentWarning(post.content_warning || "");

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
            const loadedCollaborators: CollaboratorWithRole[] = collabData
              .filter((c: any) => c.user && c.status === 'accepted')
              .map((c: any) => ({
                id: c.user.id,
                username: c.user.username,
                display_name: c.user.display_name,
                avatar_url: c.user.avatar_url,
                is_verified: c.user.is_verified,
                role: c.role || undefined,
              }));
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
            const loadedMentions: SearchableUser[] = mentionData
              .filter((m: any) => m.user)
              .map((m: any) => ({
                id: m.user.id,
                username: m.user.username,
                display_name: m.user.display_name,
                avatar_url: m.user.avatar_url,
                is_verified: m.user.is_verified,
              }));
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
  }, [editPostId, user]);

  // Set initial content once editor mounts (for edit mode)
  useEffect(() => {
    if (initialContent !== null && editorRef.current && !loadingPost) {
      editorRef.current.innerHTML = initialContent;
      setCharCount(editorRef.current.innerText.length);
      // Clear initial content so this only runs once
      setInitialContent(null);
    }
  }, [initialContent, loadingPost]);

  // Set initial title once title editor mounts (for edit mode)
  useEffect(() => {
    if (initialTitle !== null && titleRef.current && !loadingPost) {
      titleRef.current.innerHTML = initialTitle;
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

    filesToAdd.forEach((file) => {
      const isVideo = file.type.startsWith("video");
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
    setTakeVideoFile(null);
    setTakeVideoPreview(null);
    setTakeVideoDuration(0);
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
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

      const result = await createTake(user.id, {
        videoFile: takeVideoFile,
        caption: takeCaption.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        contentWarning: hasContentWarning ? contentWarning.trim() : undefined,
        communityId: selectedCommunity?.id || undefined,
        duration: takeVideoDuration,
      });

      if (result) {
        router.push("/takes");
      }
      return;
    }

    const rawContent = editorRef.current?.innerHTML || "";
    const plainText = editorRef.current?.innerText || "";
    const rawTitleHtml = titleRef.current?.innerHTML || "";
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
    const titleHtml = cleanHtml(rawTitleHtml);

    if (!plainText.trim()) {
      setError("Please write something before publishing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let postId: string;

      if (isEditing && editPostId) {
        // Update existing post
        const { error: updateError } = await supabase
          .from("posts")
          .update({
            type: selectedType,
            title: titleText || null,
            content: content.trim(),
            visibility,
            content_warning: hasContentWarning ? contentWarning.trim() || null : null,
            spotify_track: spotifyTrack,
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
        // Create new post
        // Community posts are always public to be visible to all members
        const postVisibility = selectedCommunity ? "public" : visibility;

        // Build styling object
        const postStyling: PostStyling = {
          background: styling.background,
          textAlignment: textAlignment,
          lineSpacing: lineSpacing,
          dropCap: dropCapEnabled,
        };

        // Build metadata for journals
        const postMetadata = selectedType === 'journal' && Object.keys(journalMetadata).length > 0
          ? journalMetadata
          : null;

        const { data: post, error: postError } = await supabase
          .from("posts")
          .insert({
            author_id: user.id,
            type: selectedType,
            title: titleText || null,
            content: content.trim(),
            visibility: postVisibility,
            content_warning: hasContentWarning ? contentWarning.trim() || null : null,
            community_id: selectedCommunity?.id || null,
            styling: Object.keys(postStyling).some(k => postStyling[k as keyof PostStyling] !== undefined && postStyling[k as keyof PostStyling] !== 'left' && postStyling[k as keyof PostStyling] !== 'normal' && postStyling[k as keyof PostStyling] !== false) ? postStyling : null,
            post_location: postLocation.trim() || null,
            metadata: postMetadata,
            spotify_track: spotifyTrack,
          })
          .select()
          .single();

        if (postError) {
          console.error("Post creation error:", postError);
          throw new Error(`Failed to create post: ${postError.message}`);
        }

        postId = post.id;
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
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("post-media")
            .getPublicUrl(fileName);

          await supabase.from("post_media").insert({
            post_id: postId,
            media_url: urlData.publicUrl,
            media_type: item.type,
            caption: item.caption.trim() || null,
            position: startPosition + i,
          });
        }
      }

      // Add tags
      if (tags.length > 0) {
        for (const tagName of tags) {
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
            const existingCollabIds = new Set((existingCollabs || []).map((c: any) => c.user_id));

            // Delete removed collaborators
            const collabsToRemove = (existingCollabs || [])
              .filter((c: any) => !currentCollabIds.has(c.user_id))
              .map((c: any) => c.user_id);

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
            const existingMentionIds = new Set((existingMentions || []).map((m: any) => m.user_id));

            // Delete removed mentions
            const mentionsToRemove = (existingMentions || [])
              .filter((m: any) => !currentMentionIds.has(m.user_id))
              .map((m: any) => m.user_id);

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
          // New post - use the existing saveCollaboratorsAndMentions function
          await saveCollaboratorsAndMentions(
            postId,
            user.id,
            collaborators.map((c) => ({ id: c.id, role: c.role })),
            taggedPeople.map((t) => t.id),
            collaborators.length > 0
          );
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

      // Navigate based on context
      if (isEditing) {
        router.push(`/post/${postId}`);
      } else if (collaborators.length > 0) {
        // If there are collaborators, the post is in draft - show a message or go home
        router.push("/?pending=true");
      } else if (selectedCommunity) {
        router.push(`/community/${selectedCommunity.slug}`);
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to publish post";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const currentVisibility = visibilityOptions.find((v) => v.id === visibility);

  if (!user) {
    return (
      <div className="max-w-[680px] mx-auto py-10 px-6 text-center">
        <h1 className="font-display text-[2rem] text-ink mb-4">Create</h1>
        <p className="font-body text-muted mb-6">
          You need to sign in to create posts.
        </p>
        <button
          onClick={() => router.push("/login")}
          className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loadingPost) {
    return (
      <div className="max-w-[680px] mx-auto py-10 px-6 text-center">
        <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-body text-muted italic">Loading post...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto py-10 px-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-display text-[2rem] text-ink mb-2">
          {isEditing ? "Edit Post" : "Create New Post"}
        </h1>
        <p className="font-body text-muted italic">
          {isEditing ? "Make changes to your creation" : "Share your thoughts with the world"}
        </p>
      </div>

      {/* Post Type Selector */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2 justify-center flex-wrap">
        {postTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setSelectedType(type.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-ui text-[0.85rem] whitespace-nowrap transition-all ${
              selectedType === type.id
                ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/30"
                : "bg-white border border-black/[0.08] text-muted hover:border-purple-primary hover:text-purple-primary"
            }`}
          >
            {icons[type.icon]}
            {type.label}
          </button>
        ))}
      </div>


      {/* Editor Card */}
      <div className="bg-white rounded-[24px] shadow-sm border border-black/[0.04]">
        {/* Take Mode - Video Upload Section */}
        {isTakeMode && (
          <div className="p-6">
            {/* Video Upload/Preview */}
            <div className="mb-6">
              {!takeVideoPreview ? (
                <div
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    takeDragActive
                      ? "border-purple-primary bg-purple-primary/5"
                      : "border-purple-primary/25 hover:border-purple-primary/50 hover:bg-purple-primary/[0.02]"
                  }`}
                  onDrop={handleTakeDrop}
                  onDragOver={handleTakeDragOver}
                  onDragLeave={handleTakeDragLeave}
                  onClick={() => videoInputRef.current?.click()}
                >
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white shadow-lg shadow-purple-primary/30">
                    {icons.video}
                  </div>
                  <p className="font-ui text-[1.1rem] text-ink font-medium mb-2">
                    Upload your Take
                  </p>
                  <p className="font-body text-[0.9rem] text-muted mb-1">
                    Drag and drop a video or click to browse
                  </p>
                  <p className="font-body text-[0.8rem] text-muted/70">
                    MP4 or MOV • Max 90 seconds • Max 100MB
                  </p>
                  <p className="font-body text-[0.75rem] text-purple-primary mt-2">
                    9:16 aspect ratio recommended (1080×1920)
                  </p>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/mov"
                    onChange={handleTakeInputChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative mx-auto" style={{ maxWidth: "280px" }}>
                  <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-xl">
                    <video
                      ref={videoPreviewRef}
                      src={takeVideoPreview}
                      className="w-full h-full object-cover"
                      loop
                      playsInline
                      muted
                      onClick={handleToggleTakePreview}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={handleToggleTakePreview}
                    >
                      <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center text-purple-primary">
                        {isTakePreviewPlaying ? icons.pause : icons.play}
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveTakeVideo}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-all"
                    >
                      {icons.x}
                    </button>
                    <div className="absolute bottom-3 left-3 px-2 py-1 rounded-full bg-black/60 text-white font-ui text-[0.75rem]">
                      {takeVideoDuration}s
                    </div>
                  </div>
                </div>
              )}

              {takeValidationError && (
                <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 font-ui text-[0.85rem] flex items-center gap-2">
                  {icons.warning}
                  {takeValidationError}
                </div>
              )}
            </div>

            {/* Take Caption */}
            <div className="mb-4">
              <label className="block font-ui text-[0.75rem] font-semibold tracking-wider uppercase text-muted mb-2">
                Caption
              </label>
              <textarea
                value={takeCaption}
                onChange={(e) => setTakeCaption(e.target.value)}
                placeholder="Write a caption... (use #hashtags for tags)"
                maxLength={500}
                rows={3}
                className="w-full p-4 rounded-xl border border-black/[0.08] bg-[#fafafa] font-body text-[0.95rem] text-ink resize-none outline-none focus:border-purple-primary focus:bg-white transition-all placeholder:text-muted/50"
              />
              <div className="text-right font-ui text-[0.75rem] text-muted mt-1">
                {takeCaption.length}/500
              </div>
            </div>
          </div>
        )}

        {/* Regular Post Mode - Title Input */}
        {!isTakeMode && (
          <div className="p-6 border-b border-black/[0.06]">
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
              className="title-editor w-full text-[1.5rem] text-ink bg-transparent border-none outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted/40"
            />
          </div>
        )}

        {/* Formatting Toolbar - Hidden in Take mode */}
        {!isTakeMode && (
        <div className="px-6 py-3 border-b border-black/[0.06] bg-[#fafafa] flex items-center gap-1 flex-wrap">
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
                    ? 'bg-purple-primary text-white'
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
                    ? 'bg-purple-primary text-white'
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
                ? 'bg-purple-primary text-white'
                : 'hover:bg-black/5 text-muted'
            }`}
            title="Drop Cap"
          >
            {icons.dropCap}
          </button>
        </div>
        )}

        {/* Content Editor - Hidden in Take mode */}
        {!isTakeMode && (
        <div className="p-6">
          <div
            ref={editorRef}
            contentEditable
            onInput={handleEditorInput}
            onKeyUp={updateFormattingState}
            onMouseUp={updateFormattingState}
            data-placeholder={currentType?.placeholder || "Let your thoughts flow freely..."}
            className={`editor-content w-full min-h-[280px] font-body text-[1.1rem] text-ink outline-none ${
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
        )}

        {/* Media Upload Section - Hidden in Take mode */}
        {!isTakeMode && (
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-ui text-[0.75rem] font-semibold tracking-wider uppercase text-muted">
              Media Attachments
            </span>
            <span className="font-ui text-[0.75rem] text-muted/60">
              ({mediaItems.length}/20)
            </span>
          </div>

          {mediaItems.length < 20 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-purple-primary/25 rounded-2xl p-6 text-center cursor-pointer hover:border-purple-primary/50 hover:bg-purple-primary/[0.02] transition-all"
            >
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white shadow-lg shadow-purple-primary/30">
                {icons.upload}
              </div>
              <p className="font-ui text-[0.95rem] text-ink mb-1">
                Drop files here or click to upload
              </p>
              <p className="font-body text-[0.85rem] text-muted">
                Images, videos, GIFs - Max 50MB each
              </p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {mediaItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              {mediaItems.map((item, index) => (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 group shadow-sm hover:shadow-lg transition-all"
                >
                  <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid text-white font-ui text-[0.7rem] font-semibold flex items-center justify-center z-10">
                    {index + 1}
                  </div>
                  <button
                    onClick={() => handleRemoveMedia(item.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 z-10"
                  >
                    {icons.x}
                  </button>
                  {item.type === "video" ? (
                    <video src={item.preview} className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.preview} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-all">
                    <input
                      type="text"
                      value={item.caption}
                      onChange={(e) => handleCaptionChange(item.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Add caption..."
                      className="w-full px-3 py-2 rounded-lg bg-white/95 font-body text-[0.85rem] text-ink outline-none placeholder:text-muted"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Creative Styling Section - Hidden in Take mode */}
        {!isTakeMode && (
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-purple-primary">{icons.background}</span>
            <span className="font-ui text-[0.75rem] font-semibold tracking-wider uppercase text-muted">
              Creative Styling
            </span>
          </div>

          <div className="space-y-4">
            {/* Background Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBackgroundPicker(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-primary/20 bg-white hover:border-purple-primary/50 hover:bg-purple-primary/5 transition-all"
              >
                {styling.background ? (
                  <div
                    className="w-6 h-6 rounded-lg border border-black/10"
                    style={{
                      background: styling.background.type === 'solid'
                        ? styling.background.value
                        : styling.background.type === 'gradient'
                        ? styling.background.value
                        : styling.background.type === 'image'
                        ? `url(${styling.background.imageUrl}) center/cover`
                        : '#f5f5f5'
                    }}
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg border-2 border-dashed border-purple-primary/30" />
                )}
                <span className="font-ui text-sm text-ink">
                  {styling.background ? 'Change Background' : 'Add Background'}
                </span>
              </button>
              {styling.background && (
                <button
                  onClick={() => setStyling({ ...styling, background: undefined })}
                  className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-muted hover:text-red-500 transition-colors"
                >
                  {icons.x}
                </button>
              )}
            </div>

          </div>
        </div>
        )}

        {/* Spotify Song Section - Hidden in Take mode */}
        {!isTakeMode && (
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[#1DB954]">{icons.spotify}</span>
            <span className="font-ui text-[0.75rem] font-semibold tracking-wider uppercase text-muted">
              Currently Listening
            </span>
            <span className="font-ui text-[0.75rem] text-muted/60">(optional)</span>
          </div>

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

        {/* Journal Metadata - shown only for journal type */}
        {!isTakeMode && selectedType === 'journal' && (
        <div className="px-6 pb-6">
          <JournalMetadataPanel
            value={journalMetadata}
            onChange={setJournalMetadata}
            location={postLocation}
            onLocationChange={setPostLocation}
          />
        </div>
        )}

        {/* Location Input - shown for all types except journal (which has it in metadata panel) */}
        {!isTakeMode && selectedType !== 'journal' && (
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-purple-primary">{icons.location}</span>
            <span className="font-ui text-[0.75rem] font-semibold tracking-wider uppercase text-muted">
              Location
            </span>
            <span className="font-ui text-[0.75rem] text-muted/60">(optional)</span>
          </div>
          <input
            type="text"
            value={postLocation}
            onChange={(e) => setPostLocation(e.target.value)}
            placeholder="Where are you writing from?"
            className="w-full px-4 py-2.5 rounded-xl border border-purple-primary/20 bg-white font-ui text-sm text-ink focus:outline-none focus:border-purple-primary transition-colors placeholder:text-muted/50"
          />
        </div>
        )}

        {/* Tags Section */}
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-purple-primary">{icons.tag}</span>
            <span className="font-ui text-[0.75rem] font-semibold tracking-wider uppercase text-muted">
              Tags
            </span>
            <span className="font-ui text-[0.75rem] text-muted/60">({tags.length}/20)</span>
          </div>

          <div className="flex flex-wrap gap-2 p-3 bg-[#fafafa] rounded-xl border-2 border-transparent focus-within:border-purple-primary focus-within:bg-white transition-all">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary rounded-full font-ui text-[0.85rem]"
              >
                #{tag}
                <button onClick={() => handleRemoveTag(tag)} className="hover:text-pink-vivid transition-colors">
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
                className="flex-1 min-w-[100px] font-ui text-[0.9rem] bg-transparent border-none outline-none placeholder:text-muted/40"
              />
            )}
          </div>
        </div>

        {/* Collaborators Section */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-purple-primary">{icons.collaborators}</span>
              <span className="font-ui text-[0.75rem] font-semibold tracking-wider uppercase text-muted">
                Collaborators
              </span>
              <span className="font-ui text-[0.75rem] text-muted/60">({collaborators.length}/10)</span>
            </div>
            <button
              onClick={() => setShowCollaboratorPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary rounded-full font-ui text-[0.8rem] font-medium hover:from-purple-primary/20 hover:to-pink-vivid/20 transition-all"
            >
              {icons.plus}
              Add
            </button>
          </div>

          {collaborators.length > 0 ? (
            <div className="p-3 bg-gradient-to-r from-purple-primary/5 to-pink-vivid/5 rounded-xl border border-purple-primary/10">
              <div className="flex flex-wrap gap-2">
                {collaborators.map((user) => (
                  <div
                    key={user.id}
                    className="inline-flex items-center gap-2 pl-1 pr-2 py-1 bg-white rounded-full border border-purple-primary/20 shadow-sm"
                  >
                    <div className="relative">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.display_name || user.username}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white text-xs font-medium">
                          {(user.display_name || user.username)[0].toUpperCase()}
                        </div>
                      )}
                      {user.is_verified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full flex items-center justify-center">
                          {icons.check}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-ink font-ui">
                      {user.display_name || user.username}
                    </span>
                    {user.role && (
                      <span className="text-xs px-2 py-0.5 bg-purple-primary/10 text-purple-primary rounded-full font-ui font-medium">
                        {user.role}
                      </span>
                    )}
                    <button
                      onClick={() => setCollaborators(collaborators.filter((c) => c.id !== user.id))}
                      className="w-4 h-4 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center transition-colors"
                    >
                      {icons.x}
                    </button>
                  </div>
                ))}
              </div>
              {!isEditing && (
                <p className="mt-3 text-xs text-muted font-ui flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Post will publish after all collaborators accept the invitation
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowCollaboratorPicker(true)}
              className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-center hover:border-purple-primary/40 hover:bg-purple-primary/5 transition-all group"
            >
              <div className="text-gray-400 group-hover:text-purple-primary transition-colors">
                {icons.collaborators}
              </div>
              <p className="mt-2 text-sm text-muted font-ui group-hover:text-purple-primary transition-colors">
                Invite people to collaborate on this post
              </p>
            </button>
          )}
        </div>

        {/* Tag People Section */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-pink-vivid">{icons.userTag}</span>
              <span className="font-ui text-[0.75rem] font-semibold tracking-wider uppercase text-muted">
                Tag People
              </span>
              <span className="font-ui text-[0.75rem] text-muted/60">({taggedPeople.length}/50)</span>
            </div>
            <button
              onClick={() => setShowTagPeoplePicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-vivid/10 to-warm-orange/10 text-pink-vivid rounded-full font-ui text-[0.8rem] font-medium hover:from-pink-vivid/20 hover:to-warm-orange/20 transition-all"
            >
              {icons.plus}
              Add
            </button>
          </div>

          {taggedPeople.length > 0 ? (
            <div className="p-3 bg-gradient-to-r from-pink-vivid/5 to-warm-orange/5 rounded-xl border border-pink-vivid/10">
              <div className="flex flex-wrap gap-2">
                {taggedPeople.map((user) => (
                  <div
                    key={user.id}
                    className="inline-flex items-center gap-2 pl-1 pr-2 py-1 bg-white rounded-full border border-pink-vivid/20 shadow-sm"
                  >
                    <div className="relative">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.display_name || user.username}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-vivid to-warm-orange flex items-center justify-center text-white text-xs font-medium">
                          {(user.display_name || user.username)[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-ink font-ui">
                      @{user.username}
                    </span>
                    <button
                      onClick={() => setTaggedPeople(taggedPeople.filter((t) => t.id !== user.id))}
                      className="w-4 h-4 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center transition-colors"
                    >
                      {icons.x}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowTagPeoplePicker(true)}
              className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-center hover:border-pink-vivid/40 hover:bg-pink-vivid/5 transition-all group"
            >
              <div className="text-gray-400 group-hover:text-pink-vivid transition-colors">
                {icons.userTag}
              </div>
              <p className="mt-2 text-sm text-muted font-ui group-hover:text-pink-vivid transition-colors">
                Tag people in this post
              </p>
            </button>
          )}
        </div>

        {/* Content Warning Section */}
        <div className="px-6 pb-6">
          <div className="p-4 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-red-500">
                {icons.warning}
                <span className="font-ui text-[0.9rem] font-medium text-ink">Content Warning</span>
              </div>
              <button
                onClick={() => setHasContentWarning(!hasContentWarning)}
                className={`w-12 h-7 rounded-full transition-all relative ${
                  hasContentWarning ? "bg-gradient-to-r from-purple-primary to-pink-vivid" : "bg-gray-300"
                }`}
              >
                <div
                  className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    hasContentWarning ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>

            {hasContentWarning && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={contentWarning}
                  onChange={(e) => setContentWarning(e.target.value)}
                  placeholder="Describe the sensitive content..."
                  className="w-full px-4 py-3 rounded-lg border border-red-200 bg-white font-body text-[0.95rem] text-ink outline-none focus:border-red-400 transition-all placeholder:text-muted/50"
                />
                <div className="flex flex-wrap gap-2">
                  {contentWarningPresets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setContentWarning(preset)}
                      className="px-3 py-1.5 rounded-full border border-red-200 bg-white font-ui text-[0.75rem] text-red-500 hover:bg-red-50 transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {(error || takeError) && (
          <div className="mx-6 mb-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 font-ui text-[0.85rem]">
            {error || takeError}
          </div>
        )}

        {/* Take Upload Progress */}
        {isTakeMode && takeUploading && (
          <div className="mx-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-ui text-[0.85rem] text-muted">Uploading your Take...</span>
              <span className="font-ui text-[0.85rem] font-medium text-purple-primary">{Math.round(takeProgress)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-primary to-pink-vivid transition-all duration-300"
                style={{ width: `${takeProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-black/[0.06] bg-[#fafafa]">
          <div className="flex items-center gap-3">
            {/* Visibility Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowVisibilityMenu(!showVisibilityMenu)}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/[0.08] bg-white font-ui text-[0.85rem] text-muted hover:border-purple-primary hover:text-purple-primary transition-all"
              >
                {icons[currentVisibility?.icon || "globe"]}
                {currentVisibility?.label}
                {icons.chevronDown}
              </button>

              {showVisibilityMenu && (
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
                          ? "bg-purple-primary/10 text-purple-primary"
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
            {userCommunities.length > 0 && !isEditing && (
              <div className="relative">
                {selectedCommunity ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-purple-primary/30 bg-purple-primary/5 text-purple-primary font-ui text-[0.85rem]">
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
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white text-[0.5rem] font-bold">
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
                    onClick={() => setShowCommunityMenu(!showCommunityMenu)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/[0.08] bg-white text-muted hover:border-purple-primary hover:text-purple-primary font-ui text-[0.85rem] transition-all"
                  >
                    {icons.users}
                    <span>Community</span>
                    {icons.chevronDown}
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
                          ? "bg-purple-primary/10 text-purple-primary"
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
                            ? "bg-purple-primary/10 text-purple-primary"
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
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white text-[0.6rem] font-bold">
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
          </div>

          <div className="flex gap-3">
            {!isTakeMode && (
              <button className="px-5 py-2.5 rounded-full border border-black/[0.08] bg-white font-ui text-[0.9rem] text-muted hover:border-purple-primary hover:text-purple-primary transition-all">
                Save Draft
              </button>
            )}
            <button
              onClick={handlePublish}
              disabled={loading || takeUploading || (isTakeMode && !takeVideoFile)}
              className="px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.9rem] font-medium text-white shadow-lg shadow-purple-primary/30 hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
