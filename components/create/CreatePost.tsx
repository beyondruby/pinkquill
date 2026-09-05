"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunities } from "@/lib/hooks.legacy";
import type { SearchableUser } from "@/lib/hooks.legacy";
import { useDrafts, useAutoSave } from "@/lib/hooks/useDrafts";
import type { PostDraft } from "@/lib/hooks/useDrafts";
import { createNotification } from "@/lib/hooks/useNotifications";
import type { Community } from "@/lib/types";
import { useAudioUpload } from "@/lib/hooks/useAudioUpload";
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
import { getBackgroundStyle, isDarkBackground } from "@/lib/utils/background";
import { Spinner } from "@/components/ui/Loading";
import Button from "@/components/ui/Button";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import { PageFrame, PageHeader } from "@/components/layout/PageFrame";
import { ComposerSteps, Disclosure, Switch, FieldLabel } from "@/components/create/pieces";
import {
  POST_CATEGORIES,
  CATEGORY_ORDER,
  DEFAULT_FORMAT,
  getFormatsByCategory,
  getCategoryOf,
  getFormatSpec,
  type PostCategory,
  type FormatSpec,
} from "@/lib/feed-view/formats";
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

function clearInlineStyles(root: ParentNode, properties: Array<"color" | "highlight">) {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("[style]"));

  elements.forEach((element) => {
    if (properties.includes("color")) {
      element.style.color = "";
    }

    if (properties.includes("highlight")) {
      element.style.background = "";
      element.style.backgroundColor = "";
      element.style.borderRadius = "";
      element.style.padding = "";
    }

    if (!element.getAttribute("style")?.trim()) {
      element.removeAttribute("style");
    }
  });
}

function isHighlightSpan(node: Node | null): boolean {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  const el = node as HTMLElement;
  if (el.tagName !== "SPAN") return false;
  return Boolean(el.style.backgroundColor || el.style.background);
}

// Unwrap any highlight spans inside `root`: strip the highlight inline styles,
// and if that leaves the span with no attributes, replace it with its children
// so we don't accumulate empty wrappers each time the user toggles colors.
function unwrapHighlightSpansInTree(root: ParentNode) {
  const spans = Array.from(root.querySelectorAll<HTMLElement>("span"));
  spans.forEach((el) => {
    if (!isHighlightSpan(el)) return;
    el.style.backgroundColor = "";
    el.style.background = "";
    el.style.borderRadius = "";
    el.style.padding = "";
    if (!el.getAttribute("style")?.trim()) {
      el.removeAttribute("style");
    }
    if (!el.hasAttributes()) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }
  });
}

// Walk up from `marker` to (and including) `topAncestor`, splitting each
// element on the path so that `marker` ends up as a sibling of `topAncestor`
// at its parent level. Empty halves are pruned. This lets us "exit" out of
// any highlight wrappers around a selection without losing surrounding text.
function splitAroundMarker(topAncestor: HTMLElement, marker: Node) {
  const current: Node = marker;
  const stopAt = topAncestor.parentNode;
  while (current.parentNode && current.parentNode !== stopAt) {
    const parentEl = current.parentNode as HTMLElement;
    const grandparent = parentEl.parentNode;
    if (!grandparent) break;

    const rightClone = parentEl.cloneNode(false) as HTMLElement;
    let sibling = current.nextSibling;
    while (sibling) {
      const next = sibling.nextSibling;
      rightClone.appendChild(sibling);
      sibling = next;
    }

    grandparent.insertBefore(current, parentEl.nextSibling);
    grandparent.insertBefore(rightClone, current.nextSibling);

    if (!parentEl.firstChild) parentEl.remove();
    if (!rightClone.firstChild) rightClone.remove();
  }
}

// For each range boundary, walk up to find the outermost highlight ancestor
// (within the editor) and split it so the boundary lands outside any
// highlight wrapper. After this, extractContents + insertNode operates on a
// flat region and no orphan ancestor span can leak the previous highlight
// back over the new content.
function splitHighlightAncestorsAtRange(range: Range, editor: Element): void {
  const startMarker = document.createComment("hl-start");
  const endMarker = document.createComment("hl-end");

  const endTemp = range.cloneRange();
  endTemp.collapse(false);
  endTemp.insertNode(endMarker);

  const startTemp = range.cloneRange();
  startTemp.collapse(true);
  startTemp.insertNode(startMarker);

  function findOutermostHighlightAncestor(node: Node): HTMLElement | null {
    let outermost: HTMLElement | null = null;
    let n: Node | null = node.parentNode;
    while (n && n !== editor) {
      if (isHighlightSpan(n)) outermost = n as HTMLElement;
      n = n.parentNode;
    }
    return outermost;
  }

  const startAncestor = findOutermostHighlightAncestor(startMarker);
  if (startAncestor) splitAroundMarker(startAncestor, startMarker);

  const endAncestor = findOutermostHighlightAncestor(endMarker);
  if (endAncestor) splitAroundMarker(endAncestor, endMarker);

  range.setStartAfter(startMarker);
  range.setEndBefore(endMarker);
  startMarker.remove();
  endMarker.remove();
}

// Families are the next/font CSS variables registered in app/layout.tsx; a
// literal family name would never resolve because next/font serves each font
// under a hashed name. The sanitizer (lib/utils/sanitize.ts) allows exactly
// these var() values on rendered post HTML.
const fontOptions = [
  // Serif fonts - great for literary content
  { id: "default", label: "Crimson Pro", family: "var(--font-crimson-pro), serif" },
  { id: "libre", label: "Libre Baskerville", family: "var(--font-libre-baskerville), serif" },
  { id: "playfair", label: "Playfair Display", family: "var(--font-playfair-display), serif" },
  { id: "lora", label: "Lora", family: "var(--font-lora), serif" },
  { id: "merriweather", label: "Merriweather", family: "var(--font-merriweather), serif" },
  { id: "spectral", label: "Spectral", family: "var(--font-spectral), serif" },
  { id: "eb-garamond", label: "EB Garamond", family: "var(--font-eb-garamond), serif" },
  { id: "cormorant", label: "Cormorant Garamond", family: "var(--font-cormorant-garamond), serif" },
  // Sans-serif fonts - clean and modern
  { id: "inter", label: "Inter", family: "var(--font-inter), sans-serif" },
  { id: "josefin", label: "Josefin Sans", family: "var(--font-josefin-sans), sans-serif" },
  { id: "poppins", label: "Poppins", family: "var(--font-poppins), sans-serif" },
  { id: "open-sans", label: "Open Sans", family: "var(--font-open-sans), sans-serif" },
  // Handwriting fonts - personal touch
  { id: "dancing", label: "Dancing Script", family: "var(--font-dancing-script), cursive" },
  { id: "caveat", label: "Caveat", family: "var(--font-caveat), cursive" },
  // Monospace - for code or typewriter effect
  { id: "source-code", label: "Source Code Pro", family: "var(--font-source-code-pro), monospace" },
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
  mic: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 3a3 3 0 00-3 3v5a3 3 0 006 0V6a3 3 0 00-3-3z" />
    </svg>
  ),
  waveform: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v4M9 6v12M12 3v18M15 6v12M19 10v4" />
    </svg>
  ),
  // Soundwave/music-note hybrid for the "Add sound" affordance (Page 1).
  soundWave: (
    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M4 12v0M7 9v6M10 6v12M13 8.5v7M16 5v14M19 9v6M22 12v0" />
    </svg>
  ),
  arrowLeft: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  arrowRight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  ),
};

