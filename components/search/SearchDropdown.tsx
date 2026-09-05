"use client";

import React from "react";
import SearchResultItem from "./SearchResultItem";
import { Spinner } from "@/components/ui/Loading";
import type { SearchResults } from "@/lib/hooks.legacy";

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
    <div id="pq-search-results" className="pq-search__results" role="region" aria-label="Search results">
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-10 text-subdued">
          <Spinner size="md" />
        </div>
      )}

      {/* No Query - Show History */}
      {!loading && !hasQuery && (
        <>
          {hasHistory ? (
            <>
              <div className="pq-search__section">
                <span>Recent</span>
                <button type="button" onClick={onClearHistory}>Clear all</button>
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
            <p className="pq-search__empty">Look for a person, a community, or a tag.</p>
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
                  <p className="pq-search__section">People</p>
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
                  <p className="pq-search__section">Communities</p>
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
                  <p className="pq-search__section">Tags</p>
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
            <p className="pq-search__empty">
              <strong>Nothing for &ldquo;{query}&rdquo; yet</strong>
              Try another name, community, or tag.
            </p>
          )}
        </>
      )}
    </div>
  );
}
