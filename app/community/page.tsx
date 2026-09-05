"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunities, useDiscoverCommunities, useSuggestedCommunities } from "@/lib/hooks.legacy";
import CommunityCard from "@/components/communities/CommunityCard";
import { PageFrame, PageHeader } from "@/components/layout/PageFrame";
import { TabRow } from "@/components/ui/Tabs";
import { COMMUNITY_CATEGORIES } from "@/lib/communities/categories";
import type { Community } from "@/lib/types";
import "@/components/create/composer.css";
import "@/components/communities/communities.css";

type TabType = "discover" | "joined" | "created";
type SortType = "trending" | "newest" | "members";

const SORTS: { value: SortType; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "newest", label: "New" },
  { value: "members", label: "Most members" },
];

function sortCommunities(list: Community[], sortBy: SortType): Community[] {
  if (sortBy === "newest") return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (sortBy === "members") return [...list].sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
  return list;
}

function Grid({ items }: { items: Community[] }) {
  return (
    <div className="pq-community-grid">
      {items.map((community) => <CommunityCard key={community.id} community={community} />)}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="pq-community-grid" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="pq-skeleton h-36 rounded-card" />)}
    </div>
  );
}

export default function CommunitiesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortType>("trending");

  const { communities: discoverCommunities, trending, loading: discoverLoading, error: discoverError } = useDiscoverCommunities();
  const { communities: joinedCommunities, loading: joinedLoading, error: joinedError } = useCommunities(user?.id, "joined", { enabled: !!user && activeTab === "joined" });
  const { communities: createdCommunities, loading: createdLoading, error: createdError } = useCommunities(user?.id, "created", { enabled: !!user && activeTab === "created" });
  const { communities: suggestedCommunities, loading: suggestedLoading } = useSuggestedCommunities(user?.id, 6, !!user && activeTab === "discover");

  const browsing = activeTab === "discover" && !searchQuery.trim() && selectedCategory === "all";
  const featured = useMemo(() => (browsing && sortBy === "trending" ? trending.slice(0, 3) : []), [browsing, sortBy, trending]);
  const featuredIds = useMemo(() => new Set(featured.map((c) => c.id)), [featured]);

  const results = useMemo(() => {
    let list: Community[] = activeTab === "joined" ? joinedCommunities : activeTab === "created" ? createdCommunities : discoverCommunities;
    if (browsing) list = list.filter((c) => !featuredIds.has(c.id));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || c.topics?.some((t) => t.toLowerCase().includes(q)));
    }
    if (selectedCategory !== "all") {
      const category = COMMUNITY_CATEGORIES.find((c) => c.id === selectedCategory);
      if (category) list = list.filter((c) => c.topics?.includes(category.name));
    }
    return sortCommunities(list, sortBy);
  }, [activeTab, joinedCommunities, createdCommunities, discoverCommunities, browsing, featuredIds, searchQuery, selectedCategory, sortBy]);

  const isLoading = activeTab === "discover" ? discoverLoading : activeTab === "joined" ? joinedLoading : createdLoading;
  const currentError = activeTab === "discover" ? discoverError : activeTab === "joined" ? joinedError : createdError;
  const hasFilters = selectedCategory !== "all" || searchQuery.trim() !== "";
  const nothingAtAll = !isLoading && !currentError && results.length === 0 && featured.length === 0;

  const resultsTitle = activeTab === "joined"
    ? "Communities you're in"
    : activeTab === "created"
      ? "Communities you started"
      : hasFilters
        ? "Results"
        : "All communities";

  const emptyTitle = searchQuery.trim()
    ? `Nothing matches “${searchQuery.trim()}”`
    : selectedCategory !== "all"
      ? "No communities in this category yet"
      : activeTab === "joined"
        ? "You haven't joined a community yet"
        : activeTab === "created"
          ? "You haven't started a community yet"
          : "No communities yet";

  const emptyText = searchQuery.trim() || selectedCategory !== "all"
    ? "Try another word or category, or start the community you were looking for."
    : activeTab === "joined"
      ? "Find a space for the work you make and join it. It shows up here."
      : activeTab === "created"
        ? "A community is a shared space you run. Start one for your kind of work."
        : "Be the first to open a space for your kind of work.";

  return (
    <PageFrame width="wide">
      <PageHeader
        title="Communities"
        lede="Shared spaces for the work you make, run by the people making it."
        actions={user ? <Link href="/community/create" className="pq-button pq-button--md pq-button--primary">Start a community</Link> : undefined}
      />

      <div className="pq-community-toolbar">
        <div className="pq-community-toolbar__row">
          <div className="pq-search flex-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              className="pq-field pq-field--ui"
              placeholder="Search communities"
              aria-label="Search communities"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="pq-segmented" role="radiogroup" aria-label="Sort">
            {SORTS.map((sort) => (
              <button key={sort.value} type="button" role="radio" aria-checked={sortBy === sort.value} className="pq-segmented__option" onClick={() => setSortBy(sort.value)}>
                {sort.label}
              </button>
            ))}
          </div>
        </div>

        {user && (
          <TabRow<TabType>
            ariaLabel="Which communities"
            items={[
              { id: "discover", label: "Discover" },
              { id: "joined", label: "Joined" },
              { id: "created", label: "Started by you" },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        )}

        <div className="pq-chip-scroll" role="group" aria-label="Category">
          <button type="button" className="pq-chip" aria-pressed={selectedCategory === "all"} onClick={() => setSelectedCategory("all")}>All</button>
          {COMMUNITY_CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" className="pq-chip" aria-pressed={selectedCategory === cat.id} onClick={() => setSelectedCategory(cat.id)}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {currentError && (
        <div className="pq-feed-state pq-feed-state--card mb-6" role="alert">
          <p className="pq-feed-state__title">Communities didn&rsquo;t load</p>
          <p className="pq-feed-state__text">{currentError}</p>
        </div>
      )}

      {isLoading && !currentError && (
        <>
          <div role="status" aria-live="polite" className="sr-only">Loading communities</div>
          <GridSkeleton />
        </>
      )}

      {!isLoading && !currentError && featured.length > 0 && (
        <section className="pq-section" aria-labelledby="communities-trending">
          <div className="pq-section__head">
            <div>
              <h2 id="communities-trending" className="pq-section__title">Busy this week</h2>
              <p className="pq-section__lede">Where people are sharing the most right now.</p>
            </div>
          </div>
          <div className="pq-community-grid">
            {featured.map((community) => <CommunityCard key={community.id} community={community} variant="featured" />)}
          </div>
        </section>
      )}

      {!isLoading && !currentError && browsing && user && (suggestedLoading || suggestedCommunities.length > 0) && (
        <section className="pq-section" aria-labelledby="communities-suggested">
          <div className="pq-section__head">
            <div>
              <h2 id="communities-suggested" className="pq-section__title">For your kind of work</h2>
              <p className="pq-section__lede">Picked from what you make and follow.</p>
            </div>
          </div>
          {suggestedLoading ? <GridSkeleton /> : <Grid items={suggestedCommunities} />}
        </section>
      )}

      {!isLoading && !currentError && results.length > 0 && (
        <section className="pq-section" aria-labelledby="communities-results">
          <div className="pq-section__head">
            <h2 id="communities-results" className="pq-section__title">
              {resultsTitle}
              <span className="pq-tab__count ml-2">{results.length}</span>
            </h2>
            {hasFilters && (
              <button type="button" className="pq-button pq-button--sm pq-button--ghost" onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}>
                Clear
              </button>
            )}
          </div>
          <Grid items={results} />
        </section>
      )}

      {nothingAtAll && (
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">{emptyTitle}</p>
          <p className="pq-feed-state__text">{emptyText}</p>
          <div className="pq-feed-state__actions">
            {hasFilters && (
              <button type="button" className="pq-button pq-button--md pq-button--secondary" onClick={() => { setSelectedCategory("all"); setSearchQuery(""); }}>
                Show everything
              </button>
            )}
            {activeTab !== "discover" && (
              <button type="button" className="pq-button pq-button--md pq-button--secondary" onClick={() => setActiveTab("discover")}>Discover</button>
            )}
            {user ? (
              <Link href="/community/create" className="pq-button pq-button--md pq-button--primary">Start a community</Link>
            ) : (
              <Link href="/login?redirect=%2Fcommunity" className="pq-button pq-button--md pq-button--primary">Sign in</Link>
            )}
          </div>
        </div>
      )}
    </PageFrame>
  );
}
