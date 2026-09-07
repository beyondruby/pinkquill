"use client";

import { useState, useRef, useEffect, useLayoutEffect, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
  /**
   * The button that opened the picker. When given, the picker renders in a
   * portal with fixed positioning next to that button, so it is never clipped
   * by a scrolling comment list or a modal's overflow. It opens above the
   * button when there is room, otherwise below, and stays inside the viewport.
   */
  anchorRef?: RefObject<HTMLElement | null>;
}

const PICKER_WIDTH = 320;
const VIEWPORT_PAD = 8;
const GAP = 8;

// Common emoji categories
const EMOJI_CATEGORIES = {
  "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬"],
  "Gestures": ["👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👋", "🤚", "🖐️", "✋", "🖖", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💪", "🦵", "🦶"],
  "Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️", "🫶", "🩷", "🩵", "🩶"],
  "Faces": ["😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🫣", "🤭", "🫢", "🫡", "🤫", "🫠", "🤥", "😶", "😶‍🌫️", "😐", "😑", "😬", "🙄"],
  "Animals": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛"],
  "Nature": ["🌸", "💮", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🌱", "🪴", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🪹", "🪺", "🍄", "🌍", "🌎", "🌏", "🌕", "🌙"],
  "Food": ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🍆", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕", "🫒", "🧄", "🧅", "🥔"],
  "Activities": ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷"],
  "Objects": ["💡", "🔦", "🏮", "🪔", "📱", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "💾", "💿", "📀", "🎥", "🎞️", "📽️", "📺", "📷", "📸", "📹", "📼", "🔍", "🔎", "🔬", "🔭", "📡", "💳", "💎", "⚙️"],
  "Symbols": ["✨", "⭐", "🌟", "💫", "✴️", "🔥", "💥", "💢", "💦", "💨", "🕳️", "💣", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "🎵", "🎶", "🔔", "🔕", "📣", "📢", "🏴", "🚩", "🏳️", "🏳️‍🌈", "🏳️‍⚧️", "🏴‍☠️"],
};

export default function EmojiPicker({ onSelect, isOpen, onClose, anchorRef }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Smileys");
  const [searchQuery, setSearchQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const [anchored, setAnchored] = useState<CSSProperties | null>(null);
  const portaled = !!anchorRef;

  // Anchored mode: place the picker beside its button, inside the viewport,
  // and follow it while the page or a comment list scrolls.
  useLayoutEffect(() => {
    if (!isOpen || !anchorRef) return;
    const place = () => {
      const anchor = anchorRef.current;
      const picker = pickerRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(PICKER_WIDTH, vw - VIEWPORT_PAD * 2);
      const height = picker?.offsetHeight || 340;
      const roomAbove = rect.top - VIEWPORT_PAD - GAP;
      const roomBelow = vh - rect.bottom - VIEWPORT_PAD - GAP;
      const above = roomAbove >= height || roomAbove >= roomBelow;
      const top = above
        ? Math.max(VIEWPORT_PAD, rect.top - GAP - height)
        : Math.min(rect.bottom + GAP, vh - VIEWPORT_PAD - height);
      // Right edge sits on the button's right edge, clamped to the viewport.
      const left = Math.min(Math.max(VIEWPORT_PAD, rect.right - width), vw - VIEWPORT_PAD - width);
      setAnchored({
        position: "fixed",
        top: Math.max(VIEWPORT_PAD, top),
        left,
        width,
        maxHeight: vh - VIEWPORT_PAD * 2,
        zIndex: "var(--z-popover)",
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [isOpen, anchorRef, activeCategory, searchQuery]);

  // Close on click outside (the opening button toggles itself, so it is exempt)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef?.current?.contains(target)) return;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = Object.keys(EMOJI_CATEGORIES);

  // Filter emojis by search query
  const getFilteredEmojis = () => {
    if (!searchQuery) {
      return EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES];
    }

    // Search across all categories
    const allEmojis: string[] = [];
    Object.values(EMOJI_CATEGORIES).forEach((emojis) => {
      allEmojis.push(...emojis);
    });

    // Simple search - just return all for now since emoji search is complex
    return allEmojis.slice(0, 40);
  };

  const emojis = getFilteredEmojis();

  const picker = (
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="Choose an emoji"
      style={portaled ? (anchored ?? { position: "fixed", visibility: "hidden" }) : undefined}
      className={`bg-surface rounded-2xl shadow-xl border border-border-light overflow-hidden flex flex-col ${
        portaled ? "" : "absolute bottom-full mb-2 right-0 w-[320px] z-50"
      }`}
    >
      {/* Search */}
      <div className="p-3 border-b border-border-light">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search emojis..."
          className="w-full px-3 py-2 rounded-lg bg-skeleton/70 border-none outline-none font-ui text-sm text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20"
        />
      </div>

      {/* Category tabs */}
      {!searchQuery && (
        <div className="flex overflow-x-auto px-2 py-2 border-b border-border-light gap-1 scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-3 py-1.5 rounded-lg font-ui text-xs whitespace-nowrap transition-all ${
                activeCategory === category
                  ? "bg-purple-primary text-white"
                  : "text-muted hover:bg-skeleton/60"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="p-2 max-h-[200px] overflow-y-auto min-h-0">
        <div className="grid grid-cols-8 gap-1">
          {emojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="w-9 h-9 flex items-center justify-center text-xl hover:bg-skeleton rounded-lg transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (portaled) {
    return typeof document === "undefined" ? null : createPortal(picker, document.body);
  }
  return picker;
}
