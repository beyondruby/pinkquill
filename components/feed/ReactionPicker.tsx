"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { ReactionType, ReactionCounts } from "@/lib/types";
import type { EngagementKind } from "@/lib/engagement/store";
import ReactionBarFooter from "./ReactionBarFooter";
import ReactionsSheet from "./ReactionsSheet";

interface Reaction {
  type: ReactionType;
  label: string;
  icon: React.ReactNode;
}

// Branded reaction icons using purple, pink, and orange gradients
const reactionIcons: Record<ReactionType, React.ReactNode> = {
  admire: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="admireGradPicker" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill="url(#admireGradPicker)"
      />
    </svg>
  ),
  snap: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="snapGradPicker" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <path d="M12 2C12 2 10 4 10 6C10 8 12 8 12 8" stroke="url(#snapGradPicker)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M8.5 8C8.5 7 9 6 10 6C11 6 11.5 7 11.5 8V12" stroke="url(#snapGradPicker)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M11.5 9C11.5 8 12 7 13 7C14 7 14.5 8 14.5 9V12" stroke="url(#snapGradPicker)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M14.5 10C14.5 9 15 8 16 8C17 8 17.5 9 17.5 10V14C17.5 17 15.5 20 12 21C8.5 20 6.5 17 6.5 14V11C6.5 10 7 9 8 9C9 9 9.5 10 9.5 11" stroke="url(#snapGradPicker)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M4 4L6 6M20 4L18 6M12 1V3" stroke="url(#snapGradPicker)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  ovation: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="ovationGradPicker" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff9f43" />
          <stop offset="100%" stopColor="#ff007f" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="4" r="2.5" fill="url(#ovationGradPicker)" />
      <path d="M12 7V14M12 14L8 20M12 14L16 20" stroke="url(#ovationGradPicker)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 9L7 5M12 9L17 5" stroke="url(#ovationGradPicker)" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 3L5 4M20 3L19 4M4 7H5M19 7H20" stroke="url(#ovationGradPicker)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="supportGradPicker" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="50%" stopColor="#ff007f" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path d="M7 13C5.5 13 4 14.5 4 16C4 17.5 5 19 7 20H11C13 20 14.5 18.5 14.5 17" stroke="url(#supportGradPicker)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M17 13C18.5 13 20 14.5 20 16C20 17.5 19 19 17 20H13C11 20 9.5 18.5 9.5 17" stroke="url(#supportGradPicker)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M12 11l-.725-.66C9.4 8.736 8 7.64 8 6.25 8 5.06 8.92 4 10.25 4c.74 0 1.46.405 1.75 1.045C12.29 4.405 13.01 4 13.75 4 15.08 4 16 5.06 16 6.25c0 1.39-1.4 2.486-3.275 4.09L12 11z" fill="url(#supportGradPicker)" />
    </svg>
  ),
  inspired: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="inspiredGradPicker" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff007f" />
          <stop offset="50%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path d="M12 2C8.69 2 6 4.69 6 8C6 10.22 7.21 12.16 9 13.19V15C9 15.55 9.45 16 10 16H14C14.55 16 15 15.55 15 15V13.19C16.79 12.16 18 10.22 18 8C18 4.69 15.31 2 12 2Z" fill="url(#inspiredGradPicker)" />
      <path d="M10 18H14M10 20H14M11 16V18M13 16V18" stroke="url(#inspiredGradPicker)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 8H4M20 8H21M5.5 3.5L6.5 4.5M18.5 3.5L17.5 4.5" stroke="url(#inspiredGradPicker)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  applaud: (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <defs>
        <linearGradient id="applaudGradPicker" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8e44ad" />
          <stop offset="100%" stopColor="#ff9f43" />
        </linearGradient>
      </defs>
      <path d="M6 12C4.5 12 3 13.5 3 15.5C3 17.5 4.5 19 6 19L10 19C10 19 11 17 10 15L8 13C7.5 12.5 7 12 6 12Z" fill="url(#applaudGradPicker)" opacity="0.9" />
      <path d="M18 12C19.5 12 21 13.5 21 15.5C21 17.5 19.5 19 18 19L14 19C14 19 13 17 14 15L16 13C16.5 12.5 17 12 18 12Z" fill="url(#applaudGradPicker)" opacity="0.9" />
      <path d="M12 8V6M9 9L7.5 7.5M15 9L16.5 7.5M12 4V3" stroke="url(#applaudGradPicker)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.5 13L12 11L13.5 13" stroke="url(#applaudGradPicker)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// Outline version of heart for when no reaction is selected
const outlineHeart = (
  <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
    />
  </svg>
);

const reactions: Reaction[] = [
  { type: 'admire', label: 'Admire', icon: reactionIcons.admire },
  { type: 'snap', label: 'Snap', icon: reactionIcons.snap },
  { type: 'ovation', label: 'Ovation', icon: reactionIcons.ovation },
  { type: 'support', label: 'Support', icon: reactionIcons.support },
  { type: 'inspired', label: 'Inspired', icon: reactionIcons.inspired },
  { type: 'applaud', label: 'Applaud', icon: reactionIcons.applaud },
];

export type ReactionPickerVariant = "card" | "pill" | "overlay";

interface ReactionPickerProps {
  currentReaction: ReactionType | null;
  reactionCounts: ReactionCounts;
  /** False while only the total is known (list rows); the per-type numbers
   *  in the open bar stay blank until `onOpen` has loaded them. */
  countsLoaded?: boolean;
  onReact: (type: ReactionType) => void;
  onRemoveReaction: () => void;
  /** Fired when the bar opens — load per-type counts here. */
  onOpen?: () => void;
  disabled?: boolean;
  /**
   * card    — `.action-btn` inside a feed card / detail modal (default)
   * pill    — rounded pill used on the take modal and /take/[id]
   * overlay — vertical `.tiktok-action-btn` on the takes feed
   */
  variant?: ReactionPickerVariant;
  /** Which post / take this is. With both set, the open bar shows who
   *  reacted and opens the Reactions sheet with everyone. */
  kind?: EngagementKind;
  id?: string;
  /** Show the total beside the trigger icon (card / pill). */
  showCount?: boolean;
}

export const REACTION_OPTIONS: ReadonlyArray<{ type: ReactionType; label: string }> = reactions.map(({ type, label }) => ({ type, label }));

export function getReactionIcon(type: ReactionType): React.ReactNode {
  return reactionIcons[type];
}

export function getReactionLabel(type: ReactionType): string {
  const reaction = reactions.find(r => r.type === type);
  return reaction?.label || 'Admire';
}

export default function ReactionPicker({
  currentReaction,
  reactionCounts,
  countsLoaded = true,
  onReact,
  onRemoveReaction,
  onOpen,
  disabled = false,
  variant = "card",
  kind,
  id,
  showCount = true,
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);
  const [showMainTooltip, setShowMainTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [reactionTooltipPosition, setReactionTooltipPosition] = useState({ top: 0, left: 0 });
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reactionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const footerRef = useRef<HTMLButtonElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  // Touch: long-press opens the bar; the click that follows must not
  // toggle the default reaction. Synthetic mouseenter after a tap must not
  // hover-open it either.
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const lastTouchAtRef = useRef(0);
  // Count bump when the total changes (own click or someone else's).
  const [bump, setBump] = useState(false);
  const prevTotalRef = useRef(reactionCounts.total);

  const hasContent = !!kind && !!id;
  const total = reactionCounts.total;

  // For portal rendering
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIsMounted(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Update tooltip position
  const updateTooltipPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top - 8, // 8px above the button
        left: rect.left + rect.width / 2,
      });
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (prevTotalRef.current === reactionCounts.total) return;
    prevTotalRef.current = reactionCounts.total;
    setBump(true);
    const t = setTimeout(() => setBump(false), 320);
    return () => clearTimeout(t);
  }, [reactionCounts.total]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Hide the trigger tooltip and the option label, and stop the hover
  // timers that would bring them back. Called whenever the bar or the sheet
  // changes state, so no label survives a click, a press or a sheet open.
  const hideLabels = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setShowMainTooltip(false);
    setHoveredReaction(null);
  }, []);

  const closeBar = useCallback(() => {
    hideLabels();
    setIsOpen(false);
  }, [hideLabels]);

  // Hover must not reopen the bar (or show the tooltip) the moment the
  // sheet closes under a pointer that never moved.
  const ignoreHoverUntilRef = useRef(0);
  const closeSheet = useCallback(() => {
    ignoreHoverUntilRef.current = Date.now() + 800;
    hideLabels();
    setSheetOpen(false);
  }, [hideLabels]);

  // Tap outside closes a bar opened by touch / right-click.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) closeBar();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen, closeBar]);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openByPress = () => {
    hideLabels();
    setIsOpen(true);
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(12);
      } catch {
        /* unsupported */
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    lastTouchAtRef.current = Date.now();
    const t = e.touches[0];
    touchStartRef.current = t ? { x: t.clientX, y: t.clientY } : null;
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      suppressClickRef.current = true;
      openByPress();
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const start = touchStartRef.current;
    if (!t || !start) return;
    if (Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) clearLongPress();
  };

  const handleTouchEnd = () => {
    lastTouchAtRef.current = Date.now();
    clearLongPress();
  };

  // Right-click (desktop) and the long-press context menu (Android).
  const handleContextMenu = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 600);
    openByPress();
  };

  // Handle mouse enter with delay
  const handleMouseEnter = () => {
    if (disabled) return;
    if (Date.now() - lastTouchAtRef.current < 1000) return; // synthetic hover after a tap
    if (Date.now() < ignoreHoverUntilRef.current) return; // the sheet just closed
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Show tooltip immediately, open the bar after delay
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }

    updateTooltipPosition();

    tooltipTimeoutRef.current = setTimeout(() => {
      updateTooltipPosition();
      setShowMainTooltip(true);
    }, 300);

    timeoutRef.current = setTimeout(() => {
      setShowMainTooltip(false);
      setIsOpen(true);
    }, 500);
  };

  // Handle mouse leave with delay
  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setShowMainTooltip(false);
    timeoutRef.current = setTimeout(closeBar, 150);
  };

  // Let the owner load per-type counts the moment the bar opens
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);
  useEffect(() => {
    if (isOpen) onOpenRef.current?.();
  }, [isOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Focus the first reaction when the bar opens (for keyboard users)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen && focusedIndex === -1) {
      // Find the current reaction index, or default to 0
      const currentIndex = currentReaction
        ? reactions.findIndex(r => r.type === currentReaction)
        : 0;
      setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
      // Focus the button after a brief delay to allow render
      requestAnimationFrame(() => {
        reactionButtonsRef.current[currentIndex >= 0 ? currentIndex : 0]?.focus();
      });
    } else if (!isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen, currentReaction, focusedIndex]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle keyboard navigation within the bar
  const handlePickerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    // The "see everyone" row is a plain button: Enter / Space click it,
    // Escape closes, Tab leaves the bar.
    if (footerRef.current && e.target === footerRef.current) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeBar();
        setFocusedIndex(-1);
        buttonRef.current?.focus();
      } else if (e.key === 'Tab' || e.key === 'ArrowUp') {
        if (e.key === 'ArrowUp' || e.shiftKey) {
          e.preventDefault();
          const back = focusedIndex >= 0 ? focusedIndex : 0;
          reactionButtonsRef.current[back]?.focus();
        } else {
          closeBar();
          setFocusedIndex(-1);
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev < reactions.length - 1 ? prev + 1 : 0;
          reactionButtonsRef.current[nextIndex]?.focus();
          return nextIndex;
        });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev > 0 ? prev - 1 : reactions.length - 1;
          reactionButtonsRef.current[nextIndex]?.focus();
          return nextIndex;
        });
        break;
      case 'ArrowDown':
        e.preventDefault();
        footerRef.current?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < reactions.length) {
          const reaction = reactions[focusedIndex];
          if (currentReaction === reaction.type) {
            onRemoveReaction();
          } else {
            onReact(reaction.type);
          }
          closeBar();
          buttonRef.current?.focus();
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeBar();
        setFocusedIndex(-1);
        buttonRef.current?.focus();
        break;
      case 'Tab':
        if (!e.shiftKey && footerRef.current) {
          // Move on to the "see everyone" row before leaving the bar
          e.preventDefault();
          footerRef.current.focus();
        } else {
          closeBar();
          setFocusedIndex(-1);
        }
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        reactionButtonsRef.current[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        const lastIndex = reactions.length - 1;
        setFocusedIndex(lastIndex);
        reactionButtonsRef.current[lastIndex]?.focus();
        break;
    }
  }, [isOpen, focusedIndex, currentReaction, onReact, onRemoveReaction, closeBar]);

  // Handle keyboard on main button to open the bar
  const handleMainButtonKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        // Open the bar with arrow keys
        e.preventDefault();
        setShowMainTooltip(false);
        setIsOpen(true);
        break;
      case 'Enter':
      case ' ':
        // Default click behavior - toggle admire or remove current reaction
        e.preventDefault();
        if (currentReaction) {
          onRemoveReaction();
        } else {
          onReact('admire');
        }
        break;
    }
  }, [disabled, currentReaction, onReact, onRemoveReaction]);

  // Handle click on main button (tap = toggle the default reaction)
  const handleMainClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    if (suppressClickRef.current) {
      // The click that follows a long-press / right-click open.
      suppressClickRef.current = false;
      return;
    }

    hideLabels();
    if (currentReaction) {
      onRemoveReaction();
    } else {
      onReact('admire');
    }
  };

  // Handle selecting a reaction
  const handleSelectReaction = (type: ReactionType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if (currentReaction === type) {
      onRemoveReaction();
    } else {
      onReact(type);
    }
    closeBar();
  };

  const openSheet = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeBar();
    setSheetOpen(true);
  };

  // Get the display icon (current reaction or outline heart)
  const displayIcon = currentReaction ? reactionIcons[currentReaction] : outlineHeart;
  const triggerLabel = currentReaction ? `Remove ${getReactionLabel(currentReaction)} reaction` : 'Add reaction';
  const countLabel = total > 0 ? `, ${total.toLocaleString()} reaction${total === 1 ? "" : "s"}` : "";

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Main Button */}
      {variant === "card" && (
        <button
          ref={buttonRef}
          className={`action-btn reaction-picker-trigger group/reaction ${currentReaction ? 'active' : ''}`}
          onClick={handleMainClick}
          onKeyDown={handleMainButtonKeyDown}
          disabled={disabled}
          aria-label={`${triggerLabel}${countLabel}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`w-6 h-6 transition-transform duration-200 ${currentReaction ? '' : 'group-hover/reaction:scale-110'} ${bump ? 'animate-pop' : ''}`}>
            {displayIcon}
          </span>
          {showCount && total > 0 && (
            <span className={`action-count ${bump ? 'animate-pop' : ''}`}>{total.toLocaleString()}</span>
          )}
        </button>
      )}
      {variant === "pill" && (
        <button
          ref={buttonRef}
          className={`reaction-picker-trigger engage-pill ${
            currentReaction ? 'text-pink-vivid' : 'text-ink hover:bg-subtle'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleMainClick}
          onKeyDown={handleMainButtonKeyDown}
          disabled={disabled}
          aria-label={`${triggerLabel}${countLabel}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`w-6 h-6 transition-transform duration-200 ${bump ? 'animate-pop' : ''}`}>
            {displayIcon}
          </span>
          {showCount && total > 0 && (
            <span className={`engage-pill-count ${bump ? 'animate-pop' : ''}`}>{total.toLocaleString()}</span>
          )}
        </button>
      )}
      {variant === "overlay" && (
        <button
          ref={buttonRef}
          className={`tiktok-action-btn ${currentReaction ? 'active' : ''}`}
          onClick={handleMainClick}
          onKeyDown={handleMainButtonKeyDown}
          disabled={disabled}
          aria-label={`${triggerLabel}${countLabel}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="tiktok-action-icon">
            <span className={`w-6 h-6 transition-transform duration-200 ${currentReaction ? 'scale-110' : ''} ${bump ? 'animate-pop' : ''}`}>
              {displayIcon}
            </span>
          </div>
          <span className={bump ? 'animate-pop' : ''}>{reactionCounts.total}</span>
        </button>
      )}

      {/* Main button tooltip - rendered via portal to avoid clipping */}
      {isMounted && showMainTooltip && !isOpen && !sheetOpen && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <span
            className="block px-2.5 py-1.5 text-[0.7rem] font-ui font-medium rounded-lg whitespace-nowrap shadow-lg animate-fadeIn"
            style={{ background: 'var(--color-toast-bg)', color: 'var(--color-toast-text)' }}
          >
            {currentReaction ? getReactionLabel(currentReaction) : 'React'}
          </span>
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 rotate-45"
            style={{ background: 'var(--color-toast-bg)' }}
          />
        </div>,
        document.body
      )}

      {/* The reaction bar */}
      {isOpen && (
        <div
          className={
            variant === "overlay"
              ? "reaction-bar-anchor absolute right-full bottom-0 mr-2 z-50 animate-fadeIn"
              : "reaction-picker-dropdown reaction-bar-anchor absolute bottom-full left-0 mb-2 z-50 animate-reactionPop"
          }
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handlePickerKeyDown}
        >
          <div className="reaction-bar bg-surface rounded-[26px] shadow-xl border border-border-light backdrop-blur-xl overflow-hidden">
            {/* Six reactions, each with its count */}
            <div
              className="flex items-end gap-0.5 px-1.5 pt-1.5 pb-1"
              role="listbox"
              aria-label="Choose a reaction"
              aria-activedescendant={focusedIndex >= 0 ? `reaction-option-${reactions[focusedIndex].type}` : undefined}
            >
              {reactions.map((reaction, index) => {
                const count = reactionCounts[reaction.type];
                const isSelected = currentReaction === reaction.type;
                const isHovered = hoveredReaction === reaction.type;
                const isFocused = focusedIndex === index;
                const lifted = isHovered || isFocused;

                return (
                  <button
                    key={reaction.type}
                    ref={(el) => { reactionButtonsRef.current[index] = el; }}
                    id={`reaction-option-${reaction.type}`}
                    onClick={(e) => handleSelectReaction(reaction.type, e)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setReactionTooltipPosition({
                        top: rect.top - 6,
                        left: rect.left + rect.width / 2,
                      });
                      setHoveredReaction(reaction.type);
                      setFocusedIndex(index);
                    }}
                    onMouseLeave={() => setHoveredReaction(null)}
                    onFocus={() => {
                      setFocusedIndex(index);
                      setHoveredReaction(reaction.type);
                    }}
                    onBlur={() => setHoveredReaction(null)}
                    className={`reaction-option relative flex flex-col items-center justify-end w-12 h-14 rounded-2xl transition-[transform,background-color] duration-150 focus:outline-none ${
                      isSelected ? 'bg-pink-vivid/10' : lifted ? 'bg-subtle' : ''
                    } ${lifted ? '-translate-y-1' : ''}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={countsLoaded && count > 0 ? `${reaction.label}, ${count.toLocaleString()}` : reaction.label}
                    tabIndex={isFocused ? 0 : -1}
                  >
                    <span
                      className={`reaction-option-icon w-8 h-8 transition-transform duration-150 ${lifted ? 'scale-125' : ''}`}
                      style={{ animationDelay: `${index * 28}ms` }}
                    >
                      {reaction.icon}
                    </span>
                    <span
                      className={`h-4 mt-0.5 font-ui text-[0.68rem] font-semibold leading-4 tabular-nums transition-colors ${
                        isSelected ? 'text-pink-vivid' : count > 0 ? 'text-ink' : 'text-muted/60'
                      }`}
                      aria-hidden="true"
                    >
                      {countsLoaded ? (count > 0 ? count.toLocaleString() : "") : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Who reacted — everyone, in the sheet */}
            {hasContent && (
              <ReactionBarFooter kind={kind} id={id} counts={reactionCounts} buttonRef={footerRef} onOpen={openSheet} />
            )}
          </div>

          {/* Arrow */}
          {variant === "overlay" ? (
            <div className="absolute top-1/2 -right-1 -translate-y-1/2">
              <div className="w-2 h-2 bg-surface rotate-45 border-r border-t border-border-light" />
            </div>
          ) : (
            <div className="reaction-bar-arrow absolute top-full left-6 -mt-1">
              <div className="w-3 h-3 bg-surface rotate-45 border-r border-b border-border-light" />
            </div>
          )}
        </div>
      )}

      {/* Reaction tooltip - rendered via portal to avoid clipping */}
      {isMounted && isOpen && !sheetOpen && hoveredReaction && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: reactionTooltipPosition.top,
            left: reactionTooltipPosition.left,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <span
            className="block px-2 py-1 text-[0.65rem] font-ui font-medium rounded-md whitespace-nowrap shadow-lg animate-fadeIn"
            style={{ background: 'var(--color-toast-bg)', color: 'var(--color-toast-text)' }}
          >
            {getReactionLabel(hoveredReaction)}
          </span>
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 rotate-45"
            style={{ background: 'var(--color-toast-bg)' }}
          />
        </div>,
        document.body
      )}

      {/* Everyone who reacted */}
      {isMounted && hasContent && sheetOpen && createPortal(
        <ReactionsSheet kind={kind} id={id} isOpen={sheetOpen} onClose={closeSheet} counts={reactionCounts} />,
        document.body
      )}

      <style jsx global>{`
        @keyframes reactionPop {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-reactionPop {
          animation: reactionPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>
    </div>
  );
}
