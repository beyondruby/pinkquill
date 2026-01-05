"use client";

import { useState } from "react";
import Link from "next/link";
import { useContentInsights, TimeRange, DateRange } from "@/lib/hooks/useInsights";
import DateRangePicker from "@/components/insights/DateRangePicker";
import LoadingSkeleton from "@/components/insights/shared/LoadingSkeleton";
import EmptyState from "@/components/insights/shared/EmptyState";

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

const postTypeLabels: Record<string, string> = {
  poem: "Poem",
  journal: "Journal",
  thought: "Thought",
  visual: "Visual",
  audio: "Audio",
  video: "Video",
  essay: "Essay",
  screenplay: "Screenplay",
  story: "Story",
  letter: "Letter",
  quote: "Quote",
};

const postTypeIcons: Record<string, React.ReactNode> = {
  poem: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  ),
  journal: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  visual: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  video: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  audio: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ),
  default: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

type SortField = "views" | "engagement" | "date";
type SortOrder = "asc" | "desc";
type ContentFilter = "all" | "posts" | "takes";

export default function InsightsContentPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [sortField, setSortField] = useState<SortField>("views");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filter, setFilter] = useState<ContentFilter>("all");

  const { content, loading, error } = useContentInsights(timeRange, customRange);

  const handleTimeRangeChange = (range: TimeRange, custom?: DateRange) => {
    setTimeRange(range);
    setCustomRange(custom);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredContent = content
    ?.filter((item) => {
      if (filter === "all") return true;
      if (filter === "posts") return item.type === "post";
      if (filter === "takes") return item.type === "take";
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "views") {
        comparison = a.views - b.views;
      } else if (sortField === "engagement") {
        comparison = a.engagementRate - b.engagementRate;
      } else if (sortField === "date") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">Content Insights</h1>
            <p className="font-body text-muted mt-1">Performance of your posts and takes</p>
          </div>
        </div>
        <LoadingSkeleton type="table" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink mb-8">Content Insights</h1>
        <EmptyState
          title="Error Loading Content"
          description={error}
          action={{ label: "Try Again", onClick: () => window.location.reload() }}
        />
      </div>
    );
  }

  if (!filteredContent || filteredContent.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">Content Insights</h1>
            <p className="font-body text-muted mt-1">Performance of your posts and takes</p>
          </div>
          <DateRangePicker
            value={timeRange}
            customRange={customRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <EmptyState
          title="No Content Yet"
          description="Start creating posts and takes to see their performance metrics here."
          action={{ label: "Create Post", href: "/create" }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Content Insights</h1>
          <p className="font-body text-muted mt-1">Performance of your posts and takes</p>
        </div>
        <DateRangePicker
          value={timeRange}
          customRange={customRange}
          onChange={handleTimeRangeChange}
        />
      </div>

      {/* Filters & Sort */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full font-ui text-sm transition-colors ${
              filter === "all"
                ? "bg-purple-primary text-white"
                : "bg-white border border-black/10 text-ink hover:bg-black/[0.02]"
            }`}
          >
            All ({content?.length || 0})
          </button>
          <button
            onClick={() => setFilter("posts")}
            className={`px-4 py-2 rounded-full font-ui text-sm transition-colors ${
              filter === "posts"
                ? "bg-purple-primary text-white"
                : "bg-white border border-black/10 text-ink hover:bg-black/[0.02]"
            }`}
          >
            Posts ({content?.filter(c => c.type === "post").length || 0})
          </button>
          <button
            onClick={() => setFilter("takes")}
            className={`px-4 py-2 rounded-full font-ui text-sm transition-colors ${
              filter === "takes"
                ? "bg-purple-primary text-white"
                : "bg-white border border-black/10 text-ink hover:bg-black/[0.02]"
            }`}
          >
            Takes ({content?.filter(c => c.type === "take").length || 0})
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <span className="font-ui text-xs text-muted">Sort by:</span>
          <div className="flex bg-white border border-black/10 rounded-lg overflow-hidden">
            <button
              onClick={() => handleSort("views")}
              className={`px-3 py-1.5 font-ui text-xs transition-colors ${
                sortField === "views"
                  ? "bg-purple-primary/10 text-purple-primary"
                  : "text-muted hover:text-ink"
              }`}
            >
              Views {sortField === "views" && (sortOrder === "desc" ? "↓" : "↑")}
            </button>
            <button
              onClick={() => handleSort("engagement")}
              className={`px-3 py-1.5 font-ui text-xs border-l border-black/10 transition-colors ${
                sortField === "engagement"
                  ? "bg-purple-primary/10 text-purple-primary"
                  : "text-muted hover:text-ink"
              }`}
            >
              Engagement {sortField === "engagement" && (sortOrder === "desc" ? "↓" : "↑")}
            </button>
            <button
              onClick={() => handleSort("date")}
              className={`px-3 py-1.5 font-ui text-xs border-l border-black/10 transition-colors ${
                sortField === "date"
                  ? "bg-purple-primary/10 text-purple-primary"
                  : "text-muted hover:text-ink"
              }`}
            >
              Date {sortField === "date" && (sortOrder === "desc" ? "↓" : "↑")}
            </button>
          </div>
        </div>
      </div>

      {/* Content List */}
      <div className="space-y-3">
        {filteredContent.map((item) => (
          <Link
            key={`${item.type}-${item.id}`}
            href={`/insights/content/${item.type}/${item.id}`}
            className="block bg-white rounded-xl border border-black/[0.04] hover:border-purple-primary/20 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center p-4 gap-4">
              {/* Thumbnail */}
              <div className="relative w-16 h-16 rounded-lg bg-purple-primary/5 flex-shrink-0 overflow-hidden">
                {item.thumbnail ? (
                  <>
                    <img
                      src={item.thumbnail}
                      alt={item.title || "Content thumbnail"}
                      className="w-full h-full object-cover"
                    />
                    {/* Video play indicator overlay */}
                    {item.type === "take" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                          <svg className="w-3 h-3 text-purple-primary ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {item.type === "take" ? (
                      <svg className="w-6 h-6 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <span className="text-purple-primary">
                        {postTypeIcons[item.postType || ""] || postTypeIcons.default}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Content Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-ui text-sm font-medium text-ink line-clamp-1">
                  {item.title || "Untitled"}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-ui ${
                    item.type === "take"
                      ? "bg-pink-vivid/10 text-pink-vivid"
                      : "bg-purple-primary/10 text-purple-primary"
                  }`}>
                    {item.type === "take" ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Take
                      </>
                    ) : (
                      postTypeLabels[item.postType || ""] || "Post"
                    )}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(item.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-center min-w-[60px]">
                  <p className="font-ui text-lg font-medium text-ink">{formatNumber(item.views)}</p>
                  <p className="font-body text-xs text-muted">views</p>
                </div>
                <div className="text-center min-w-[60px]">
                  <p className="font-ui text-lg font-medium text-ink">{formatNumber(item.reactions)}</p>
                  <p className="font-body text-xs text-muted">reactions</p>
                </div>
                <div className="text-center min-w-[60px]">
                  <p className="font-ui text-lg font-medium text-ink">{formatNumber(item.comments)}</p>
                  <p className="font-body text-xs text-muted">comments</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-black/[0.02] flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-6 border-t border-black/[0.04]">
        <p className="font-body text-sm text-muted text-center">
          Showing {filteredContent.length} {filteredContent.length === 1 ? "item" : "items"}
          {filter !== "all" && ` (filtered)`}
        </p>
      </div>
    </div>
  );
}
