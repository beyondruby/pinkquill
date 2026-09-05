"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSearch } from "@/lib/hooks.legacy";
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
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user?.id) {
      setHistory(getSearchHistory(user.id));
    } else {
      setHistory([]);
    }
  }, [user?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    <div ref={containerRef} className={`pq-search ${className}`.trim()} role="search">
      <div className="pq-search__field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 21l-5-5M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          aria-label="Search people, work, communities"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Find people, work, communities…"
          autoComplete="off"
          enterKeyHint="search"
          aria-expanded={isFocused}
          aria-controls={isFocused ? "pq-search-results" : undefined}
          className="pq-search__input"
        />
        {query && (
          <button
            type="button"
            onClick={handleClearQuery}
            aria-label="Clear search"
            className="pq-icon-button pq-search__clear"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
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
