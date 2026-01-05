"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSearch } from "@/lib/hooks";
import { useAuth } from "@/components/providers/AuthProvider";
import SearchDropdown, { type SearchHistoryEntry } from "./SearchDropdown";

const HISTORY_KEY_PREFIX = "quill_search_history_";
const MAX_HISTORY_ENTRIES = 10;

// localStorage helpers
function getSearchHistory(userId: string): SearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(`${HISTORY_KEY_PREFIX}${userId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(userId: string, entries: SearchHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${HISTORY_KEY_PREFIX}${userId}`, JSON.stringify(entries));
  } catch {
    // Silently fail if localStorage is full
  }
}

function addToHistory(userId: string, entry: Omit<SearchHistoryEntry, "timestamp">): void {
  const history = getSearchHistory(userId);

  // Remove existing entry with same id/type to avoid duplicates
  const filtered = history.filter(h => !(h.id === entry.id && h.type === entry.type));

  // Add new entry at the beginning
  const newHistory = [
    { ...entry, timestamp: Date.now() },
    ...filtered,
  ].slice(0, MAX_HISTORY_ENTRIES);

  saveSearchHistory(userId, newHistory);
}

function clearHistory(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${HISTORY_KEY_PREFIX}${userId}`);
}

function removeHistoryItem(userId: string, index: number): SearchHistoryEntry[] {
  const history = getSearchHistory(userId);
  const newHistory = history.filter((_, i) => i !== index);
  saveSearchHistory(userId, newHistory);
  return newHistory;
}

interface SearchBarProps {
  className?: string;
}

export default function SearchBar({ className = "" }: SearchBarProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, loading } = useSearch(query);

  // Load history when user changes
  useEffect(() => {
    if (user?.id) {
      setHistory(getSearchHistory(user.id));
    } else {
      setHistory([]);
    }
  }, [user?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    if (isFocused) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFocused]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFocused) {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFocused]);

  const handleSelectResult = (entry: Omit<SearchHistoryEntry, "timestamp">) => {
    if (user?.id) {
      addToHistory(user.id, entry);
      setHistory(getSearchHistory(user.id));
    }
    setQuery("");
    setIsFocused(false);
  };

  const handleClearHistory = () => {
    if (user?.id) {
      clearHistory(user.id);
      setHistory([]);
    }
  };

  const handleRemoveHistoryItem = (index: number) => {
    if (user?.id) {
      const newHistory = removeHistoryItem(user.id, index);
      setHistory(newHistory);
    }
  };

  const handleClearQuery = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative mb-5 ${className}`}>
      {/* Search Input Container */}
      <div
        className={`relative flex items-center w-full h-11 rounded-2xl transition-all duration-300 ${
          isFocused
            ? "bg-white shadow-xl shadow-purple-primary/15 ring-2 ring-purple-primary/20"
            : "bg-gradient-to-r from-purple-primary/[0.06] to-pink-vivid/[0.04] hover:from-purple-primary/[0.1] hover:to-pink-vivid/[0.08]"
        }`}
      >
        {/* Gradient Border Effect (visible when not focused) */}
        {!isFocused && (
          <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-r from-purple-primary/20 via-pink-vivid/20 to-orange-warm/20 -z-10">
            <div className="w-full h-full rounded-2xl bg-white/95" />
          </div>
        )}

        {/* Left Side - Search Icon */}
        <div className="absolute left-1.5 flex items-center">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
              isFocused
                ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white shadow-md shadow-purple-primary/25"
                : "bg-gradient-to-br from-purple-primary/80 to-pink-vivid/80 text-white/90"
            }`}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Search"
          className="w-full h-full pl-12 pr-9 bg-transparent border-none outline-none font-ui text-[0.85rem] text-ink placeholder:text-muted/50"
        />

        {/* Right Side - Clear Button */}
        {query && (
          <button
            onClick={handleClearQuery}
            className="absolute right-2 w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-pink-vivid hover:bg-pink-vivid/10 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search Dropdown */}
      <SearchDropdown
        isOpen={isFocused}
        query={query}
        results={results}
        loading={loading}
        history={user ? history : []}
        onClose={() => setIsFocused(false)}
        onSelectResult={handleSelectResult}
        onClearHistory={handleClearHistory}
        onRemoveHistoryItem={handleRemoveHistoryItem}
      />
    </div>
  );
}
