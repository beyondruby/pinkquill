"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { ReactionType, ReactionCounts } from "@/lib/types";

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
  /** Kept for callers; per-type numbers now live in the Reactions sheet. */
  countsLoaded?: boolean;
  onReact: (type: ReactionType) => void;
  onRemoveReaction: () => void;
  /** Fired when the picker opens — load per-type counts here. */
  onOpen?: () => void;
  disabled?: boolean;
  /**
   * card    — `.action-btn` inside a feed card / detail modal (default)
   * pill    — rounded pill used on the take modal and /take/[id]
   * overlay — vertical `.tiktok-action-btn` on the takes feed
   */
  variant?: ReactionPickerVariant;
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
  onReact,
  onRemoveReaction,
  onOpen,
  disabled = false,
  variant = "card",
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);
  const [showMainTooltip, setShowMainTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [reactionTooltipPosition, setReactionTooltipPosition] = useState({ top: 0, left: 0 });
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reactionButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  // Touch: long-press opens the picker; the click that follows must not
  // toggle the default reaction. Synthetic mouseenter after a tap must not
  // hover-open it either.
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const lastTouchAtRef = useRef(0);
  // Count bump when the total changes (own click or someone else's).
  const [bump, setBump] = useState(false);
  const prevTotalRef = useRef(reactionCounts.total);

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

  // Tap outside closes a picker opened by touch / right-click.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHoveredReaction(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openByPress = () => {
    setShowMainTooltip(false);
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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Show tooltip immediately, open picker after delay
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
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setHoveredReaction(null);
    }, 150);
  };

  // Let the owner load per-type counts the moment the popup opens
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

  // Focus the first reaction when picker opens (for keyboard users)
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

  // Handle keyboard navigation within the picker
  const handlePickerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev < reactions.length - 1 ? prev + 1 : 0;
          reactionButtonsRef.current[nextIndex]?.focus();
          return nextIndex;
        });
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => {
          const nextIndex = prev > 0 ? prev - 1 : reactions.length - 1;
          reactionButtonsRef.current[nextIndex]?.focus();
          return nextIndex;
        });
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
          setIsOpen(false);
          buttonRef.current?.focus();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        buttonRef.current?.focus();
        break;
      case 'Tab':
        // Close picker and allow natural tab navigation
        setIsOpen(false);
        setFocusedIndex(-1);
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
  }, [isOpen, focusedIndex, currentReaction, onReact, onRemoveReaction]);

  // Handle keyboard on main button to open picker
  const handleMainButtonKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        // Open picker with arrow keys
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
    setIsOpen(false);
  };

  // Get the display icon (current reaction or outline heart)
  const displayIcon = currentReaction ? reactionIcons[currentReaction] : outlineHeart;

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
          aria-label={currentReaction ? `Remove ${getReactionLabel(currentReaction)} reaction` : 'Add reaction'}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`w-6 h-6 transition-transform duration-200 ${currentReaction ? '' : 'group-hover/reaction:scale-110'} ${bump ? 'animate-pop' : ''}`}>
            {displayIcon}
          </span>
        </button>
      )}
      {variant === "pill" && (
        <button
          ref={buttonRef}
          className={`reaction-picker-trigger w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            currentReaction ? 'text-pink-vivid' : 'text-ink hover:bg-subtle'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleMainClick}
          onKeyDown={handleMainButtonKeyDown}
          disabled={disabled}
          aria-label={currentReaction ? `Remove ${getReactionLabel(currentReaction)} reaction` : 'Add reaction'}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`w-6 h-6 transition-transform duration-200 ${bump ? 'animate-pop' : ''}`}>
            {displayIcon}
          </span>
        </button>
      )}
      {variant === "overlay" && (
        <button
          ref={buttonRef}
          className={`tiktok-action-btn ${currentReaction ? 'active' : ''}`}
          onClick={handleMainClick}
          onKeyDown={handleMainButtonKeyDown}
          disabled={disabled}
          aria-label={currentReaction ? `Remove ${getReactionLabel(currentReaction)} reaction` : 'Add reaction'}
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
      {isMounted && showMainTooltip && !isOpen && createPortal(
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

      {/* Reaction Picker Popup */}
      {isOpen && (
        <div
          className={
            variant === "overlay"
              ? "absolute right-full bottom-0 mr-2 z-50 animate-fadeIn"
              : "reaction-picker-dropdown absolute bottom-full left-0 mb-2 z-50 animate-reactionPop"
          }
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handlePickerKeyDown}
          role="listbox"
          aria-label="Choose a reaction"
          aria-activedescendant={focusedIndex >= 0 ? `reaction-option-${reactions[focusedIndex].type}` : undefined}
        >
          {/* Picker Container */}
          <div className="bg-surface rounded-full shadow-xl border border-border-light backdrop-blur-xl">
            {/* Reaction buttons row */}
            <div className="flex items-center gap-1 px-2 py-1.5">
              {reactions.map((reaction, index) => {
                const isSelected = currentReaction === reaction.type;
                const isHovered = hoveredReaction === reaction.type;
                const isFocused = focusedIndex === index;

                return (
                  <button
                    key={reaction.type}
                    ref={(el) => { reactionButtonsRef.current[index] = el; }}
                    id={`reaction-option-${reaction.type}`}
                    onClick={(e) => handleSelectReaction(reaction.type, e)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setReactionTooltipPosition({
                        top: rect.top - 8,
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
                    className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-transform duration-150 focus:outline-none ${
                      isSelected ? 'bg-pink-vivid/10' : ''
                    } ${isHovered || isFocused ? 'scale-125 -translate-y-1' : ''}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={reaction.label}
                    tabIndex={isFocused ? 0 : -1}
                  >
                    <span className="w-8 h-8">{reaction.icon}</span>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Arrow */}
          {variant === "overlay" ? (
            <div className="absolute top-1/2 -right-1 -translate-y-1/2">
              <div className="w-2 h-2 bg-surface rotate-45 border-r border-t border-border-light" />
            </div>
          ) : (
            <div className="absolute top-full left-6 -mt-1">
              <div className="w-3 h-3 bg-surface rotate-45 border-r border-b border-border-light" />
            </div>
          )}
        </div>
      )}

      {/* Reaction tooltip - rendered via portal to avoid clipping */}
      {isMounted && isOpen && hoveredReaction && createPortal(
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
