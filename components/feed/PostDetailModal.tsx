"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useComments, useToggleSave, useToggleRelay, useToggleReaction, useReactionCounts, useUserReaction, useBlock, createNotification, ReactionType } from "@/lib/hooks";
import type { PostUpdate } from "@/components/providers/ModalProvider";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import CommentItem from "@/components/feed/CommentItem";
import ReactionPicker from "@/components/feed/ReactionPicker";
import { supabase } from "@/lib/supabase";
import { icons } from "@/components/ui/Icons";
import PostTags from "@/components/feed/PostTags";
import { PostStyling, JournalMetadata, PostBackground, TimeOfDay, WeatherType, MoodType, SpotifyTrack } from "@/lib/types";

// Helper to sanitize and clean HTML for display
function cleanHtmlForDisplay(html: string): string {
  // First sanitize to prevent XSS attacks
  // Note: 'style' attribute removed to prevent CSS injection attacks
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
  });
  // Then clean up &nbsp; entities
  return sanitized.replace(/&nbsp;/g, ' ');
}

// Convert number to Roman numeral
function toRomanNumeral(num: number): string {
  const romanNumerals: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  for (const [value, numeral] of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

// Generate background CSS from PostBackground
function getBackgroundStyle(background?: PostBackground): React.CSSProperties {
  if (!background) return {};

  switch (background.type) {
    case 'solid':
      return { backgroundColor: background.value };
    case 'gradient':
      return { background: background.value };
    case 'pattern':
      // Pattern values are stored as full CSS, use them directly
      const patternValue = background.value;
      // Determine appropriate background size based on pattern type
      let backgroundSize = 'auto';
      if (patternValue.includes('dots') || patternValue.includes('radial-gradient(circle at 1px')) {
        backgroundSize = '20px 20px';
      } else if (patternValue.includes('grid') || patternValue.includes('linear-gradient(rgba')) {
        backgroundSize = '20px 20px';
      } else if (patternValue.includes('notebook')) {
        backgroundSize = '100% 24px';
      }
      return {
        background: patternValue,
        backgroundSize: backgroundSize,
      };
    case 'image':
      return {
        backgroundImage: `url(${background.imageUrl || background.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    default:
      return {};
  }
}

// Weather icons for journal display
const weatherIcons: Record<string, React.ReactNode> = {
  'sunny': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  'partly-cloudy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-4.9 4.03A5 5 0 0 0 3 11a5 5 0 0 0 5 5h9a4 4 0 0 0 0-8h-.35A5 5 0 0 0 12 2z"/></svg>,
  'cloudy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 18H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 18z"/></svg>,
  'rainy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM8 17l-2 4M12 17l-2 4M16 17l-2 4"/></svg>,
  'stormy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM13 14l-4 8h5l-1 4"/></svg>,
  'snowy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM8 16h.01M12 16h.01M16 16h.01M8 20h.01M12 20h.01M16 20h.01"/></svg>,
  'foggy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 14h16M4 18h12M4 10h8"/></svg>,
  'windy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9.59 4.59A2 2 0 1 1 11 8H2M12.59 19.41A2 2 0 1 0 14 16H2M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/></svg>,
};

// Time of day icons
const timeOfDayIcons: Record<string, React.ReactNode> = {
  'morning': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7a5 5 0 0 0 0 10M2 12h2M20 12h2M6.34 6.34l1.42 1.42M16.24 16.24l1.42 1.42M6.34 17.66l1.42-1.42M16.24 7.76l1.42-1.42"/></svg>,
  'afternoon': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  'evening': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v3M18.36 5.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M5.64 18.36l2.12-2.12M3 12h3M5.64 5.64l2.12 2.12"/></svg>,
  'night': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
};

// Mood icons
const moodIcons: Record<string, React.ReactNode> = {
  'reflective': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>,
  'joyful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>,
  'melancholic': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/></svg>,
  'peaceful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14h8M9 9h.01M15 9h.01"/></svg>,
  'anxious': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M8 9h2M14 9h2"/></svg>,
  'grateful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  'creative': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  'nostalgic': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  'hopeful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  'contemplative': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>,
  'excited': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
  'curious': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  'serene': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>,
  'restless': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>,
  'inspired': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>,
  'determined': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>,
  'vulnerable': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>,
  'content': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  'overwhelmed': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  'lonely': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
};

// Calculate luminance from hex color
function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length < 6) return 1; // Default to light if invalid
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Extract hex colors from a gradient string
function extractColorsFromGradient(gradient: string): string[] {
  const hexPattern = /#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g;
  return gradient.match(hexPattern) || [];
}

// Determine if background is dark to adjust text color
function isDarkBackground(background?: PostBackground): boolean {
  if (!background) return false;

  // Solid colors - check luminance directly
  if (background.type === 'solid') {
    return getLuminance(background.value) < 0.5;
  }

  // Image backgrounds are always treated as dark (overlay added)
  if (background.type === 'image') return true;

  // Gradients - analyze the colors in the gradient
  if (background.type === 'gradient') {
    const colors = extractColorsFromGradient(background.value);
    if (colors.length === 0) return false;

    // Calculate average luminance of all colors in gradient
    const avgLuminance = colors.reduce((sum, color) => sum + getLuminance(color), 0) / colors.length;
    return avgLuminance < 0.5;
  }

  // Patterns - check if it contains dark colors
  if (background.type === 'pattern') {
    const colors = extractColorsFromGradient(background.value);
    if (colors.length === 0) return false;
    const avgLuminance = colors.reduce((sum, color) => sum + getLuminance(color), 0) / colors.length;
    return avgLuminance < 0.4; // Slightly stricter for patterns
  }

  return false;
}

// Post type styling configuration with icons and gradients
const postTypeStyles: Record<string, { icon: React.ReactNode; gradient: string; label: string; prefix: string }> = {
  poem: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>,
    gradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    label: "Poem",
    prefix: "wrote a"
  },
  journal: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    gradient: "from-purple-primary via-pink-vivid to-orange-warm",
    label: "Journal",
    prefix: "wrote in their"
  },
  thought: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
    gradient: "from-amber-400 via-orange-500 to-red-500",
    label: "Thought",
    prefix: "shared a"
  },
  essay: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    gradient: "from-emerald-400 via-teal-500 to-cyan-500",
    label: "Essay",
    prefix: "wrote an"
  },
  story: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
    gradient: "from-blue-400 via-indigo-500 to-purple-600",
    label: "Story",
    prefix: "shared a"
  },
  letter: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
    gradient: "from-rose-400 via-pink-500 to-red-400",
    label: "Letter",
    prefix: "wrote a"
  },
  screenplay: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
    gradient: "from-slate-400 via-zinc-500 to-neutral-600",
    label: "Screenplay",
    prefix: "wrote a"
  },
  quote: {
    icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>,
    gradient: "from-yellow-400 via-amber-500 to-orange-500",
    label: "Quote",
    prefix: "shared a"
  },
  visual: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    gradient: "from-pink-400 via-rose-500 to-red-500",
    label: "Visual Story",
    prefix: "shared a"
  },
  audio: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
    gradient: "from-green-400 via-emerald-500 to-teal-500",
    label: "Voice Note",
    prefix: "recorded a"
  },
  video: {
    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    gradient: "from-red-400 via-rose-500 to-pink-500",
    label: "Video",
    prefix: "shared a"
  }
};

// Icon color map for post types
const iconColorMap: Record<string, string> = {
  poem: "#8b5cf6",
  journal: "#8e44ad",
  thought: "#f59e0b",
  essay: "#10b981",
  story: "#6366f1",
  letter: "#f43f5e",
  screenplay: "#71717a",
  quote: "#eab308",
  visual: "#ec4899",
  audio: "#22c55e",
  video: "#ef4444"
};

// Styled post type label component
function StyledTypeLabel({ type, isDark = false }: { type: string; isDark?: boolean }) {
  const style = postTypeStyles[type];
  if (!style) return <span>{type}</span>;

  return (
    <span className="inline-flex items-center gap-1">
      {style.prefix}{" "}
      <span className={`inline-flex items-center gap-1 font-medium bg-gradient-to-r ${style.gradient} bg-clip-text text-transparent`}>
        <span style={{ color: iconColorMap[type] || "#8e44ad" }}>{style.icon}</span>
        {style.label}
      </span>
    </span>
  );
}

interface TaggedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CollaboratorUser {
  role?: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Author {
  name: string;
  handle: string;
  avatar: string;
}

interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  position: number;
}

interface Post {
  id: string;
  authorId?: string;
  author: Author;
  type: "poem" | "journal" | "thought" | "visual" | "audio" | "video" | "essay" | "blog" | "story" | "letter" | "quote";
  typeLabel: string;
  timeAgo: string;
  createdAt?: string;
  title?: string;
  content: string;
  contentWarning?: string;
  media?: MediaItem[];
  image?: string;
  stats: {
    admires: number;
    comments: number;
    relays: number;
  };
  isAdmired?: boolean;
  isSaved?: boolean;
  isRelayed?: boolean;
  mentions?: TaggedUser[];
  hashtags?: string[];
  collaborators?: CollaboratorUser[];
  // Creative styling
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: JournalMetadata | null;
  spotify_track?: SpotifyTrack | null;
}

// Format date as "January 2, 2026"
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// Format time as "10:42 PM"
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Format time of day label
function formatTimeOfDay(timeOfDay?: string): string {
  const labels: Record<string, string> = {
    'morning': 'Morning',
    'afternoon': 'Afternoon',
    'evening': 'Evening',
    'night': 'Night'
  };
  return timeOfDay ? labels[timeOfDay] || timeOfDay : '';
}

// Format mood label
function formatMood(mood?: string): string {
  if (!mood) return '';
  return mood.charAt(0).toUpperCase() + mood.slice(1);
}

// Format weather label
function formatWeather(weather?: string): string {
  if (!weather) return '';
  const labels: Record<string, string> = {
    'sunny': 'Sunny',
    'partly-cloudy': 'Partly Cloudy',
    'cloudy': 'Cloudy',
    'rainy': 'Rainy',
    'stormy': 'Stormy',
    'snowy': 'Snowy',
    'foggy': 'Foggy',
    'windy': 'Windy'
  };
  return labels[weather] || weather;
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onPostUpdate?: (update: PostUpdate) => void;
  onPostDeleted?: (postId: string) => void;
}

export default function PostDetailModal({
  post,
  isOpen,
  onClose,
  onPostUpdate,
  onPostDeleted,
}: PostDetailModalProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showContent, setShowContent] = useState(true);

  const menuRef = useRef<HTMLDivElement>(null);
  const { blockUser } = useBlock();

  const { comments, loading: commentsLoading, addComment, toggleLike, deleteComment } = useComments(post?.id || "", user?.id);
  const { toggle: toggleSave } = useToggleSave();
  const { toggle: toggleRelay } = useToggleRelay();

  // Reaction system hooks
  const { react: toggleReaction, removeReaction } = useToggleReaction();
  const { counts: reactionCounts } = useReactionCounts(post?.id || "");
  const { reaction: userReaction, setReaction: setUserReaction } = useUserReaction(post?.id || "", user?.id);

  const hasMedia = post?.media && post.media.length > 0;
  const postUrl = typeof window !== 'undefined' && post ? `${window.location.origin}/post/${post.id}` : '';
  const isOwner = user && post?.authorId && user.id === post.authorId;

  // Sync state when post changes
  useEffect(() => {
    if (post) {
      setIsSaved(post.isSaved || false);
      setIsRelayed(post.isRelayed || false);
      setRelayCount(post.stats.relays);
      setCurrentMediaIndex(0);
      setShowContent(!post.contentWarning);
    }
  }, [post?.id, post?.isSaved, post?.isRelayed, post?.stats.relays, post?.contentWarning]);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleDelete = async () => {
    if (!post || !user) return;

    setDeleting(true);
    try {
      // Delete related data first
      await Promise.all([
        supabase.from("post_media").delete().eq("post_id", post.id),
        supabase.from("admires").delete().eq("post_id", post.id),
        supabase.from("reactions").delete().eq("post_id", post.id),
        supabase.from("saves").delete().eq("post_id", post.id),
        supabase.from("relays").delete().eq("post_id", post.id),
        supabase.from("comments").delete().eq("post_id", post.id),
        supabase.from("notifications").delete().eq("post_id", post.id),
      ]);

      // Delete the post
      const { error } = await supabase.from("posts").delete().eq("id", post.id);

      if (error) {
        console.error("Error deleting post:", error);
        setDeleting(false);
        return;
      }

      setShowDeleteConfirm(false);
      onClose();
      // Notify parent to remove post from list
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!post) return;
    onClose();
    router.push(`/create?edit=${post.id}`);
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !post) return;

    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        post_id: post.id,
        reporter_id: user.id,
        reason: reason,
        details: details || null,
      });

      if (error) {
        console.error("Error submitting report:", error);
        setReportSubmitting(false);
        return;
      }

      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    }
    setReportSubmitting(false);
  };

  const handleBlock = async () => {
    if (!user || !post?.authorId) return;

    setIsBlocking(true);
    try {
      await blockUser(user.id, post.authorId);
      setShowBlockConfirm(false);
      onClose();
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setIsBlocking(false);
    }
  };

  if (!post) return null;

  // Reaction handlers
  const handleReaction = async (reactionType: ReactionType) => {
    if (!user) {
      openAuthModal();
      return;
    }

    const isSameReaction = userReaction === reactionType;

    // Optimistic update
    if (isSameReaction) {
      setUserReaction(null);
    } else {
      setUserReaction(reactionType);
    }

    // Database update (real-time subscription will update counts)
    await toggleReaction(post.id, user.id, reactionType, userReaction);

    // Create notification for reaction (use actual reaction type)
    if (!isSameReaction && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, reactionType, post.id);
    }

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "reactions",
      isActive: !isSameReaction,
      countChange: isSameReaction ? -1 : (userReaction ? 0 : 1),
      reactionType: isSameReaction ? null : reactionType,
    });
  };

  const handleRemoveReaction = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!userReaction) return;

    // Optimistic update
    setUserReaction(null);

    // Database update
    await removeReaction(post.id, user.id);

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "reactions",
      isActive: false,
      countChange: -1,
      reactionType: null,
    });
  };

  const handleSave = async () => {
    if (!user) {
      openAuthModal();
      return;
    }

    const newIsSaved = !isSaved;

    // Optimistic update
    setIsSaved(newIsSaved);

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "saves",
      isActive: newIsSaved,
      countChange: 0,
    });

    // Database update
    await toggleSave(post.id, user.id, isSaved);

    // Create notification when saving (not when unsaving)
    if (newIsSaved && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, 'save', post.id);
    }
  };

  const handleRelay = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    // Can't relay your own posts
    if (user.id === post.authorId) return;

    const newIsRelayed = !isRelayed;
    const countChange = newIsRelayed ? 1 : -1;

    // Optimistic update
    setIsRelayed(newIsRelayed);
    setRelayCount((prev) => Math.max(0, prev + countChange));

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "relays",
      isActive: newIsRelayed,
      countChange,
    });

    // Database update
    await toggleRelay(post.id, user.id, isRelayed);

    // Create notification for relay
    if (newIsRelayed && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, "relay", post.id);
    }
  };

  const handleAddComment = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!commentText.trim()) return;

    setSubmitting(true);
    const result = await addComment(user.id, commentText.trim());
    if (result.success) {
      setCommentText("");
      // Create notification for comment
      if (post.authorId && post.authorId !== user.id) {
        await createNotification(post.authorId, user.id, 'comment', post.id, commentText.trim());
      }
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string, isLiked: boolean) => {
    if (!user) {
      openAuthModal();
      return;
    }
    toggleLike(commentId, user.id, isLiked);
  };

  const handleCommentReply = async (parentId: string, content: string) => {
    if (!user) {
      openAuthModal();
      return;
    }
    await addComment(user.id, content, parentId);
  };

  const handleCommentDelete = (commentId: string) => {
    deleteComment(commentId);
  };

  // Determine styling properties
  const hasBackground = post.styling?.background;
  const hasDarkBg = isDarkBackground(post.styling?.background);
  const textColorClass = hasDarkBg ? 'text-white' : 'text-ink';
  const mutedTextColorClass = hasDarkBg ? 'text-white/70' : 'text-muted';
  const borderColorClass = hasDarkBg ? 'border-white/10' : 'border-black/[0.06]';

  // Text styling
  const textAlignment = post.styling?.textAlignment || 'left';
  const lineSpacing = post.styling?.lineSpacing || 'normal';
  const dropCapEnabled = post.styling?.dropCap || false;

  const alignmentClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify'
  }[textAlignment];

  const lineSpacingClass = {
    normal: 'leading-relaxed',
    relaxed: 'leading-[2]',
    loose: 'leading-[2.5]'
  }[lineSpacing];

  // Media handling
  const media = post.media || [];


  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Outer wrapper with full background */}
      <div className="flex flex-col md:flex-row h-full w-full relative">
        {/* Background layer - covers entire modal */}
        {hasBackground && (
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              ...getBackgroundStyle(post.styling?.background),
              opacity: post.styling?.background?.type === 'image'
                ? (post.styling.background.opacity ?? 1)
                : 1,
              filter: post.styling?.background?.type === 'image' && post.styling.background.blur
                ? `blur(${post.styling.background.blur}px)`
                : undefined,
            }}
          />
        )}
        {/* Dark overlay for image backgrounds to ensure text readability */}
        {post.styling?.background?.type === 'image' && (
          <div className="absolute inset-0 bg-black/30 rounded-3xl" />
        )}

        {/* Main Content Area - Immersive Design */}
        <div
          className={`post-detail-content flex flex-col overflow-y-auto relative z-10 ${
            showComments ? "hidden md:flex md:flex-1 md:border-r" : "flex-1"
          } ${borderColorClass}`}
        >
          {/* Content wrapper with padding */}
          <div className="post-detail-wrapper relative p-4 md:p-6 flex flex-col flex-1">
            {/* Mobile Header Bar - Sticky on mobile */}
            <div className={`post-detail-header flex items-center gap-3 md:gap-4 mb-4 md:mb-6 pb-4 md:pb-6 border-b ${borderColorClass}`}>
              {/* Mobile Back Button */}
              <button
                onClick={onClose}
                className={`md:hidden w-10 h-10 -ml-1 rounded-full flex items-center justify-center transition-all ${
                  hasDarkBg ? 'text-white hover:bg-white/10' : 'text-ink hover:bg-black/5'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <Link href={`/studio/${post.author.handle.replace('@', '')}`} onClick={onClose}>
                <Image
                  src={post.author.avatar}
                  alt={post.author.name}
                  width={56}
                  height={56}
                  className={`w-10 h-10 md:w-14 md:h-14 rounded-full object-cover border-2 md:border-[3px] shadow-lg hover:scale-110 transition-transform ${
                    hasDarkBg ? 'border-white/30' : 'border-white'
                  }`}
                  sizes="56px"
                  quality={80}
                />
              </Link>
              <div className="flex flex-col gap-0.5 md:gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/studio/${post.author.handle.replace('@', '')}`}
                    onClick={onClose}
                    className={`font-ui text-[0.95rem] md:text-[1.1rem] font-medium transition-colors truncate ${
                      hasDarkBg ? 'text-white hover:text-white/80' : 'text-ink hover:text-purple-primary'
                    }`}
                  >
                    {post.author.name}
                  </Link>
                  <span className={`font-ui text-[0.8rem] md:text-[0.9rem] font-light hidden sm:inline ${mutedTextColorClass}`}>
                    <StyledTypeLabel type={post.type} isDark={hasDarkBg} />
                  </span>
                </div>
                <span className={`font-ui text-[0.75rem] md:text-[0.85rem] ${mutedTextColorClass}`}>
                  {post.timeAgo}
                </span>
              </div>
              {/* Desktop Discussion Button - with word */}
              <button
                onClick={() => setShowComments(!showComments)}
                className={`view-discussion-btn hidden md:flex ${hasDarkBg ? 'bg-white/10 text-white hover:bg-white/20' : ''}`}
              >
                {icons.comment}
                <span>Discussion</span>
                <span className={`badge ${hasDarkBg ? 'bg-white/20' : ''}`}>
                  {comments.length}
                </span>
              </button>
              {/* Mobile Discussion Button - hidden on mobile per user request */}

              {/* Post Options Menu */}
              {isOwner ? (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      hasDarkBg ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-muted hover:text-ink hover:bg-black/[0.04]'
                    }`}
                  >
                    {icons.moreHorizontal}
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-black/[0.08] overflow-hidden z-50 animate-fadeIn">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          handleEdit();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-ink hover:bg-black/[0.04] transition-colors"
                      >
                        {icons.edit}
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {icons.trash}
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ) : user && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      hasDarkBg ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-muted hover:text-ink hover:bg-black/[0.04]'
                    }`}
                  >
                    {icons.moreHorizontal}
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-black/[0.08] overflow-hidden z-50 animate-fadeIn">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowBlockConfirm(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-ink hover:bg-black/[0.04] transition-colors"
                      >
                        {icons.block}
                        Block
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowReportModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {icons.flag}
                        Report
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Journal Header - Beautiful date, time, and metadata */}
            {post.type === "journal" && post.createdAt && (
              <div className={`journal-header mb-8 ${hasDarkBg ? 'text-white' : ''}`}>
                {/* Date with Time on same line */}
                <div className="flex items-center gap-4 mb-4">
                  <h2 className={`font-display text-3xl md:text-4xl font-normal tracking-tight ${hasDarkBg ? 'text-white' : 'text-purple-primary'}`}>
                    {formatDate(post.createdAt)}
                  </h2>
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-ui ${
                    hasDarkBg
                      ? 'bg-white/10 text-white/70'
                      : 'bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary'
                  }`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {formatTime(post.createdAt)}
                  </span>
                </div>

                {/* Location, Weather, Mood - Same line with creative spacing */}
                {(post.post_location || post.metadata?.weather || post.metadata?.temperature || post.metadata?.mood) && (
                  <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 mb-5 ${hasDarkBg ? 'text-white/80' : 'text-ink/70'}`}>
                    {/* Location */}
                    {post.post_location && (
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 ${hasDarkBg ? 'text-white/50' : 'text-purple-primary/70'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span className="font-ui text-sm">{post.post_location}</span>
                      </div>
                    )}

                    {/* Separator dot */}
                    {post.post_location && (post.metadata?.weather || post.metadata?.temperature) && (
                      <span className={`hidden sm:block w-1 h-1 rounded-full ${hasDarkBg ? 'bg-white/30' : 'bg-purple-primary/30'}`} />
                    )}

                    {/* Weather with temperature */}
                    {(post.metadata?.weather || post.metadata?.temperature) && (
                      <div className="flex items-center gap-2">
                        <span className={`${hasDarkBg ? 'text-white/50' : 'text-purple-primary/70'}`}>
                          {post.metadata?.weather ? weatherIcons[post.metadata.weather] : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M14 4a6 6 0 00-6 6c0 2.5 1.5 4.5 3.5 5.5L10 20h4l-1.5-4.5c2-1 3.5-3 3.5-5.5a6 6 0 00-2-4.5" />
                            </svg>
                          )}
                        </span>
                        <span className="font-ui text-sm">
                          {post.metadata?.temperature}
                          {post.metadata?.temperature && post.metadata?.weather && <span className="mx-1 opacity-40">·</span>}
                          {post.metadata?.weather && formatWeather(post.metadata.weather)}
                        </span>
                      </div>
                    )}

                    {/* Separator dot */}
                    {(post.metadata?.weather || post.metadata?.temperature) && post.metadata?.mood && (
                      <span className={`hidden sm:block w-1 h-1 rounded-full ${hasDarkBg ? 'bg-white/30' : 'bg-purple-primary/30'}`} />
                    )}

                    {/* Mood with prefix */}
                    {post.metadata?.mood && (
                      <div className="flex items-center gap-2">
                        <span className={`${hasDarkBg ? 'text-white/50' : 'text-purple-primary/70'}`}>
                          {moodIcons[post.metadata.mood] || moodIcons['reflective']}
                        </span>
                        <span className="font-ui text-sm">
                          <span className={`${hasDarkBg ? 'text-white/40' : 'text-muted'}`}>Mood:</span>
                          {' '}
                          <span className="italic">{formatMood(post.metadata.mood)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Elegant divider line */}
                <div className={`h-px w-full ${hasDarkBg ? 'bg-gradient-to-r from-white/20 via-white/10 to-transparent' : 'bg-gradient-to-r from-purple-primary/30 via-pink-vivid/20 to-transparent'}`} />
              </div>
            )}

            {/* Non-journal location display */}
            {post.type !== "journal" && post.post_location && (
              <div className={`flex items-center gap-2 mb-4 ${mutedTextColorClass}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="font-ui text-sm">{post.post_location}</span>
              </div>
            )}

            {/* Spotify Track Embed */}
            {post.spotify_track && (
              <div className="mb-6">
                <div className={`rounded-xl overflow-hidden ${hasDarkBg ? 'bg-[#121212]' : 'bg-gradient-to-r from-[#1DB954]/5 to-[#191414]/5 border border-[#1DB954]/20'}`}>
                  {/* Spotify Embed Player */}
                  <iframe
                    src={`https://open.spotify.com/embed/track/${post.spotify_track.id}?utm_source=generator&theme=${hasDarkBg ? '0' : '1'}`}
                    width="100%"
                    height="152"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded-xl"
                    title={`${post.spotify_track.name} by ${post.spotify_track.artist}`}
                  />
                </div>
                <div className={`flex items-center justify-center gap-2 mt-2 ${mutedTextColorClass}`}>
                  <svg className="w-4 h-4 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  <span className="font-ui text-xs opacity-60">Listening to this track</span>
                </div>
              </div>
            )}

            {/* Post Content - Text color controlled by user styling */}
            <div className="flex-1 relative">
              {post.title && (
                <h2
                  className={`font-display text-[1.5rem] md:text-[2.2rem] font-semibold mb-4 md:mb-5 leading-[1.2] tracking-tight text-ink ${
                    post.type === "poem" || textAlignment === 'center' ? "text-center" : alignmentClass
                  }`}
                >
                  {post.title}
                </h2>
              )}

              {post.type === "poem" ? (
                <div
                  className={`font-body text-[1.05rem] md:text-[1.3rem] leading-loose italic text-center py-4 md:py-8 post-content text-ink ${dropCapEnabled ? 'drop-cap-enabled' : ''}`}
                  dangerouslySetInnerHTML={{ __html: cleanHtmlForDisplay(post.content) }}
                />
              ) : (
                <div
                  className={`font-body text-[0.95rem] md:text-[1.1rem] post-content text-ink ${alignmentClass} ${lineSpacingClass} ${dropCapEnabled ? 'drop-cap-enabled' : ''}`}
                  dangerouslySetInnerHTML={{ __html: cleanHtmlForDisplay(post.content) }}
                />
              )}

              {/* Media Gallery */}
              {hasMedia && (
                <div className="mt-4 md:mt-6 pb-6">
                  {/* Main Image Container - Clean single border */}
                  <div className={`relative group rounded-lg overflow-hidden border ${hasDarkBg ? 'border-white/20' : 'border-ink/10'}`}>
                    {media[currentMediaIndex]?.media_type === "video" ? (
                      <div className="relative bg-black">
                        <video
                          src={media[currentMediaIndex].media_url}
                          className="w-full h-auto max-h-[350px] md:max-h-[450px] object-contain"
                          controls
                          controlsList="nodownload"
                          playsInline
                          preload="none"
                          poster="/video-placeholder.svg"
                        />
                      </div>
                    ) : media[currentMediaIndex] && (
                      <div className="relative">
                        <Image
                          src={media[currentMediaIndex].media_url}
                          alt=""
                          width={900}
                          height={500}
                          className="w-full h-auto max-h-[350px] md:max-h-[450px] object-cover cursor-pointer"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('openLightbox', {
                              detail: { images: media, index: currentMediaIndex }
                            }));
                          }}
                          sizes="(max-width: 640px) 95vw, (max-width: 1024px) 600px, 700px"
                          quality={80}
                          priority={currentMediaIndex === 0}
                        />
                      </div>
                    )}

                    {/* Navigation Arrows */}
                    {media.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentMediaIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-ink/70 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-ink transition-all duration-200 z-10"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCurrentMediaIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center text-ink/70 opacity-0 group-hover:opacity-100 hover:bg-white hover:text-ink transition-all duration-200 z-10"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Caption - Roman numeral style like the reference */}
                  {media[currentMediaIndex]?.caption && (
                    <p className={`text-center mt-4 font-body text-[0.95rem] italic tracking-wide ${hasDarkBg ? 'text-white/60' : 'text-ink/50'}`}>
                      {toRomanNumeral(currentMediaIndex + 1)}. {media[currentMediaIndex].caption}
                    </p>
                  )}

                  {/* Thumbnail Strip - Elegant rounded squares */}
                  {media.length > 1 && (
                    <div className="flex gap-2 justify-center mt-4">
                      {media.map((item, idx) => (
                        <button
                          key={item.id || idx}
                          onClick={() => setCurrentMediaIndex(idx)}
                          className={`relative w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden transition-all duration-200 ${
                            idx === currentMediaIndex
                              ? "ring-2 ring-purple-primary/60 ring-offset-2"
                              : "opacity-50 hover:opacity-80"
                          }`}
                        >
                          {item.media_type === "video" ? (
                            <div className="relative w-full h-full bg-black">
                              <video src={item.media_url} className="w-full h-full object-cover" preload="metadata" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <Image src={item.media_url} alt="" width={64} height={64} className="w-full h-full object-cover" sizes="64px" quality={60} loading="lazy" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            {/* Legacy single image support */}
            {post.image && !hasMedia && (
              <Image
                src={post.image}
                alt={post.title || "Post image"}
                width={800}
                height={600}
                className="w-full rounded-xl mt-6 shadow-lg cursor-pointer hover:scale-[1.02] transition-transform"
                sizes="(max-width: 640px) 95vw, (max-width: 1024px) 600px, 700px"
                quality={80}
              />
            )}

            {/* Content Warning Overlay */}
            {post.contentWarning && !showContent && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-2xl bg-white/40 rounded-xl">
                <div className="relative text-center px-8 py-10">
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-ui text-sm font-semibold text-amber-700">Content Warning</span>
                  </div>

                  <p className="font-body text-base text-ink/80 mb-6 max-w-md mx-auto">{post.contentWarning}</p>

                  <button
                    onClick={() => setShowContent(true)}
                    className="px-6 py-2.5 rounded-full font-ui text-sm font-medium text-white bg-ink/80 hover:bg-ink transition-colors"
                  >
                    Show Content
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tags Section (Collaborators + Tagged People + Hashtags) */}
          <PostTags
            collaborators={post.collaborators}
            mentions={post.mentions}
            hashtags={post.hashtags}
            onNavigate={onClose}
          />

          {/* Actions - Floating action bar with adaptive colors */}
          <div className={`post-actions-bar flex items-center gap-1.5 md:gap-2 mt-6 pt-4 md:pt-6 border-t flex-wrap z-20 ${borderColorClass} ${hasDarkBg ? 'dark-bg' : ''}`}>
            {/* Reaction Picker */}
            <ReactionPicker
              currentReaction={userReaction}
              reactionCounts={reactionCounts}
              onReact={handleReaction}
              onRemoveReaction={handleRemoveReaction}
            />

            {/* Comment Button */}
            <button
              onClick={() => setShowComments(true)}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-full transition-all ${
                hasDarkBg
                  ? 'bg-white/15 text-white/90 hover:bg-white/25 hover:text-white'
                  : 'bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary'
              }`}
            >
              {icons.comment}
              {comments.length > 0 && <span className="text-xs md:text-sm font-medium">{comments.length}</span>}
            </button>

            {/* Relay Button - hidden for own posts */}
            {user?.id !== post.authorId && (
              <button
                onClick={handleRelay}
                disabled={!user}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-full transition-all ${
                  isRelayed
                    ? "bg-green-500/30 text-green-400"
                    : hasDarkBg
                      ? 'bg-white/15 text-white/90 hover:bg-white/25 hover:text-white'
                      : 'bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary'
                } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {icons.relay}
                {relayCount > 0 && <span className="text-xs md:text-sm font-medium">{relayCount}</span>}
              </button>
            )}

            {/* Share Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all ${
                hasDarkBg
                  ? 'bg-white/15 text-white/90 hover:bg-white/25 hover:text-white'
                  : 'bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary'
              }`}
            >
              {icons.share}
            </button>

            {/* Save/Bookmark Button */}
            <button
              onClick={handleSave}
              disabled={!user}
              className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all ${
                isSaved
                  ? "bg-amber-500/30 text-amber-400"
                  : hasDarkBg
                    ? 'bg-white/15 text-white/90 hover:bg-white/25 hover:text-white'
                    : 'bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary'
              } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isSaved ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              ) : (
                icons.bookmark
              )}
            </button>
          </div>
          </div>
        </div>

        {/* Comments Panel - Full screen on mobile */}
        {showComments && (
          <div className="discussion-panel absolute md:relative inset-0 md:inset-auto w-full md:w-auto bg-white z-40">
            {/* Comments Header */}
            <div className="p-4 md:p-5 border-b border-black/[0.06] bg-white/60 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {/* Back button on mobile */}
                <button
                  onClick={() => setShowComments(false)}
                  className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-ui text-[0.8rem] font-medium tracking-[0.12em] uppercase text-muted">
                  Discussion
                </span>
              </div>
              <button
                onClick={() => setShowComments(false)}
                className="hidden md:flex w-9 h-9 rounded-full items-center justify-center text-muted hover:text-pink-vivid hover:rotate-90 transition-all"
              >
                {icons.close}
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-6">
              {commentsLoading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="font-body text-muted italic">No comments yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      currentUserId={user?.id}
                      onLike={handleCommentLike}
                      onReply={handleCommentReply}
                      onDelete={handleCommentDelete}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Comment Input */}
            {user ? (
              <div className="p-4 bg-white border-t border-black/[0.06] flex gap-2.5 items-center">
                <Image
                  src={profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"}
                  alt="You"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  sizes="36px"
                  quality={80}
                />
                <div className="flex-1 flex items-center bg-[#f5f5f5] rounded-3xl px-4 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-primary focus-within:shadow-lg transition-all">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    placeholder="Add to the conversation..."
                    disabled={submitting}
                    className="flex-1 py-2.5 border-none bg-transparent outline-none font-body text-[0.95rem] text-ink placeholder:text-muted/60 placeholder:italic"
                  />
                </div>
                <button
                  onClick={handleAddComment}
                  disabled={submitting || !commentText.trim()}
                  className="w-[42px] h-[42px] rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center hover:scale-110 hover:shadow-lg hover:shadow-purple-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {icons.send}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-white border-t border-black/[0.06] text-center">
                <p className="font-ui text-[0.9rem] text-muted">
                  <a href="/login" className="text-purple-primary hover:underline">Sign in</a> to comment
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </Modal>

    {/* Share Modal - rendered outside main modal to avoid z-index issues */}
    {post && (
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={postUrl}
        title={post.title || post.content.substring(0, 150)}
        description={post.content}
        type={post.type}
        authorName={post.author.name}
        authorUsername={post.author.handle}
        authorAvatar={post.author.avatar}
        imageUrl={post.media && post.media.length > 0 ? post.media[0].media_url : ""}
      />
    )}

    {/* Delete Confirmation Modal */}
    {showDeleteConfirm && (
      <>
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-2xl shadow-2xl z-[2001] p-6">
          <h3 className="font-display text-xl text-ink mb-3">Delete Post?</h3>
          <p className="font-body text-sm text-muted mb-6">
            This action cannot be undone. This will permanently delete your post and remove all associated data including comments, admires, and saves.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </div>
      </>
    )}

    {/* Report Modal */}
    {/* Block Confirmation Modal */}
    {showBlockConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
          <h3 className="font-display text-lg font-semibold text-ink mb-2">
            Block @{post.author.handle}?
          </h3>
          <p className="font-body text-sm text-muted mb-6">
            They won&apos;t be able to see your posts, follow you, or message you. They won&apos;t be notified.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowBlockConfirm(false)}
              className="flex-1 py-2.5 rounded-full border border-black/10 font-ui text-sm font-medium text-ink hover:bg-black/[0.03] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBlock}
              disabled={isBlocking}
              className="flex-1 py-2.5 rounded-full bg-red-500 text-white font-ui text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isBlocking ? "Blocking..." : "Block"}
            </button>
          </div>
        </div>
      </div>
    )}

    {showReportModal && (
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        submitting={reportSubmitting}
        submitted={reportSubmitted}
      />
    )}
    </>
  );
}