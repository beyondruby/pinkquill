"use client";

import React from "react";
import SearchResultItem from "./SearchResultItem";
import type { SearchResults } from "@/lib/hooks";

export interface SearchHistoryEntry {
  query: string;
  type: "profile" | "community" | "tag";
  id: string;
  label: string;
  timestamp: number;
}

interface SearchDropdownProps {
  isOpen: boolean;
  query: string;
  results: SearchResults;
  loading: boolean;
  history: SearchHistoryEntry[];
  onClose: () => void;
  onSelectResult: (entry: Omit<SearchHistoryEntry, "timestamp">) => void;
  onClearHistory: () => void;
  onRemoveHistoryItem: (index: number) => void;
}

export default function SearchDropdown({
  isOpen,
  query,
  results,
  loading,
  history,
  onClose,
  onSelectResult,
  onClearHistory,
  onRemoveHistoryItem,
}: SearchDropdownProps) {
  if (!isOpen) return null;

  const hasQuery = query.trim().length >= 2;
  const hasResults = results.profiles.length > 0 || results.communities.length > 0 || results.tags.length > 0;
  const hasHistory = history.length > 0;

  return (
    <div className="absolute left-full top-0 ml-4 w-[320px] max-h-[450px] overflow-y-auto overflow-x-hidden bg-white rounded-2xl border border-purple-primary/10 shadow-2xl shadow-purple-primary/10 z-[200] animate-searchDropdownIn">
      {/* Decorative gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm rounded-t-2xl" />

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-purple-primary/20 rounded-full" />
            <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-t-purple-primary rounded-full animate-spin" />
          </div>
        </div>
      )}

      {/* No Query - Show History */}
      {!loading && !hasQuery && (
        <>
          {hasHistory ? (
            <>
              <div className="flex items-center justify-between px-4 py-3 mt-1 border-b border-purple-primary/[0.06]">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-purple-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-ui text-[0.7rem] uppercase tracking-wider text-muted font-semibold">
                    Recent
                  </span>
                </div>
                <button
                  onClick={onClearHistory}
                  className="font-ui text-[0.72rem] font-medium text-purple-primary/70 hover:text-pink-vivid transition-colors"
                >
                  Clear all
                </button>
              </div>
              <div className="py-1">
                {history.map((item, index) => (
                  <SearchResultItem
                    key={`${item.id}-${item.timestamp}`}
                    type="history"
                    data={{ label: item.label, resultType: item.type }}
                    onClick={() => {
                      onSelectResult({
                        query: item.query,
                        type: item.type,
                        id: item.id,
                        label: item.label,
                      });
                      onClose();
                    }}
                    onRemove={() => onRemoveHistoryItem(index)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="font-ui text-[0.82rem] text-muted italic">
                Discover creators & communities
              </span>
            </div>
          )}
        </>
      )}

      {/* Has Query - Show Results */}
      {!loading && hasQuery && (
        <>
          {hasResults ? (
            <>
              {/* People Section */}
              {results.profiles.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-2.5 mt-1 bg-gradient-to-r from-purple-primary/[0.04] to-transparent border-b border-purple-primary/[0.06]">
                    <svg className="w-3.5 h-3.5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="font-ui text-[0.7rem] uppercase tracking-wider text-purple-primary font-semibold">
                      People
                    </span>
                  </div>
                  <div className="py-1">
                    {results.profiles.map((profile) => (
                      <SearchResultItem
                        key={profile.id}
                        type="profile"
                        data={profile}
                        onClick={() => {
                          onSelectResult({
                            query: query,
                            type: "profile",
                            id: profile.id,
                            label: `@${profile.username}`,
                          });
                          onClose();
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Communities Section */}
              {results.communities.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-vivid/[0.04] to-transparent border-b border-purple-primary/[0.06]">
                    <svg className="w-3.5 h-3.5 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="font-ui text-[0.7rem] uppercase tracking-wider text-pink-vivid font-semibold">
                      Communities
                    </span>
                  </div>
                  <div className="py-1">
                    {results.communities.map((community) => (
                      <SearchResultItem
                        key={community.id}
                        type="community"
                        data={community}
                        onClick={() => {
                          onSelectResult({
                            query: query,
                            type: "community",
                            id: community.id,
                            label: community.name,
                          });
                          onClose();
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Tags Section */}
              {results.tags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-warm/[0.04] to-transparent border-b border-purple-primary/[0.06]">
                    <span className="text-orange-warm font-bold text-sm">#</span>
                    <span className="font-ui text-[0.7rem] uppercase tracking-wider text-orange-warm font-semibold">
                      Tags
                    </span>
                  </div>
                  <div className="py-1">
                    {results.tags.map((tag) => (
                      <SearchResultItem
                        key={tag.tag}
                        type="tag"
                        data={tag}
                        onClick={() => {
                          onSelectResult({
                            query: query,
                            type: "tag",
                            id: tag.tag,
                            label: `#${tag.tag}`,
                          });
                          onClose();
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-ui text-[0.85rem] text-ink mb-1">
                No results for "<span className="text-purple-primary">{query}</span>"
              </span>
              <span className="font-body text-[0.78rem] text-muted italic">
                Try a different search term
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
