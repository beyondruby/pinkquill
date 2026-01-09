"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunities, useDiscoverCommunities, useSuggestedCommunities } from "@/lib/hooks";
import CommunityCard from "@/components/communities/CommunityCard";

type TabType = 'discover' | 'joined' | 'created';
type SortType = 'trending' | 'newest' | 'members';

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'writing', name: 'Writing', fullName: 'Writing & Literature' },
  { id: 'visual_arts', name: 'Visual Arts', fullName: 'Visual Arts' },
  { id: 'performing_arts', name: 'Performing', fullName: 'Performing Arts' },
  { id: 'music', name: 'Music', fullName: 'Music & Audio' },
  { id: 'film', name: 'Film', fullName: 'Film & Video' },
  { id: 'photography', name: 'Photography', fullName: 'Photography' },
  { id: 'fashion_design', name: 'Fashion', fullName: 'Fashion & Design' },
  { id: 'crafts', name: 'Crafts', fullName: 'Crafts & Handmade' },
  { id: 'digital_creative', name: 'Digital', fullName: 'Digital Creative' },
  { id: 'architecture', name: 'Architecture', fullName: 'Architecture & Spaces' },
  { id: 'gaming', name: 'Gaming', fullName: 'Gaming & Interactive' },
  { id: 'technology', name: 'Tech', fullName: 'Creative Tech' },
];

