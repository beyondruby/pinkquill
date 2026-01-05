"use client";

import React from "react";
import Link from "next/link";
import type { SearchResultProfile, SearchResultCommunity, SearchResultTag } from "@/lib/hooks";

interface ProfileItemProps {
  type: "profile";
  data: SearchResultProfile;
  onClick?: () => void;
}

interface CommunityItemProps {
  type: "community";
  data: SearchResultCommunity;
  onClick?: () => void;
}

interface TagItemProps {
  type: "tag";
  data: SearchResultTag;
  onClick?: () => void;
}

interface HistoryItemProps {
  type: "history";
  data: {
    label: string;
    resultType: "profile" | "community" | "tag";
  };
  onClick?: () => void;
  onRemove?: () => void;
}

type SearchResultItemProps = ProfileItemProps | CommunityItemProps | TagItemProps | HistoryItemProps;

export default function SearchResultItem(props: SearchResultItemProps) {
  const { type, onClick } = props;

  if (type === "profile") {
    const { data } = props as ProfileItemProps;
    return (
      <Link
        href={`/studio/${data.username}`}
        onClick={onClick}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-primary/5 transition-colors duration-200 cursor-pointer"
      >
        <img
          src={data.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop"}
          alt={data.display_name || data.username}
          className="w-8 h-8 rounded-full object-cover border border-purple-primary/10"
        />
        <div className="flex flex-col min-w-0">
          <span className="font-ui text-[0.85rem] font-medium text-ink truncate">
            {data.display_name || data.username}
          </span>
          <span className="font-body text-[0.75rem] text-muted truncate">
            @{data.username}
          </span>
        </div>
      </Link>
    );
  }

  if (type === "community") {
    const { data } = props as CommunityItemProps;
    return (
      <Link
        href={`/community/${data.slug}`}
        onClick={onClick}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-primary/5 transition-colors duration-200 cursor-pointer"
      >
        {data.avatar_url ? (
          <img
            src={data.avatar_url}
            alt={data.name}
            className="w-8 h-8 rounded-lg object-cover border border-purple-primary/10"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        )}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-ui text-[0.85rem] font-medium text-ink truncate">
            {data.name}
          </span>
          <span className="font-body text-[0.75rem] text-muted">
            {data.member_count} {data.member_count === 1 ? "member" : "members"}
          </span>
        </div>
      </Link>
    );
  }

  if (type === "tag") {
    const { data } = props as TagItemProps;
    return (
      <Link
        href={`/explore?tag=${encodeURIComponent(data.tag)}`}
        onClick={onClick}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-primary/5 transition-colors duration-200 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
          <span className="text-white font-ui text-[0.9rem] font-bold">#</span>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-ui text-[0.85rem] font-medium text-ink truncate">
            {data.tag}
          </span>
          <span className="font-body text-[0.75rem] text-muted">
            {data.community_count} {data.community_count === 1 ? "community" : "communities"}
          </span>
        </div>
      </Link>
    );
  }

  if (type === "history") {
    const { data, onRemove } = props as HistoryItemProps;

    const getIcon = () => {
      switch (data.resultType) {
        case "profile":
          return (
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          );
        case "community":
          return (
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          );
        case "tag":
          return (
            <span className="font-ui text-[0.75rem] font-bold text-muted">#</span>
          );
      }
    };

    const getHref = () => {
      if (data.resultType === "profile") {
        return `/studio/${data.label.replace("@", "")}`;
      } else if (data.resultType === "community") {
        return `/community/${data.label.toLowerCase().replace(/\s+/g, "-")}`;
      } else {
        return `/explore?tag=${encodeURIComponent(data.label.replace("#", ""))}`;
      }
    };

    return (
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-purple-primary/5 transition-colors duration-200 group">
        <Link
          href={getHref()}
          onClick={onClick}
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            {getIcon()}
          </div>
          <span className="font-ui text-[0.85rem] text-ink truncate">
            {data.label}
          </span>
        </Link>
        {onRemove && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all"
          >
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return null;
}
