"use client";

import React from "react";
import Link from "next/link";
import { Community } from "@/lib/hooks";

interface CommunityCardProps {
  community: Community;
  showJoinButton?: boolean;
  onJoin?: () => void;
  variant?: 'default' | 'featured';
  rank?: number;
}

function formatCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
}

export default function CommunityCard({ community, variant = 'default', rank }: CommunityCardProps) {
  const isFeatured = variant === 'featured';

  return (
    <Link
      href={`/community/${community.slug}`}
      className="group block community-card"
    >
      <div className={`relative h-full bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border transition-all duration-300 ${
        isFeatured
          ? 'border-purple-primary/20 shadow-lg shadow-purple-primary/10 hover:shadow-xl hover:shadow-purple-primary/20 hover:border-purple-primary/30'
          : 'border-white/60 shadow-md shadow-purple-primary/5 hover:shadow-lg hover:shadow-purple-primary/15 hover:border-purple-primary/20'
      } hover:-translate-y-1`}>

        {/* Rank Badge for Featured */}
        {isFeatured && rank && (
          <div className="absolute top-3 left-3 z-20">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-ui text-sm font-bold text-white shadow-lg ${
              rank === 1 ? 'bg-gradient-to-br from-orange-warm to-pink-vivid shadow-orange-warm/40' :
              rank === 2 ? 'bg-gradient-to-br from-purple-primary to-pink-vivid shadow-purple-primary/40' :
              'bg-gradient-to-br from-pink-vivid to-purple-primary shadow-pink-vivid/40'
            }`}>
              {rank}
            </div>
          </div>
        )}

        {/* Cover Image with Gradient Overlay */}
        <div className={`relative overflow-hidden ${isFeatured ? 'h-32' : 'h-28'}`}>
          {community.cover_url ? (
            <>
              <img
                src={community.cover_url}
                alt=""
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-primary via-pink-vivid/80 to-orange-warm/60 group-hover:scale-105 transition-transform duration-500">
              <div className="absolute inset-0 opacity-30">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <pattern id={`pattern-${community.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="10" cy="10" r="1.5" fill="white" opacity="0.3" />
                    </pattern>
                  </defs>
                  <rect width="100" height="100" fill={`url(#pattern-${community.id})`} />
                </svg>
              </div>
            </div>
          )}

          {/* Privacy Badge */}
          <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[0.65rem] font-ui font-semibold uppercase tracking-wide backdrop-blur-md ${
            community.privacy === 'private'
              ? 'bg-white/90 text-purple-primary'
              : 'bg-white/90 text-green-600'
          }`}>
            {community.privacy === 'private' ? (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Private
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                </svg>
                Public
              </span>
            )}
          </div>
        </div>

        {/* Avatar - Overlapping */}
        <div className="relative px-4 -mt-8 z-10">
          <div className={`rounded-full overflow-hidden border-4 border-white shadow-lg bg-white ${
            isFeatured ? 'w-16 h-16' : 'w-14 h-14'
          }`}>
            {community.avatar_url ? (
              <img
                src={community.avatar_url}
                alt={community.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white font-display font-bold text-xl">
                {community.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pt-3">
          <h3 className={`font-display font-semibold text-ink line-clamp-1 group-hover:text-purple-primary transition-colors ${
            isFeatured ? 'text-lg' : 'text-base'
          }`}>
            {community.name}
          </h3>

          {community.description && (
            <p className={`font-body text-muted mt-1.5 line-clamp-2 ${
              isFeatured ? 'text-sm' : 'text-xs'
            }`}>
              {community.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-purple-primary/5">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="font-ui text-xs font-semibold text-ink">
                {formatCount(community.member_count || 0)}
              </span>
              <span className="font-ui text-xs text-muted">
                {(community.member_count || 0) === 1 ? 'member' : 'members'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-vivid/10 to-orange-warm/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <span className="font-ui text-xs font-semibold text-ink">
                {formatCount(community.post_count || 0)}
              </span>
              <span className="font-ui text-xs text-muted">posts</span>
            </div>
          </div>

          {/* Member Status Badge */}
          {community.is_member && (
            <div className="mt-3 pt-3 border-t border-purple-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
                  <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-ui text-xs font-semibold text-green-700">Joined</span>
                </div>

                {community.user_role && community.user_role !== 'member' && (
                  <span className={`px-2.5 py-1 rounded-full text-[0.65rem] font-ui font-bold uppercase tracking-wide ${
                    community.user_role === 'admin'
                      ? 'bg-gradient-to-r from-orange-warm/15 to-pink-vivid/10 text-orange-warm border border-orange-warm/20'
                      : 'bg-gradient-to-r from-purple-primary/15 to-pink-vivid/10 text-purple-primary border border-purple-primary/20'
                  }`}>
                    {community.user_role}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hover Glow Effect */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-primary/5 via-transparent to-pink-vivid/5" />
        </div>
      </div>
    </Link>
  );
}