// Category icons for the Page-2 format picker — plain, recognizable glyphs
// (document, picture, play, music) so the medium reads at a glance.
const categoryIcons: Record<PostCategory, React.ReactElement> = {
  read: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  seen: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  watched: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  heard: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
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
  type: "image" | "video" | "audio";
  isExisting?: boolean;
  media_url?: string;
  /** For audio items: duration in seconds (from useAudioUpload). */
  durationSec?: number;
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
  const audioInputRef = useRef<HTMLInputElement>(null);
  const musicCoverInputRef = useRef<HTMLInputElement>(null);
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
  const {
    communities: userCommunities,
    loading: communitiesLoading,
    error: communitiesError,
  } = useCommunities(user?.id, 'joined', { enabled: !!user });
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

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

  // Wizard step: 1 = Create (content), 2 = Format (optional). Takes keep their
  // own dedicated single-page flow and ignore the wizard steps.
  const [step, setStep] = useState<1 | 2>(1);

  // Page-2 format picker: which category tab is open. Starts unselected (no
  // pre-selection per the blueprint); selecting a format sets selectedType.
  const [activeCategory, setActiveCategory] = useState<PostCategory | null>(null);

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

  // Per-format optional metadata (stored in the post's `metadata` jsonb alongside
  // journal metadata — no new DB columns). Each is revealed only for its format.
  const [attribution, setAttribution] = useState(""); // Quote — who said it
  const [subtitle, setSubtitle] = useState(""); // Essay / Blog — subtitle

  // Music format — Spotify-publishing-style metadata for audio the user uploaded
  // on Page 1. Stored in post `metadata.music`; cover art uploaded as an image.
  const [musicArtist, setMusicArtist] = useState("");
  const [musicAlbum, setMusicAlbum] = useState("");
  const [musicGenre, setMusicGenre] = useState("");
  const [musicYear, setMusicYear] = useState("");
  const [musicCoverUrl, setMusicCoverUrl] = useState<string | null>(null);
  const [musicCoverUploading, setMusicCoverUploading] = useState(false);

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

  // Audio upload (Page-1 "Add sound" medium → post_media media_type 'audio')
  const { uploadAudio, uploading: audioUploading, error: audioError } = useAudioUpload();

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
      // Audio media isn't part of the draft snapshot shape; only image/video.
      mediaMetadata: mediaItems
        .filter((m): m is MediaItem & { type: "image" | "video" } => m.type !== "audio")
        .map(m => ({
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

  // The single attached sound (Page-1 audio medium), if any.
  const audioItem = mediaItems.find((m) => m.type === "audio");

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
        const loadedMetadata = (post.metadata || {}) as Record<string, unknown>;
        setJournalMetadata(loadedMetadata as JournalMetadata);
        setAttribution(typeof loadedMetadata.attribution === "string" ? loadedMetadata.attribution : "");
        setSubtitle(typeof loadedMetadata.subtitle === "string" ? loadedMetadata.subtitle : "");

        // Music format metadata (metadata.music = { artist, album, genre, year, coverUrl })
        const loadedMusic = (loadedMetadata.music && typeof loadedMetadata.music === "object"
          ? loadedMetadata.music
          : {}) as Record<string, unknown>;
        setMusicArtist(typeof loadedMusic.artist === "string" ? loadedMusic.artist : "");
        setMusicAlbum(typeof loadedMusic.album === "string" ? loadedMusic.album : "");
        setMusicGenre(typeof loadedMusic.genre === "string" ? loadedMusic.genre : "");
        setMusicYear(typeof loadedMusic.year === "string" ? loadedMusic.year : "");
        setMusicCoverUrl(typeof loadedMusic.coverUrl === "string" ? loadedMusic.coverUrl : null);

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
              type: m.media_type as "image" | "video" | "audio",
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
    clearInlineStyles(selectedContent, ["color"]);
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

    const editor = editorRef.current;
    if (!editor) {
      setShowHighlightMenu(false);
      return;
    }

    // Split any highlight wrappers around the selection so the previous
    // color can never leak back over the new content (and so "Remove
    // highlight" works even when the selection sits inside a highlight span).
    splitHighlightAncestorsAtRange(range, editor);

    const selectedContent = range.extractContents();
    unwrapHighlightSpansInTree(selectedContent);

    if (color === "transparent") {
      range.insertNode(selectedContent);
    } else {
      const span = document.createElement("span");
      span.style.backgroundColor = color;
      span.style.borderRadius = "2px";
      span.style.padding = "0 2px";
      span.appendChild(selectedContent);
      range.insertNode(span);

      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.addRange(newRange);
    }

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

  // Page-1 "Add sound" — upload audio to the post-audio bucket (via useAudioUpload)
  // and add it as a MediaItem with type "audio". Persisted on submit like media.
  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (!file) return;

    setError(null);
    const result = await uploadAudio(file, "sound");
    if (!result) {
      setError(audioError || "Could not upload that sound.");
      return;
    }

    const newItem: MediaItem = {
      id: crypto.randomUUID(),
      preview: result.url,
      media_url: result.url,
      caption: "",
      type: "audio",
      durationSec: result.durationSec,
    };
    setMediaItems((prev) => [...prev, newItem]);
  };

  const handleRemoveAudio = () => {
    setMediaItems((prev) => {
      const removed = prev.filter((m) => m.type === "audio" && m.isExisting);
      setDeletedMediaIds((ids) => [...ids, ...removed.map((m) => m.id)]);
      return prev.filter((m) => m.type !== "audio");
    });
  };

  // Music format — optional cover-art image upload (stored in metadata.music.coverUrl).
  const handleMusicCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (musicCoverInputRef.current) musicCoverInputRef.current.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      setError("Cover art must be an image.");
      return;
    }
    if (file.size > MAX_MEDIA_SIZE_BYTES) {
      setError("Cover art exceeds the 50MB limit.");
      return;
    }

    setError(null);
    setMusicCoverUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/music-covers/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("post-media")
        .upload(fileName, file, { cacheControl: "31536000" });
      if (uploadError) {
        setError(`Cover upload failed: ${uploadError.message}`);
        return;
      }
      const { data: urlData } = supabase.storage.from("post-media").getPublicUrl(fileName);
      setMusicCoverUrl(urlData.publicUrl);
    } finally {
      setMusicCoverUploading(false);
    }
  };

  // Page-2 format selection. Picking the same format again clears it back to the
  // default (Thought). Picking the Sound category's Music format reveals the
  // Spotify track control.
  const handleSelectFormat = useCallback(
    (formatId: string) => {
      setSelectedType((prev) => (prev === formatId ? DEFAULT_FORMAT : formatId));
    },
    []
  );

  // Advance from Step 1 (Create) to Step 2 (Format). Validates the same content
  // requirement as publishing so the user isn't surprised at the end.
  const handleGoToFormatStep = useCallback(() => {
    const plainText = editorRef.current?.innerText || "";
    if (!plainText.trim()) {
      setError("Please write something before continuing.");
      return;
    }
    setError(null);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Take-specific handlers
  const handleTakeVideoSelect = useCallback((file: File) => {
    setTakeValidationError(null);

    if (!file.type.startsWith("video/")) {
      setTakeValidationError("Please select a video file");
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      setTakeValidationError("Video must be under 200MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const durationCheckUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(durationCheckUrl);
      if (video.duration > 180) {
        setTakeValidationError("Video must be 3 minutes or less");
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
        takeAudioRef.current?.pause();
      } else {
        videoPreviewRef.current.playbackRate = takePlaybackSpeed;
        videoPreviewRef.current.volume = takeOriginalVolume / 100;
        videoPreviewRef.current.play();
        if (takeAudioRef.current && takeSelectedSound) {
          takeAudioRef.current.src = takeSelectedSound.audio_url;
          takeAudioRef.current.currentTime = takeSoundStartTime;
          takeAudioRef.current.volume = takeAddedVolume / 100;
          takeAudioRef.current.play();
        }
      }
      setIsTakePreviewPlaying(!isTakePreviewPlaying);
    }
  }, [isTakePreviewPlaying, takeAddedVolume, takeOriginalVolume, takePlaybackSpeed, takeSelectedSound, takeSoundStartTime]);

  useEffect(() => {
    if (videoPreviewRef.current) {
      videoPreviewRef.current.playbackRate = takePlaybackSpeed;
      videoPreviewRef.current.volume = takeOriginalVolume / 100;
      videoPreviewRef.current.muted = takeOriginalVolume === 0;
    }
    if (takeAudioRef.current) {
      takeAudioRef.current.volume = takeAddedVolume / 100;
    }
  }, [takeAddedVolume, takeOriginalVolume, takePlaybackSpeed]);

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
      // Audio media isn't part of the draft snapshot shape; only image/video.
      mediaMetadata: mediaItems
        .filter((m): m is MediaItem & { type: "image" | "video" } => m.type !== "audio")
        .map(m => ({
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

      // Merge journal metadata + per-format optional fields into one jsonb blob.
      // Each field is only included for the format that owns it, so switching
      // formats doesn't leave stale values behind.
      const mergedMetadata: Record<string, unknown> = {};
      if (selectedType === "journal") {
        Object.assign(mergedMetadata, journalMetadata);
      }
      if (selectedType === "quote" && attribution.trim()) {
        mergedMetadata.attribution = attribution.trim();
      }
      if ((selectedType === "essay" || selectedType === "blog") && subtitle.trim()) {
        mergedMetadata.subtitle = subtitle.trim();
      }
      // Music format — Spotify-publishing-style metadata (about the audio the user
      // uploaded on Page 1). No Spotify link/embed here.
      if (selectedType === "audio") {
        const music: Record<string, string> = {};
        if (musicArtist.trim()) music.artist = musicArtist.trim();
        if (musicAlbum.trim()) music.album = musicAlbum.trim();
        if (musicGenre.trim()) music.genre = musicGenre.trim();
        if (musicYear.trim()) music.year = musicYear.trim();
        if (musicCoverUrl) music.coverUrl = musicCoverUrl;
        if (Object.keys(music).length > 0) mergedMetadata.music = music;
      }
      const postMetadata = Object.keys(mergedMetadata).length > 0 ? mergedMetadata : null;

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

      // Persist new media. Image/video items still carry a File to upload to the
      // post-media bucket; audio items are already uploaded (via useAudioUpload to
      // the post-audio bucket) and only need a post_media row with their URL.
      const newMediaItems = mediaItems.filter(
        (m) => !m.isExisting && (m.file || (m.type === "audio" && m.media_url))
      );
      if (newMediaItems.length > 0) {
        let position = mediaItems.filter((m) => m.isExisting).length;
        for (const item of newMediaItems) {
          if (item.type === "audio" && item.media_url && !item.file) {
            // Already-uploaded audio — insert the row directly.
            const { error: audioInsertError } = await supabase.from("post_media").insert({
              post_id: postId,
              media_url: item.media_url,
              media_type: "audio",
              caption: item.caption.trim() || null,
              position,
            });

            if (audioInsertError) {
              console.error("Audio media insert error:", audioInsertError);
              failedMediaUploads += 1;
              continue;
            }
            position += 1;
            continue;
          }

          if (!item.file) continue;

          const fileExt = item.file.name.split(".").pop();
          const fileName = `${user.id}/${postId}/${position}-${Date.now()}.${fileExt}`;

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
            position,
          });

          if (mediaInsertError) {
            console.error("Post media insert error:", mediaInsertError);
            failedMediaUploads += 1;
            continue;
          }
          position += 1;
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
  const authoredBackground = styling.background;
  const hasAuthoredBackground = Boolean(authoredBackground);
  const authoredBackgroundIsDark = isDarkBackground(authoredBackground);
  const authoredBackgroundStyle = authoredBackground
    ? getBackgroundStyle(authoredBackground)
    : undefined;
  const authoredTextClass = hasAuthoredBackground
    ? authoredBackgroundIsDark
      ? "text-white"
      : "text-[#1e1e1e]"
    : "text-ink";
  const authoredPlaceholderClass = hasAuthoredBackground
    ? authoredBackgroundIsDark
      ? "empty:before:text-white/45"
      : "empty:before:text-[#4a4a4a]/50"
    : "empty:before:text-muted/40";

  if (!user) {
    return (
      <PageFrame width="narrow">
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">Sign in to create</p>
          <p className="pq-feed-state__text">Your studio is waiting. Sign in to start sharing what you make.</p>
          <div className="pq-feed-state__actions">
            <Button onClick={() => router.push("/login?redirect=%2Fcreate")}>Sign in</Button>
          </div>
        </div>
      </PageFrame>
    );
  }

  if (loadingPost) {
    return (
      <PageFrame width="narrow">
        <div className="pq-feed-state" role="status" aria-live="polite">
          <Spinner size="lg" />
          <p className="pq-feed-state__text">Opening your post…</p>
        </div>
      </PageFrame>
    );
  }

  const visualCount = mediaItems.filter((m) => m.type !== "audio").length;
  const shownCategory: PostCategory | null =
    activeCategory ?? (selectedType !== DEFAULT_FORMAT ? getCategoryOf(selectedType) : null);
  const shownFormats: FormatSpec[] = shownCategory ? getFormatsByCategory(shownCategory) : [];
  const hasFormatDetails =
    selectedType === "audio" || selectedType === "quote" || selectedType === "essay" || selectedType === "blog" || selectedType === "journal";

  const visibilityMenuItems: ActionMenuItem[] = visibilityOptions.map((option) => ({
    label: option.label,
    description: option.desc,
    icon: icons[option.icon],
    tone: visibility === option.id ? "accent" : "default",
    onSelect: () => setVisibility(option.id),
  }));

  const communityMenuItems: ActionMenuItem[] = [
    {
      label: "Personal feed",
      description: "Share to your own studio",
      icon: icons.globe,
      tone: !selectedCommunity ? "accent" : "default",
      onSelect: () => setSelectedCommunity(null),
    },
    ...userCommunities.map((community) => ({
      label: community.name,
      sectionLabel: "Your communities",
      icon: community.avatar_url ? (
        <img src={community.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
      ) : (
        <span className="pq-avatar" style={{ inlineSize: 20, blockSize: 20, fontSize: 10 }}>{community.name.charAt(0).toUpperCase()}</span>
      ),
      tone: (selectedCommunity?.id === community.id ? "accent" : "default") as ActionMenuItem["tone"],
      onSelect: () => setSelectedCommunity(community),
    })),
    ...(!communitiesLoading && communitiesError
      ? [{ label: "Communities unavailable right now", disabled: true }]
      : !communitiesLoading && userCommunities.length === 0
        ? [{ label: "No joined communities yet", disabled: true, sectionLabel: "Your communities" }]
        : []),
  ];

  const swatchGroups = (list: { id: string; color: string; label: string }[], groups: [string, number, number][], onPick: (c: string) => void) =>
    groups.map(([name, from, to]) => (
      <div key={name} className="pq-popover__group">
        <span className="pq-popover__group-label">{name}</span>
        <div className="pq-swatches">
          {list.slice(from, to).map((c) => (
            <button key={c.id} type="button" onClick={() => onPick(c.color)} className="pq-swatch" style={{ backgroundColor: c.color }} aria-label={c.label} title={c.label} />
          ))}
        </div>
      </div>
    ));

  const tool = (label: string, onClick: () => void, icon: React.ReactNode, pressed?: boolean) => (
    <button key={label} type="button" onClick={onClick} className="pq-tool" aria-label={label} title={label} aria-pressed={pressed}>
      {icon}
    </button>
  );

  return (
    <PageFrame width="reading">
      <div className="pq-composer">
        <PageHeader
          title={isEditing ? "Edit your post" : "Create"}
          lede={isEditing ? "Change anything, then update. Your original stays until you do." : "Words, photos, video, sound. Start with whatever you have; you can shape it after."}
          actions={!isEditing ? (
            <div className="pq-segmented" role="radiogroup" aria-label="What are you making?">
              <button
                type="button"
                role="radio"
                aria-checked={!isTakeMode}
                className="pq-segmented__option"
                onClick={() => {
                  if (isTakeMode) {
                    setSelectedType(DEFAULT_FORMAT);
                    setStep(1);
                  }
                }}
              >
                {icons.feather}
                Post
              </button>
              <button type="button" role="radio" aria-checked={isTakeMode} className="pq-segmented__option" onClick={() => setSelectedType("take")}>
                {icons.video}
                Take
              </button>
            </div>
          ) : undefined}
        />

        {step === 1 && showDraftRecovery && recoveredDraft && (
          <section className="pq-note" aria-label="Unsaved draft">
            <span className="pq-note__icon" aria-hidden="true">{icons.book}</span>
            <div className="flex-1 min-w-0">
              <p className="pq-note__title">You have an unsaved draft</p>
              <p className="pq-note__text">
                {recoveredDraft.title ? `“${recoveredDraft.title.substring(0, 50)}${recoveredDraft.title.length > 50 ? "…" : ""}”` : "Untitled"}
                {" · "}
                {new Date(recoveredDraft.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
              <div className="pq-note__actions">
                <Button size="sm" onClick={handleRecoverDraft}>Continue editing</Button>
                <Button size="sm" variant="secondary" onClick={handleDismissDraftRecovery}>Start fresh</Button>
                <Button size="sm" variant="ghost" onClick={handleDeleteRecoveredDraft}>Delete draft</Button>
              </div>
            </div>
          </section>
        )}

        {!isTakeMode && (
          <ComposerSteps
            steps={[{ n: 1, label: "Write" }, { n: 2, label: "Format & share" }]}
            current={step}
            onSelect={(n) => setStep(n as 1 | 2)}
          />
        )}

        {!isEditing && !isTakeMode && step === 1 && (
          <div>
            <FieldLabel hint="(optional)">Collection</FieldLabel>
            <CollectionSelector
              selectedCollection={selectedCollection}
              selectedItem={selectedCollectionItem}
              onSelectCollection={setSelectedCollection}
              onSelectItem={setSelectedCollectionItem}
            />
          </div>
        )}

        {/* Take Mode - Enhanced Video Upload Section */}
        {isTakeMode && (
          <div className="pq-panel">
            {/* Hidden audio for sound preview */}
            <audio ref={takeAudioRef} onEnded={() => setTakeSoundPlaying(false)} />

            {/* Upload State */}
            {!takeVideoPreview ? (
              <div
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all max-w-md mx-auto ${
                  takeDragActive
                    ? "border-purple-primary bg-purple-primary/5"
                    : "border-border-light hover:border-purple-primary/50 hover:bg-purple-primary/[0.02]"
                }`}
                onDrop={handleTakeDrop}
                onDragOver={handleTakeDragOver}
                onDragLeave={handleTakeDragLeave}
                onClick={() => videoInputRef.current?.click()}
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white">
                  {icons.video}
                </div>
                <p className="font-ui text-[1rem] text-ink font-medium mb-1">Upload your Take</p>
                <p className="font-body text-[0.85rem] text-muted">Drag & drop or click to browse</p>
                <p className="font-body text-[0.75rem] text-muted/60 mt-3">MP4 or MOV · Max 3 min · Max 200MB</p>
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
                        <div className="w-14 h-14 rounded-full bg-surface/90 flex items-center justify-center text-accent">
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
                      className="w-full p-3 rounded-xl border border-border-light bg-canvas font-body text-[0.9rem] text-ink resize-none outline-none focus:border-purple-primary focus:bg-surface transition-all placeholder:text-muted/50"
                    />
                    <div className="text-right font-ui text-[0.7rem] text-muted mt-1">{takeCaption.length}/500</div>
                  </div>

                  {/* Filters Section */}
                  <div className="border-t border-border-light pt-5">
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
                                    ? "border-purple-primary ring-2 ring-purple-primary/20"
                                    : "border-transparent"
                                }`}
                              >
                                <div
                                  className="w-full h-full bg-gradient-to-br from-purple-400 via-pink-400 to-orange-400"
                                  style={filter.style}
                                />
                              </div>
                              <span className={`text-[0.65rem] font-medium ${takeSelectedFilter === filter.name ? "text-accent" : "text-muted"}`}>
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
                                    : "bg-skeleton text-muted hover:bg-skeleton"
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
                  <div className="border-t border-border-light pt-5">
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
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-canvas rounded-xl">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white flex-shrink-0">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{takeSelectedSound.name}</p>
                                <p className="text-xs text-muted truncate">{takeSelectedSound.artist || "Original Sound"}</p>
                              </div>
                              <button onClick={() => setTakeSelectedSound(null)} className="p-1.5 hover:bg-black/10 rounded-full text-muted">{icons.x}</button>
                            </div>
                            {takeSelectedSound.duration > 0 && (
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted w-20">Start</span>
                                <input
                                  type="range"
                                  min="0"
                                  max={Math.max(0, takeSelectedSound.duration - 1)}
                                  value={Math.min(takeSoundStartTime, Math.max(0, takeSelectedSound.duration - 1))}
                                  onChange={(e) => setTakeSoundStartTime(Number(e.target.value))}
                                  className="flex-1 h-1.5 bg-skeleton rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500"
                                />
                                <span className="text-xs text-muted w-8 text-right">{takeSoundStartTime}s</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <input
                              type="text"
                              placeholder="Search sounds..."
                              value={takeSoundSearch}
                              onChange={(e) => setTakeSoundSearch(e.target.value)}
                              className="w-full p-2.5 rounded-lg border border-border-light bg-canvas text-sm outline-none focus:border-purple-primary"
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
                                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-skeleton transition-colors"
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
                            <input type="range" min="0" max="100" value={takeOriginalVolume} onChange={(e) => setTakeOriginalVolume(Number(e.target.value))} className="flex-1 h-1.5 bg-skeleton rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500" />
                            <span className="text-xs text-muted w-8 text-right">{takeOriginalVolume}%</span>
                          </div>
                          {takeSelectedSound && (
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted w-20">Added</span>
                              <input type="range" min="0" max="100" value={takeAddedVolume} onChange={(e) => setTakeAddedVolume(Number(e.target.value))} className="flex-1 h-1.5 bg-skeleton rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500" />
                              <span className="text-xs text-muted w-8 text-right">{takeAddedVolume}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Aspect Ratio Section */}
                  <div className="border-t border-border-light pt-5">
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
                                  : "bg-subtle text-muted hover:bg-skeleton"
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
                  <div className="border-t border-border-light pt-5">
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
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${!takeThumbnailPreview ? "border-purple-primary" : "border-transparent hover:border-gray-300"}`}
                          >
                            <img src={takeThumbnailFromVideo} alt="" className="w-full h-full object-cover" />
                            <span className="absolute bottom-1 left-1 right-1 text-[0.6rem] text-white text-center bg-black/50 rounded px-1 py-0.5">From Video</span>
                          </button>
                        ) : (
                          <div className="aspect-video rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-muted text-xs">Loading...</div>
                        )}
                        <button
                          onClick={() => thumbnailInputRef.current?.click()}
                          className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${takeThumbnailPreview ? "border-purple-primary" : "border-dashed border-gray-200 hover:border-gray-300"}`}
                        >
                          {takeThumbnailPreview ? (
                            <>
                              <img src={takeThumbnailPreview} alt="" className="w-full h-full object-cover" />
                              <span className="absolute bottom-1 left-1 right-1 text-[0.6rem] text-white text-center bg-black/50 rounded px-1 py-0.5">Custom</span>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-subtle">
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

        {!isTakeMode && (
          <div>
            <FieldLabel id="composer-title-label" hint="(optional)">Title</FieldLabel>
            <div
              ref={titleRef}
              contentEditable
              role="textbox"
              aria-labelledby="composer-title-label"
              onKeyUp={updateFormattingState}
              onMouseUp={updateFormattingState}
              onKeyDown={(e) => {
                if (e.key === "Tab" && !e.shiftKey) {
                  e.preventDefault();
                  editorRef.current?.focus();
                }
              }}
              data-placeholder="Give it a name, if it has one"
              className="pq-editor-title title-editor"
            />
          </div>
        )}

        {!isTakeMode && (
          <div role="toolbar" aria-label="Text formatting" className="pq-toolbar">
            <div className="pq-toolbar__group">
              {tool("Bold", handleBold, icons.bold, isBold)}
              {tool("Italic", handleItalic, icons.italic, isItalic)}
              {tool("Underline", handleUnderline, icons.underline, isUnderline)}
              {tool("Strikethrough", handleStrikethrough, icons.strikethrough)}
            </div>
            <div className="pq-toolbar__group">
              {tool("Heading", handleHeading, icons.heading)}
              {tool("Quote block", handleBlockquote, icons.quote2)}
              {tool("Bullet list", handleBulletList, icons.list)}
              {tool("Numbered list", handleOrderedList, icons.orderedList)}
              {tool("Divider", handleDivider, icons.divider)}
            </div>
            <div className="pq-toolbar__group">
              <div className="relative" data-dropdown-menu>
                <button
                  type="button"
                  onClick={() => { setShowFontMenu(!showFontMenu); setShowTextColorMenu(false); setShowHighlightMenu(false); }}
                  className="pq-tool"
                  aria-haspopup="listbox"
                  aria-expanded={showFontMenu}
                >
                  {icons.font}
                  <span>Font</span>
                  {icons.chevronDown}
                </button>
                {showFontMenu && (
                  <div className="pq-popover" role="listbox" aria-label="Font">
                    {fontOptions.map((font) => (
                      <button key={font.id} type="button" role="option" aria-selected={false} onClick={() => handleFontChange(font.family)} className="pq-popover__option" style={{ fontFamily: font.family }}>
                        {font.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" data-dropdown-menu>
                <button
                  type="button"
                  onClick={() => { setShowTextColorMenu(!showTextColorMenu); setShowHighlightMenu(false); setShowFontMenu(false); }}
                  className="pq-tool"
                  aria-label="Text colour"
                  title="Text colour"
                  aria-haspopup="dialog"
                  aria-expanded={showTextColorMenu}
                >
                  {icons.textColor}
                </button>
                {showTextColorMenu && (
                  <div className="pq-popover" role="group" aria-label="Text colour">
                    <p className="pq-popover__title">Text colour</p>
                    {swatchGroups(textColors, [["White & light", 0, 4], ["Grayscale", 4, 8], ["Warm", 8, 12], ["Nature", 12, 16], ["Cool", 16, 20], ["Vibrant", 20, 24], ["Light", 24, 28], ["Soft", 28, 32]], handleTextColor)}
                  </div>
                )}
              </div>
              <div className="relative" data-dropdown-menu>
                <button
                  type="button"
                  onClick={() => { setShowHighlightMenu(!showHighlightMenu); setShowTextColorMenu(false); setShowFontMenu(false); }}
                  className="pq-tool"
                  aria-label="Highlight"
                  title="Highlight"
                  aria-haspopup="dialog"
                  aria-expanded={showHighlightMenu}
                >
                  {icons.highlight}
                </button>
                {showHighlightMenu && (
                  <div className="pq-popover" role="group" aria-label="Highlight">
                    <p className="pq-popover__title">Highlight</p>
                    <button type="button" onClick={() => handleHighlight("transparent")} className="pq-popover__option">Remove highlight</button>
                    {swatchGroups(highlightColors, [["Light", 1, 4], ["Warm", 4, 8], ["Cool", 8, 12], ["Purple & pink", 12, 16]], handleHighlight)}
                  </div>
                )}
              </div>
            </div>
            <div className="pq-toolbar__group">
              {(["left", "center", "right", "justify"] as TextAlignment[]).map((align) =>
                tool(`Align ${align}`, () => setTextAlignment(align), icons[`align${align.charAt(0).toUpperCase() + align.slice(1)}` as keyof typeof icons], textAlignment === align)
              )}
            </div>
            <div className="pq-toolbar__group">
              {(["normal", "relaxed", "loose"] as LineSpacing[]).map((spacing) =>
                tool(`Line spacing ${spacing}`, () => setLineSpacing(spacing), <span>{spacing === "normal" ? "1×" : spacing === "relaxed" ? "1.5×" : "2×"}</span>, lineSpacing === spacing)
              )}
              {tool("Drop cap", () => setDropCapEnabled(!dropCapEnabled), icons.dropCap, dropCapEnabled)}
            </div>
            <div className="pq-toolbar__group">
              <button type="button" onClick={() => setShowBackgroundPicker(true)} className="pq-tool" aria-pressed={Boolean(styling.background)} aria-haspopup="dialog">
                {icons.background}
                <span>Background</span>
              </button>
            </div>
          </div>
        )}

        {!isTakeMode && (
          <div>
            <FieldLabel id="composer-body-label">Your words</FieldLabel>
            <div className="pq-editor-shell">
              {hasAuthoredBackground && authoredBackground && (
                <div
                  className="absolute inset-0"
                  aria-hidden="true"
                  style={{
                    ...authoredBackgroundStyle,
                    opacity: authoredBackground.type === "image" ? (authoredBackground.opacity ?? 1) : 1,
                    filter: authoredBackground.type === "image" && authoredBackground.blur ? `blur(${authoredBackground.blur}px)` : undefined,
                    transform: authoredBackground.type === "image" && authoredBackground.blur ? "scale(1.03)" : undefined,
                  }}
                />
              )}
              {authoredBackground?.type === "image" && <div className="absolute inset-0 bg-black/30" aria-hidden="true" />}
              <div
                ref={editorRef}
                contentEditable
                role="textbox"
                aria-multiline="true"
                aria-labelledby="composer-body-label"
                onInput={handleEditorInput}
                onKeyUp={updateFormattingState}
                onMouseUp={updateFormattingState}
                data-placeholder={currentType?.placeholder || "Let your thoughts flow freely..."}
                style={authoredBackgroundIsDark ? ({ "--editor-placeholder-color": "rgba(255, 255, 255, 0.75)" } as React.CSSProperties) : undefined}
                className={`editor-content relative z-10 w-full font-body text-[1.05rem] ${authoredTextClass} bg-transparent outline-none ${authoredPlaceholderClass} ${
                  textAlignment === "left" ? "text-left" : textAlignment === "center" ? "text-center" : textAlignment === "right" ? "text-right" : "text-justify"
                } ${lineSpacing === "normal" ? "leading-relaxed" : lineSpacing === "relaxed" ? "leading-[2]" : "leading-[2.5]"} ${dropCapEnabled ? "drop-cap-enabled" : ""}`}
              />
            </div>
            <p className={`pq-composer-count mt-1.5 ${charCount > 10000 ? "pq-composer-count--over" : charCount > 8000 ? "pq-composer-count--warn" : ""}`} aria-live="polite">
              {charCount.toLocaleString()} characters
            </p>
          </div>
        )}

        {!isTakeMode && (
          <div className="grid gap-3">
            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
            <input ref={audioInputRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg" onChange={handleAudioSelect} className="hidden" />

            <FieldLabel hint={visualCount > 0 ? `(${visualCount}/20)` : "(optional)"}>Photos and video</FieldLabel>

            {visualCount === 0 ? (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="pq-dropzone">
                {icons.image}
                <strong>Add photos or video</strong>
                <small>Up to 20 files. Drag and drop works too.</small>
              </button>
            ) : (
              <div className="pq-media-grid">
                {mediaItems.filter((m) => m.type !== "audio").map((item, index) => (
                  <div key={item.id} className="pq-media-item">
                    <div className="pq-media-item__frame">
                      <span className="pq-media-item__index" aria-hidden="true">{index + 1}</span>
                      <button type="button" onClick={() => handleRemoveMedia(item.id)} className="pq-media-item__remove" aria-label={`Remove item ${index + 1}`}>
                        {icons.x}
                      </button>
                      {item.type === "video" ? <video src={item.preview} /> : <img src={item.preview} alt="" />}
                    </div>
                    <input
                      type="text"
                      value={item.caption}
                      onChange={(e) => handleCaptionChange(item.id, e.target.value)}
                      placeholder="Caption"
                      aria-label={`Caption for item ${index + 1}`}
                      className="pq-media-item__caption"
                    />
                  </div>
                ))}
                {visualCount < 20 && (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="pq-media-add">
                    {icons.plus}
                    <span>Add more</span>
                  </button>
                )}
              </div>
            )}

            {audioItem ? (
              <div className="pq-sound">
                <span className="pq-sound__icon" aria-hidden="true">{icons.soundWave}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-sm font-medium text-ink">Sound attached</p>
                  <audio src={audioItem.preview} controls />
                </div>
                <button type="button" onClick={handleRemoveAudio} className="pq-icon-button" aria-label="Remove sound">
                  {icons.x}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => audioInputRef.current?.click()} disabled={audioUploading} className="pq-dropzone pq-dropzone--row" aria-busy={audioUploading || undefined}>
                {audioUploading ? <Spinner size="md" /> : icons.soundWave}
                <span>{audioUploading ? "Uploading sound…" : "Add a sound or a song you made"}</span>
              </button>
            )}
            {audioError && !audioItem && <p className="pq-alert" role="alert">{audioError}</p>}
          </div>
        )}

        {!isTakeMode && step === 2 && (
          <section className="pq-panel grid gap-5" aria-labelledby="format-title">
            <div>
              <h2 id="format-title" className="pq-panel__title">How should this read?</h2>
              <p className="pq-panel__text">Pick a format to shape how your post appears. Skip it and it stays a simple text post.</p>
            </div>

            <div className="pq-format-cats">
              {CATEGORY_ORDER.map((cat) => {
                const meta = POST_CATEGORIES[cat];
                const isActive = shownCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory((prev) => (prev === cat ? null : cat))}
                    className="pq-format-cat"
                    aria-pressed={isActive}
                  >
                    <span aria-hidden="true">{categoryIcons[cat]}</span>
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {shownCategory ? (
              <div className="pq-chip-row" role="group" aria-label="Format">
                {shownFormats.map((fmt) => (
                  <button key={fmt.id} type="button" onClick={() => handleSelectFormat(fmt.id)} className="pq-chip" aria-pressed={selectedType === fmt.id}>
                    {selectedType === fmt.id && icons.check}
                    {fmt.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="pq-panel__text">Choose one above to see its formats.</p>
            )}

            {hasFormatDetails && (
              <div className="pq-panel pq-panel--tint grid gap-4">
                <div>
                  <p className="pq-panel__title">A few details</p>
                  <p className="pq-panel__text">Optional. They help your {getFormatSpec(selectedType).label.toLowerCase()} read the way you mean it.</p>
                </div>

                {selectedType === "audio" && (
                  <div className="grid gap-4">
                    {!audioItem && (
                      <p className="pq-panel__text">Attach the track itself with “Add a sound” above. These details describe it.</p>
                    )}
                    <div className="pq-field-grid pq-field-grid--2">
                      <div>
                        <FieldLabel htmlFor="music-artist">Artist or creator</FieldLabel>
                        <input id="music-artist" type="text" value={musicArtist} onChange={(e) => setMusicArtist(e.target.value)} placeholder="Who made it?" className="pq-field pq-field--ui" />
                      </div>
                      <div>
                        <FieldLabel htmlFor="music-album" hint="(optional)">Album or single</FieldLabel>
                        <input id="music-album" type="text" value={musicAlbum} onChange={(e) => setMusicAlbum(e.target.value)} placeholder="Release name" className="pq-field pq-field--ui" />
                      </div>
                      <div>
                        <FieldLabel htmlFor="music-genre" hint="(optional)">Genre</FieldLabel>
                        <input id="music-genre" type="text" value={musicGenre} onChange={(e) => setMusicGenre(e.target.value)} placeholder="Lo-fi, jazz, pop…" className="pq-field pq-field--ui" />
                      </div>
                      <div>
                        <FieldLabel htmlFor="music-year" hint="(optional)">Release year</FieldLabel>
                        <input id="music-year" type="text" inputMode="numeric" value={musicYear} onChange={(e) => setMusicYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} placeholder="2026" className="pq-field pq-field--ui" />
                      </div>
                    </div>
                    <div>
                      <FieldLabel hint="(optional)">Cover art</FieldLabel>
                      <input ref={musicCoverInputRef} type="file" accept="image/*" onChange={handleMusicCoverSelect} className="hidden" />
                      {musicCoverUrl ? (
                        <div className="flex items-center gap-3">
                          <img src={musicCoverUrl} alt="Album cover art" className="w-16 h-16 rounded-[0.75rem] object-cover border border-line" />
                          <Button size="sm" variant="secondary" onClick={() => musicCoverInputRef.current?.click()}>Replace</Button>
                          <Button size="sm" variant="ghost" onClick={() => setMusicCoverUrl(null)}>Remove</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => musicCoverInputRef.current?.click()} loading={musicCoverUploading} loadingText="Uploading…">
                          Upload cover art
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {selectedType === "quote" && (
                  <div>
                    <FieldLabel htmlFor="quote-attribution" hint="(optional)">Attribution</FieldLabel>
                    <input id="quote-attribution" type="text" value={attribution} onChange={(e) => setAttribution(e.target.value)} placeholder="Who said it?" className="pq-field pq-field--ui" />
                  </div>
                )}

                {(selectedType === "essay" || selectedType === "blog") && (
                  <div>
                    <FieldLabel htmlFor="post-subtitle" hint="(optional)">Subtitle</FieldLabel>
                    <input id="post-subtitle" type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="A short line under the title" className="pq-field pq-field--ui" />
                  </div>
                )}

                {selectedType === "journal" && (
                  <JournalMetadataPanel value={journalMetadata} onChange={setJournalMetadata} location={postLocation} onLocationChange={setPostLocation} />
                )}
              </div>
            )}
          </section>
        )}

        {!isTakeMode && step === 2 && (
          <section aria-labelledby="extras-title" className="grid gap-3">
            <h2 id="extras-title" className="pq-panel__title">More, if you want it</h2>

            <div>
              <FieldLabel htmlFor="tag-input" hint={`(${tags.length}/20)`}>Tags</FieldLabel>
              <div className="pq-field pq-tag-field">
                {tags.map((tag) => (
                  <span key={tag} className="pq-chip">
                    #{tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="pq-chip__remove" aria-label={`Remove tag ${tag}`}>{icons.x}</button>
                  </span>
                ))}
                {tags.length < 20 && (
                  <input id="tag-input" type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} onBlur={handleAddTag} placeholder={tags.length === 0 ? "Add tags, press Enter after each" : "Add another"} />
                )}
              </div>
            </div>

            <div>
              {selectedType !== "audio" && (
                <Disclosure
                  id="soundtrack"
                  icon={icons.spotify}
                  label="Soundtrack"
                  state={spotifyTrack ? "1 song" : undefined}
                  open={expandedSections.has("soundtrack")}
                  onToggle={() => toggleSection("soundtrack")}
                >
                  {spotifyTrack ? (
                    <div className="pq-sound">
                      {spotifyTrack.albumArt && <img src={spotifyTrack.albumArt} alt="" className="w-12 h-12 rounded-[0.625rem] object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-ui text-sm font-medium text-ink truncate">{spotifyTrack.name}</p>
                        <p className="font-ui text-xs text-subdued truncate">{spotifyTrack.artist}</p>
                      </div>
                      <a href={spotifyTrack.externalUrl} target="_blank" rel="noopener noreferrer" className="pq-icon-button" aria-label="Open in Spotify">{icons.music}</a>
                      <button type="button" onClick={() => setSpotifyTrack(null)} className="pq-icon-button" aria-label="Remove song">{icons.x}</button>
                    </div>
                  ) : showSpotifyPicker ? (
                    <div className="grid gap-2">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={spotifyUrl}
                          onChange={(e) => setSpotifyUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && spotifyUrl.trim()) {
                              e.preventDefault();
                              fetchSpotifyTrack(spotifyUrl.trim());
                            }
                          }}
                          placeholder="Paste a Spotify track link"
                          aria-label="Spotify track link"
                          className="pq-field pq-field--ui flex-1"
                          autoFocus
                        />
                        <Button onClick={() => spotifyUrl.trim() && fetchSpotifyTrack(spotifyUrl.trim())} disabled={loadingSpotify || !spotifyUrl.trim()} loading={loadingSpotify} loadingText="Adding…">Add</Button>
                        <Button variant="secondary" onClick={() => { setShowSpotifyPicker(false); setSpotifyUrl(""); setSpotifyError(null); }}>Cancel</Button>
                      </div>
                      {spotifyError && <p className="pq-alert" role="alert">{spotifyError}</p>}
                      <p className="pq-panel__text">Copy a track link from the Spotify app or web player.</p>
                    </div>
                  ) : (
                    <div><Button variant="secondary" size="sm" onClick={() => setShowSpotifyPicker(true)}>Add a song</Button></div>
                  )}
                </Disclosure>
              )}

              {selectedType !== "journal" && (
                <Disclosure id="location" icon={icons.location} label="Place" state={postLocation ? "Added" : undefined} open={expandedSections.has("location")} onToggle={() => toggleSection("location")}>
                  <input type="text" value={postLocation} onChange={(e) => setPostLocation(e.target.value)} placeholder="Where are you writing from?" aria-label="Place" className="pq-field pq-field--ui" />
                </Disclosure>
              )}

              <Disclosure id="collaborators" icon={icons.collaborators} label="Collaborators" state={collaborators.length > 0 ? String(collaborators.length) : undefined} open={expandedSections.has("collaborators")} onToggle={() => toggleSection("collaborators")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="pq-panel__text">People who made this with you. The post publishes once everyone accepts.</p>
                  <Button size="sm" variant="secondary" onClick={() => setShowCollaboratorPicker(true)}>Add</Button>
                </div>
                {collaborators.length > 0 && (
                  <div className="pq-chip-row">
                    {collaborators.map((person) => (
                      <span key={person.id} className="pq-person-chip">
                        {person.avatar_url ? <img src={person.avatar_url} alt="" className="rounded-full object-cover" /> : <span className="pq-avatar">{(person.display_name || person.username)[0].toUpperCase()}</span>}
                        <span>{person.display_name || person.username}</span>
                        {person.role && <span className="pq-person-chip__role">{person.role}</span>}
                        <button type="button" onClick={() => setCollaborators(collaborators.filter((c) => c.id !== person.id))} className="pq-chip__remove" aria-label={`Remove ${person.display_name || person.username}`}>{icons.x}</button>
                      </span>
                    ))}
                  </div>
                )}
              </Disclosure>

              <Disclosure id="tag-people" icon={icons.userTag} label="Tag people" state={taggedPeople.length > 0 ? String(taggedPeople.length) : undefined} open={expandedSections.has("tagPeople")} onToggle={() => toggleSection("tagPeople")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="pq-panel__text">People mentioned in this post. They&rsquo;re notified.</p>
                  <Button size="sm" variant="secondary" onClick={() => setShowTagPeoplePicker(true)}>Add</Button>
                </div>
                {taggedPeople.length > 0 && (
                  <div className="pq-chip-row">
                    {taggedPeople.map((person) => (
                      <span key={person.id} className="pq-person-chip">
                        {person.avatar_url ? <img src={person.avatar_url} alt="" className="rounded-full object-cover" /> : <span className="pq-avatar">{(person.display_name || person.username)[0].toUpperCase()}</span>}
                        <span>@{person.username}</span>
                        <button type="button" onClick={() => setTaggedPeople(taggedPeople.filter((t) => t.id !== person.id))} className="pq-chip__remove" aria-label={`Remove @${person.username}`}>{icons.x}</button>
                      </span>
                    ))}
                  </div>
                )}
              </Disclosure>

              <Disclosure id="content-warning" icon={icons.warning} label="Content warning" state={hasContentWarning ? "On" : undefined} open={expandedSections.has("contentWarning")} onToggle={() => toggleSection("contentWarning")}>
                <div className="pq-switch-row">
                  <span id="cw-label">Blur this post until people choose to look</span>
                  <Switch checked={hasContentWarning} onChange={setHasContentWarning} label="Mark as sensitive" />
                </div>
                {hasContentWarning && (
                  <div className="grid gap-2">
                    <input type="text" value={contentWarning} onChange={(e) => setContentWarning(e.target.value)} placeholder="What should people know first?" aria-label="Content warning text" className="pq-field pq-field--ui" />
                    <div className="pq-chip-row">
                      {contentWarningPresets.map((preset) => (
                        <button key={preset} type="button" onClick={() => setContentWarning(preset)} className="pq-chip" aria-pressed={contentWarning === preset}>{preset}</button>
                      ))}
                    </div>
                  </div>
                )}
              </Disclosure>
            </div>
          </section>
        )}

        {(error || takeError) && <p className="pq-alert" role="alert">{error || takeError}</p>}

        {isTakeMode && takeUploading && (
          <div className="grid gap-1.5" role="status" aria-live="polite">
            <div className="flex items-center justify-between font-ui text-sm text-subdued">
              <span>Uploading your Take…</span>
              <span>{Math.round(takeProgress)}%</span>
            </div>
            <div className="pq-progress"><span style={{ inlineSize: `${takeProgress}%` }} /></div>
          </div>
        )}

        <div className="pq-composer-foot">
          <div className={`pq-composer-foot__audience ${isTakeMode || step === 2 ? "" : "hidden"}`}>
            {isCommunityPost ? (
              <span className="pq-chip" aria-disabled="true">{icons.users} Community (public)</span>
            ) : (
              <ActionMenu
                items={visibilityMenuItems}
                label="Who can see this"
                buttonAriaLabel={`Who can see this: ${currentVisibility?.label ?? "Public"}`}
                buttonClassName="pq-chip"
                trigger={<>{icons[currentVisibility?.icon || "globe"]}<span>{currentVisibility?.label}</span>{icons.chevronDown}</>}
                widthClassName="w-60"
                placement="top"
                align="start"
                portal
              />
            )}

            {!isEditing && (selectedCommunity || userCommunities.length > 0 || communitiesLoading || authLoading) && (
              <div className="flex items-center gap-1">
                <ActionMenu
                  items={communityMenuItems}
                  label="Post to"
                  buttonAriaLabel={selectedCommunity ? `Posting to ${selectedCommunity.name}` : "Post to a community"}
                  buttonDisabled={authLoading}
                  buttonClassName="pq-chip"
                  trigger={
                    <>
                      {communitiesLoading || authLoading ? <Spinner size="xs" /> : selectedCommunity?.avatar_url ? <img src={selectedCommunity.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" /> : icons.users}
                      <span className="max-w-[9rem] truncate">{authLoading ? "Loading…" : selectedCommunity ? selectedCommunity.name : "Community"}</span>
                      {!authLoading && icons.chevronDown}
                    </>
                  }
                  widthClassName="w-64"
                  placement="top"
                  align="start"
                  portal
                />
                {selectedCommunity && (
                  <button type="button" onClick={() => setSelectedCommunity(null)} className="pq-icon-button" aria-label="Post to your personal feed instead">
                    {icons.x}
                  </button>
                )}
              </div>
            )}

            {flairCommunityId && (
              <FlairPicker communityId={flairCommunityId} selectedFlairId={selectedFlair?.id || null} onSelect={setSelectedFlair} />
            )}
          </div>

          <div className="pq-composer-foot__actions">
            {!isTakeMode && step === 2 && (
              <Button variant="secondary" onClick={() => setStep(1)}>
                {icons.arrowLeft}
                Back
              </Button>
            )}
            {!isTakeMode && (
              <Button variant="secondary" onClick={handleSaveDraft} disabled={draftSaveStatus === "saving"} loading={draftSaveStatus === "saving"} loadingText="Saving…">
                {draftSaveStatus === "saved" ? <>{icons.check} Draft saved</> : "Save draft"}
              </Button>
            )}
            {!isTakeMode && step === 1 && (
              <Button onClick={handleGoToFormatStep}>
                Next
                {icons.arrowRight}
              </Button>
            )}
            {(isTakeMode || step === 2) && (
              <Button
                onClick={handlePublish}
                disabled={isTakeMode && !takeVideoFile}
                loading={loading || takeUploading}
                loadingText={isTakeMode ? `Uploading… ${Math.round(takeProgress)}%` : isEditing ? "Updating…" : "Publishing…"}
              >
                {isTakeMode ? "Post Take" : isEditing ? "Update" : "Publish"}
              </Button>
            )}
          </div>
        </div>
      </div>

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

      {showBackgroundPicker && (
        <BackgroundPicker
          value={styling.background || null}
          onChange={(background) => setStyling({ ...styling, background: background || undefined })}
          onClose={() => setShowBackgroundPicker(false)}
        />
      )}
    </PageFrame>
  );
}
