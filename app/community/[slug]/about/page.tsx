"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers } from "@/lib/hooks";

export default function CommunityAboutPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, rules, tags, loading } = useCommunity(slug, user?.id);

  // Fetch admins and moderators
  const { members: admins } = useCommunityMembers(community?.id || '', { role: 'admin' });
  const { members: moderators } = useCommunityMembers(community?.id || '', { role: 'moderator' });

  if (loading || !community) return null;

  const isAdmin = community.user_role === 'admin';
  const isMod = community.user_role === 'moderator';

  // Group tags by type
  const genreTags = tags.filter(t => t.tag_type === 'genre');
  const themeTags = tags.filter(t => t.tag_type === 'theme');
  const typeTags = tags.filter(t => t.tag_type === 'type');
  const customTags = tags.filter(t => t.tag_type === 'custom');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Description */}
        <div className="bg-white rounded-xl border border-black/5 p-6">
          <h2 className="font-display text-xl font-bold text-ink mb-4">About</h2>
          {community.description ? (
            <p className="font-body text-ink/80 whitespace-pre-wrap">
              {community.description}
            </p>
          ) : (
            <p className="font-body text-muted/50 italic">
              No description provided yet.
            </p>
          )}
        </div>

        {/* Rules */}
        <div className="bg-white rounded-xl border border-black/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold text-ink">Community Rules</h2>
            {(isAdmin || isMod) && (
              <Link
                href={`/community/${community.slug}/settings/rules`}
                className="font-ui text-sm text-purple-primary hover:underline"
              >
                Edit rules
              </Link>
            )}
          </div>

          {rules.length > 0 ? (
            <ol className="space-y-4">
              {rules.map((rule, index) => (
                <li key={rule.id} className="flex gap-4">
                  <span className="w-8 h-8 rounded-full bg-purple-primary/10 text-purple-primary flex items-center justify-center flex-shrink-0 font-ui font-semibold">
                    {index + 1}
                  </span>
                  <div className="flex-1 pt-1">
                    <h3 className="font-ui font-semibold text-ink">{rule.title}</h3>
                    {rule.description && (
                      <p className="font-body text-sm text-muted mt-1">{rule.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="font-body text-muted/50 italic">
              No community rules have been set yet.
            </p>
          )}
        </div>

        {/* Tags - Organized by Category */}
        {tags.length > 0 && (
          <div className="bg-white rounded-xl border border-black/5 p-6">
            <h2 className="font-display text-xl font-bold text-ink mb-5">Tags</h2>
            <div className="space-y-5">
              {/* Genres */}
              {genreTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <h3 className="font-ui text-sm font-semibold text-ink">Genres</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {genreTags.map((tag) => (
                      <span key={tag.id} className="px-3 py-1.5 rounded-full text-sm font-ui font-medium bg-purple-100 text-purple-700">
                        {tag.tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Themes */}
              {themeTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    <h3 className="font-ui text-sm font-semibold text-ink">Themes</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {themeTags.map((tag) => (
                      <span key={tag.id} className="px-3 py-1.5 rounded-full text-sm font-ui font-medium bg-pink-100 text-pink-700">
                        {tag.tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Community Types */}
              {typeTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="font-ui text-sm font-semibold text-ink">Community Type</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {typeTags.map((tag) => (
                      <span key={tag.id} className="px-3 py-1.5 rounded-full text-sm font-ui font-medium bg-blue-100 text-blue-700">
                        {tag.tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Tags */}
              {customTags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <h3 className="font-ui text-sm font-semibold text-ink">Other Tags</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {customTags.map((tag) => (
                      <span key={tag.id} className="px-3 py-1.5 rounded-full text-sm font-ui font-medium bg-gray-100 text-gray-700">
                        {tag.tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Community Info */}
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <h3 className="font-ui text-sm font-semibold text-ink mb-4">Community Info</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="font-ui text-muted">Created</dt>
              <dd className="font-body text-ink">
                {new Date(community.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="font-ui text-muted">Privacy</dt>
              <dd className="font-body text-ink capitalize flex items-center gap-1.5">
                {community.privacy === 'private' ? (
                  <>
                    <svg className="w-4 h-4 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Private
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                    </svg>
                    Public
                  </>
                )}
              </dd>
            </div>
            {community.topics && community.topics.length > 0 && (
              <div className="flex items-start justify-between gap-4">
                <dt className="font-ui text-muted shrink-0">Topics</dt>
                <dd className="font-body text-ink text-right">
                  {community.topics.join(', ')}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="font-ui text-muted">Members</dt>
              <dd className="font-body text-ink">{community.member_count || 0}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="font-ui text-muted">Posts</dt>
              <dd className="font-body text-ink">{community.post_count || 0}</dd>
            </div>
          </dl>
        </div>

        {/* Moderators */}
        {(admins.length > 0 || moderators.length > 0) && (
          <div className="bg-white rounded-xl border border-black/5 p-4">
            <h3 className="font-ui text-sm font-semibold text-ink mb-3">Moderators</h3>
            <div className="space-y-3">
              {/* Admins */}
              {admins.map((admin) => (
                <Link
                  key={admin.id}
                  href={`/studio/${admin.profile?.username}`}
                  className="flex items-center gap-3 group"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-primary to-pink-vivid">
                      {admin.profile?.avatar_url ? (
                        <img
                          src={admin.profile.avatar_url}
                          alt={admin.profile.display_name || admin.profile.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                          {(admin.profile?.display_name || admin.profile?.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {/* Admin crown badge */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-warm flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2l2.5 5 5.5.8-4 3.9.9 5.3L10 14.5l-4.9 2.5.9-5.3-4-3.9 5.5-.8L10 2z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-ui font-medium text-ink group-hover:text-purple-primary transition-colors">
                        {admin.profile?.display_name || admin.profile?.username}
                      </p>
                      <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-ui font-bold uppercase bg-orange-warm/20 text-orange-warm">
                        Admin
                      </span>
                    </div>
                    <p className="font-ui text-xs text-muted">@{admin.profile?.username}</p>
                  </div>
                </Link>
              ))}

              {/* Moderators */}
              {moderators.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/studio/${mod.profile?.username}`}
                  className="flex items-center gap-3 group"
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600">
                      {mod.profile?.avatar_url ? (
                        <img
                          src={mod.profile.avatar_url}
                          alt={mod.profile.display_name || mod.profile.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                          {(mod.profile?.display_name || mod.profile?.username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {/* Mod shield badge */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-ui font-medium text-ink group-hover:text-purple-primary transition-colors">
                        {mod.profile?.display_name || mod.profile?.username}
                      </p>
                      <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-ui font-bold uppercase bg-blue-500/20 text-blue-600">
                        Mod
                      </span>
                    </div>
                    <p className="font-ui text-xs text-muted">@{mod.profile?.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
