"use client";

import { useState, useRef, useEffect } from "react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

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

export default function EmojiPicker({ onSelect, isOpen, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Smileys");
  const [searchQuery, setSearchQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

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

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full mb-2 right-0 w-[320px] bg-surface rounded-2xl shadow-xl border border-border-light overflow-hidden z-50"
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
      <div className="p-2 max-h-[200px] overflow-y-auto">
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
}