export default function CommunitiesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('discover');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<SortType>('trending');
  const [showFilters, setShowFilters] = useState(false);

  const { communities: discoverCommunities, trending, loading: discoverLoading } = useDiscoverCommunities();
  const { communities: joinedCommunities, loading: joinedLoading } = useCommunities(user?.id, 'joined');
  const { communities: createdCommunities, loading: createdLoading } = useCommunities(user?.id, 'created');
  const { communities: suggestedCommunities, loading: suggestedLoading } = useSuggestedCommunities(user?.id, 6);

  // Get featured communities based on sort option
  const featuredCommunities = useMemo(() => {
    let communities = [...discoverCommunities];

    switch (sortBy) {
      case 'newest':
        communities = communities.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'members':
        communities = communities.sort((a, b) =>
          (b.member_count || 0) - (a.member_count || 0)
        );
        break;
      default:
        // For trending, use the trending array
        return trending.slice(0, 3);
    }

    return communities.slice(0, 3);
  }, [discoverCommunities, trending, sortBy]);

  // Filter out featured communities from main grid to avoid duplicates
  const featuredIds = useMemo(() => new Set(featuredCommunities.map(c => c.id)), [featuredCommunities]);

  const getFilteredCommunities = () => {
    let communities;
    switch (activeTab) {
      case 'joined':
        communities = joinedCommunities;
        break;
      case 'created':
        communities = createdCommunities;
        break;
      default:
        // On discover tab without search/filter, exclude featured communities from main grid
        if (!searchQuery.trim() && selectedCategory === 'all') {
          communities = discoverCommunities.filter(c => !featuredIds.has(c.id));
        } else {
          communities = discoverCommunities;
        }
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      communities = communities.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.topics?.some((t: string) => t.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      const category = CATEGORIES.find(c => c.id === selectedCategory);
      if (category?.fullName) {
        communities = communities.filter(c =>
          c.topics?.includes(category.fullName)
        );
      }
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        communities = [...communities].sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case 'members':
        communities = [...communities].sort((a, b) =>
          (b.member_count || 0) - (a.member_count || 0)
        );
        break;
      default:
        break;
    }

    return communities;
  };

  const filteredCommunities = getFilteredCommunities();
  const isLoading = activeTab === 'discover' ? discoverLoading :
                    activeTab === 'joined' ? joinedLoading : createdLoading;

  // Get top communities by category for browse section
  const topByCategory = useMemo(() => {
    const categoriesToShow = ['writing', 'visual_arts', 'music', 'photography'];

    return categoriesToShow.map(catId => {
      const cat = CATEGORIES.find(c => c.id === catId);
      return {
        id: catId,
        name: cat?.fullName || cat?.name || catId,
        communities: discoverCommunities
          .filter(c => c.topics?.includes(cat?.fullName || ''))
          .slice(0, 4)
      };
    }).filter(cat => cat.communities.length > 0);
  }, [discoverCommunities]);

  // Check if we have any communities at all (for empty state)
  const hasAnyCommunities = activeTab === 'discover'
    ? (featuredCommunities.length > 0 || filteredCommunities.length > 0)
    : filteredCommunities.length > 0;

  const showFeatured = activeTab === 'discover' && featuredCommunities.length > 0 && !searchQuery && selectedCategory === 'all';
  const showBrowseByCategory = activeTab === 'discover' && !searchQuery && selectedCategory === 'all' && topByCategory.length > 0;
  const hasActiveFilters = selectedCategory !== 'all' || sortBy !== 'trending';
  const activeFilterCount = (selectedCategory !== 'all' ? 1 : 0) + (sortBy !== 'trending' ? 1 : 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero Section - More Creative */}
      <div className="relative mb-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-primary/8 via-pink-vivid/5 to-orange-warm/8 rounded-3xl" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-purple-primary/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-gradient-to-tr from-pink-vivid/15 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative px-8 py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/70 backdrop-blur-sm border border-purple-primary/10 mb-5 shadow-sm">
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid" />
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid animate-ping opacity-75" />
                </div>
                <span className="font-ui text-xs font-semibold text-purple-primary uppercase tracking-widest">Creative Spaces</span>
              </div>

              <h1 className="font-display text-4xl md:text-5xl font-bold text-ink mb-4 leading-tight">
                Find Your
                <span className="block bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
                  Creative Tribe
                </span>
              </h1>

              <p className="font-body text-muted text-lg leading-relaxed">
                Connect with creatives of all kinds in spaces designed for inspiration and collaboration.
              </p>
            </div>

            {user && (
              <div className="flex-shrink-0">
                <Link
                  href="/community/create"
                  className="group relative inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-semibold shadow-xl shadow-purple-primary/25 hover:shadow-2xl hover:shadow-pink-vivid/30 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-vivid to-orange-warm opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <svg className="relative w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="relative">Create Community</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/90 backdrop-blur-sm border border-purple-primary/10 shadow-sm font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary/30 focus:bg-white transition-all placeholder:text-muted/60"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <svg className="w-5 h-5 text-purple-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
        </div>

        {/* Tabs */}
        {user && (
          <div className="flex gap-1 p-1 bg-white/80 backdrop-blur-sm rounded-xl border border-purple-primary/10 shadow-sm">
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-ui text-sm font-medium transition-all duration-200 ${
                activeTab === 'discover'
                  ? 'bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md'
                  : 'text-muted hover:text-ink hover:bg-purple-primary/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Discover
            </button>
            <button
              onClick={() => setActiveTab('joined')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-ui text-sm font-medium transition-all duration-200 ${
                activeTab === 'joined'
                  ? 'bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md'
                  : 'text-muted hover:text-ink hover:bg-purple-primary/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Joined
            </button>
            <button
              onClick={() => setActiveTab('created')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-ui text-sm font-medium transition-all duration-200 ${
                activeTab === 'created'
                  ? 'bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md'
                  : 'text-muted hover:text-ink hover:bg-purple-primary/5'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Created
            </button>
          </div>
        )}

      </div>

      {/* Filters */}
      <div className="mb-8">
        <div className="flex items-center gap-4">
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-ui text-sm transition-all ${
              showFilters || hasActiveFilters
                ? 'text-purple-primary'
                : 'text-muted hover:text-ink'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded bg-purple-primary text-white text-xs">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Divider */}
          <div className="h-4 w-px bg-black/10" />

          {/* Sort Options - Always Visible */}
          <div className="flex items-center gap-1">
            {[
              { id: 'trending', label: 'Trending' },
              { id: 'newest', label: 'New' },
              { id: 'members', label: 'Popular' },
            ].map((sort) => (
              <button
                key={sort.id}
                onClick={() => setSortBy(sort.id as SortType)}
                className={`px-3 py-1.5 rounded-lg font-ui text-sm transition-all ${
                  sortBy === sort.id
                    ? 'bg-black/[0.05] text-ink font-medium'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {sort.label}
              </button>
            ))}
          </div>

          {/* Active Category Chip */}
          {selectedCategory !== 'all' && (
            <>
              <div className="h-4 w-px bg-black/10" />
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-primary/10 text-purple-primary font-ui text-sm">
                {CATEGORIES.find(c => c.id === selectedCategory)?.name}
                <button
                  onClick={() => setSelectedCategory('all')}
                  className="hover:text-pink-vivid transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </>
          )}
        </div>

        {/* Category Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-black/5 animate-fadeIn">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    if (cat.id !== 'all') setShowFilters(false);
                  }}
                  className={`px-4 py-2 rounded-full font-ui text-sm transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-purple-primary text-white'
                      : 'bg-black/[0.03] text-ink/70 hover:bg-black/[0.06] hover:text-ink'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Featured Section (only on discover tab) */}
      {showFeatured && (
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                sortBy === 'trending' ? 'bg-gradient-to-br from-orange-warm via-pink-vivid to-purple-primary shadow-orange-warm/30' :
                sortBy === 'newest' ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-emerald-500/30' :
                'bg-gradient-to-br from-purple-primary to-pink-vivid shadow-purple-primary/30'
              }`}>
                {sortBy === 'trending' && (
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                  </svg>
                )}
                {sortBy === 'newest' && (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
                {sortBy === 'members' && (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
              {sortBy === 'trending' && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-warm rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-ink">
                {sortBy === 'trending' && 'Trending Now'}
                {sortBy === 'newest' && 'Just Launched'}
                {sortBy === 'members' && 'Most Popular'}
              </h2>
              <p className="font-ui text-sm text-muted">
                {sortBy === 'trending' && 'Popular communities this week'}
                {sortBy === 'newest' && 'Recently created communities'}
                {sortBy === 'members' && 'Communities with the most members'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCommunities.map((community, index) => (
              <CommunityCard key={community.id} community={community} variant="featured" rank={index + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Browse by Category Section */}
      {showBrowseByCategory && (
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-primary via-pink-vivid to-purple-primary flex items-center justify-center shadow-lg shadow-purple-primary/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-ink">Browse by Category</h2>
              <p className="font-ui text-sm text-muted">Top communities in each field</p>
            </div>
          </div>

          <div className="space-y-8">
            {topByCategory.map((category) => (
              <div key={category.id}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-ui text-sm font-semibold text-ink">{category.name}</h3>
                  <button
                    onClick={() => setSelectedCategory(category.id)}
                    className="font-ui text-xs text-purple-primary hover:text-pink-vivid transition-colors"
                  >
                    View all →
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {category.communities.map((community) => (
                    <Link
                      key={community.id}
                      href={`/community/${community.slug}`}
                      className="group p-4 rounded-xl bg-white/80 backdrop-blur-sm border border-purple-primary/10 hover:border-purple-primary/30 hover:shadow-lg hover:shadow-purple-primary/10 transition-all duration-300"
                    >
                      {community.cover_url ? (
                        <div className="w-full h-20 rounded-lg mb-3 overflow-hidden bg-black/5">
                          <img src={community.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                      ) : (
                        <div className="w-full h-20 rounded-lg mb-3 bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10" />
                      )}
                      <h4 className="font-ui text-sm font-medium text-ink group-hover:text-purple-primary transition-colors truncate">
                        {community.name}
                      </h4>
                      <p className="font-ui text-xs text-muted mt-1">
                        {community.member_count || 0} members
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Communities Section */}
      {activeTab === 'discover' && !searchQuery && selectedCategory === 'all' && user && suggestedCommunities.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm flex items-center justify-center shadow-lg shadow-purple-primary/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-ink">Suggested for You</h2>
              <p className="font-ui text-sm text-muted">Based on your interests and activity</p>
            </div>
          </div>

          {suggestedLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-purple-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suggestedCommunities.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Communities Section Header */}
      {activeTab === 'discover' && !searchQuery && selectedCategory === 'all' && filteredCommunities.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">All Communities</h2>
            <p className="font-ui text-xs text-muted">Explore all creative spaces</p>
          </div>
        </div>
      )}

      {/* Filtered Results Header */}
      {(searchQuery || selectedCategory !== 'all') && filteredCommunities.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <h2 className="font-display text-lg font-semibold text-ink">Results</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-purple-primary/10 font-ui text-xs font-medium text-purple-primary">
            {filteredCommunities.length}
          </span>
        </div>
      )}

      {/* Joined/Created Headers */}
      {activeTab === 'joined' && filteredCommunities.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <h2 className="font-display text-lg font-semibold text-ink">Your Communities</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-purple-primary/10 font-ui text-xs font-medium text-purple-primary">
            {filteredCommunities.length}
          </span>
        </div>
      )}

      {activeTab === 'created' && filteredCommunities.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <h2 className="font-display text-lg font-semibold text-ink">Communities You Created</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-purple-primary/10 font-ui text-xs font-medium text-purple-primary">
            {filteredCommunities.length}
          </span>
        </div>
      )}

      {/* Communities Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-purple-primary/20 border-t-purple-primary animate-spin" />
            <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-transparent border-r-pink-vivid/40 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          </div>
          <p className="font-ui text-sm text-muted">Discovering communities...</p>
        </div>
      ) : hasAnyCommunities ? (
        filteredCommunities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCommunities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </div>
        ) : activeTab === 'discover' && trending.length > 0 && !searchQuery ? (
          // Only trending communities exist, don't show empty state
          null
        ) : (
          <div className="text-center py-12">
            <p className="font-body text-muted">No results found for "{searchQuery}"</p>
          </div>
        )
      ) : (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-primary/5 via-pink-vivid/3 to-orange-warm/5 border border-purple-primary/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-pink-vivid/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative px-8 py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>

            <h3 className="font-display text-2xl font-bold text-ink mb-3">
              {searchQuery
                ? 'No communities found'
                : activeTab === 'joined'
                ? 'No communities joined yet'
                : activeTab === 'created'
                ? 'No communities created yet'
                : 'No communities to discover'}
            </h3>

            <p className="font-body text-muted mb-8 max-w-md mx-auto">
              {searchQuery
                ? 'Try a different search term or explore all communities'
                : activeTab === 'joined'
                ? 'Explore and join communities that match your creative interests'
                : activeTab === 'created'
                ? 'Create your first community and start building your creative tribe'
                : 'Be the first to create a community and bring creators together!'}
            </p>

            {!searchQuery && user && (
              <Link
                href="/community/create"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-semibold shadow-lg shadow-purple-primary/25 hover:shadow-xl hover:shadow-pink-vivid/30 hover:-translate-y-1 transition-all duration-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Community
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
