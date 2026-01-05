"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ReactionType, ReactionCounts } from "@/lib/hooks";

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

interface ReactionPickerProps {
  currentReaction: ReactionType | null;
  reactionCounts: ReactionCounts;
  onReact: (type: ReactionType) => void;
  onRemoveReaction: () => void;
  disabled?: boolean;
}

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
  disabled = false,
}: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<ReactionType | null>(null);
  const [showMainTooltip, setShowMainTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [reactionTooltipPosition, setReactionTooltipPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // For portal rendering
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Handle mouse enter with delay
  const handleMouseEnter = () => {
    if (disabled) return;
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  // Handle click on main button
  const handleMainClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

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

  // Get reactions that have counts > 0, sorted by count
  const activeReactions = reactions
    .filter(r => reactionCounts[r.type] > 0)
    .sort((a, b) => reactionCounts[b.type] - reactionCounts[a.type]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Main Button */}
      <button
        ref={buttonRef}
        className={`action-btn group/reaction ${currentReaction ? 'active' : ''}`}
        onClick={handleMainClick}
        disabled={disabled}
      >
        <span className={`w-[1.1rem] h-[1.1rem] transition-transform duration-200 ${currentReaction ? 'scale-110' : 'group-hover/reaction:scale-110'}`}>
          {displayIcon}
        </span>
        <span className="action-count">{reactionCounts.total}</span>
      </button>

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
          <span className="block px-2.5 py-1.5 bg-ink text-white text-[0.7rem] font-ui font-medium rounded-lg whitespace-nowrap shadow-lg animate-fadeIn">
            {currentReaction ? getReactionLabel(currentReaction) : 'React'}
          </span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-ink rotate-45" />
        </div>,
        document.body
      )}

      {/* Reaction Picker Popup */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 animate-reactionPop"
          onMouseEnter={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }}
          onMouseLeave={handleMouseLeave}
        >
          {/* Picker Container */}
          <div className="bg-white rounded-2xl shadow-xl border border-black/[0.08] backdrop-blur-xl overflow-hidden">
            {/* Reaction buttons row */}
            <div className="flex items-center gap-0.5 px-2 py-2">
              {reactions.map((reaction) => {
                const count = reactionCounts[reaction.type];
                const isSelected = currentReaction === reaction.type;
                const isHovered = hoveredReaction === reaction.type;

                return (
                  <button
                    key={reaction.type}
                    onClick={(e) => handleSelectReaction(reaction.type, e)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setReactionTooltipPosition({
                        top: rect.top - 8,
                        left: rect.left + rect.width / 2,
                      });
                      setHoveredReaction(reaction.type);
                    }}
                    onMouseLeave={() => setHoveredReaction(null)}
                    className={`relative flex flex-col items-center justify-center w-12 h-14 rounded-xl transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-b from-purple-primary/15 to-pink-vivid/10 scale-105'
                        : 'hover:bg-black/[0.04]'
                    } ${isHovered ? 'scale-110' : ''}`}
                  >
                    {/* Icon */}
                    <span className={`w-6 h-6 transition-transform duration-150 ${isHovered ? 'scale-110' : ''}`}>
                      {reaction.icon}
                    </span>

                    {/* Count */}
                    <span className={`text-[0.65rem] font-ui font-semibold mt-0.5 ${
                      isSelected ? 'text-purple-primary' : count > 0 ? 'text-ink' : 'text-muted/50'
                    }`}>
                      {count}
                    </span>


                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active reactions summary (only if there are reactions) */}
            {activeReactions.length > 0 && (
              <div className="px-3 py-2 border-t border-black/[0.04] bg-gradient-to-r from-purple-primary/[0.02] to-pink-vivid/[0.02]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeReactions.slice(0, 4).map((reaction) => (
                    <div key={reaction.type} className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white shadow-sm">
                      <span className="w-3.5 h-3.5">{reaction.icon}</span>
                      <span className="text-[0.6rem] font-ui font-semibold text-muted">
                        {reactionCounts[reaction.type]}
                      </span>
                    </div>
                  ))}
                  {activeReactions.length > 4 && (
                    <span className="text-[0.6rem] font-ui text-muted/70">
                      +{activeReactions.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Arrow pointing down */}
          <div className="absolute top-full left-6 -mt-1">
            <div className="w-3 h-3 bg-white rotate-45 border-r border-b border-black/[0.08]" />
          </div>
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
          <span className="block px-2 py-1 bg-ink text-white text-[0.65rem] font-ui font-medium rounded-md whitespace-nowrap shadow-lg animate-fadeIn">
            {getReactionLabel(hoveredReaction)}
          </span>
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-ink rotate-45" />
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
