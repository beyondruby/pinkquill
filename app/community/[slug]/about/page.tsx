"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunity, useCommunityMembers } from "@/lib/hooks.legacy";
import { PersonRow, formatDay } from "@/components/communities/pieces";
import { categoryForTopics } from "@/lib/communities/categories";
import "@/components/communities/communities.css";

/** What this community is, its rules, what it's about, and who runs it. */
export default function CommunityAboutPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { community, rules, tags, loading } = useCommunity(slug, user?.id);
  const { members: admins } = useCommunityMembers(community?.id || "", { role: "admin" });
  const { members: moderators } = useCommunityMembers(community?.id || "", { role: "moderator" });

  if (loading || !community) return null;

  const isStaff = community.user_role === "admin" || community.user_role === "moderator";
  const groups = [
    { label: "Genres", items: tags.filter((t) => t.tag_type === "genre") },
    { label: "Themes", items: tags.filter((t) => t.tag_type === "theme") },
    { label: "Purpose", items: tags.filter((t) => t.tag_type === "type") },
    { label: "Also", items: tags.filter((t) => t.tag_type === "custom") },
  ].filter((g) => g.items.length > 0);
  const category = categoryForTopics(community.topics);
  const team = [...admins, ...moderators];

  return (
    <div className="pq-community-layout">
      <div className="pq-community-main grid gap-4">
        <section className="pq-side-card" aria-labelledby="about-heading">
          <h2 id="about-heading" className="pq-side-card__title">About</h2>
          {community.description ? (
            <p className="pq-side-card__text whitespace-pre-wrap text-ink">{community.description}</p>
          ) : (
            <p className="pq-side-card__text">The admins haven&rsquo;t written a description yet.</p>
          )}
        </section>

        <section className="pq-side-card" aria-labelledby="rules-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="rules-heading" className="pq-side-card__title">Rules</h2>
            {isStaff && <Link href={`/community/${community.slug}/settings/rules`} className="pq-side-card__link">Edit rules</Link>}
          </div>
          {rules.length > 0 ? (
            <ol className="grid gap-2 list-none p-0 m-0">
              {rules.map((rule, index) => (
                <li key={rule.id} className="pq-rule">
                  <span className="pq-rule__num">{index + 1}</span>
                  <span className="pq-rule__text">
                    {rule.title}
                    {rule.description && <small>{rule.description}</small>}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pq-side-card__text">No rules of its own yet. Pinkquill&rsquo;s <Link href="/community-guidelines" className="underline">guidelines</Link> still apply.</p>
          )}
        </section>

        {groups.length > 0 && (
          <section className="pq-side-card" aria-labelledby="tags-heading">
            <h2 id="tags-heading" className="pq-side-card__title">What it&rsquo;s about</h2>
            {groups.map((group) => (
              <div key={group.label}>
                <p className="pq-label">{group.label}</p>
                <div className="pq-chip-row">
                  {group.items.map((tag) => <span key={tag.id} className="pq-chip capitalize">{tag.tag}</span>)}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      <aside className="pq-community-aside" aria-label="Details">
        <div className="pq-side-card">
          <h2 className="pq-side-card__title">Details</h2>
          <dl className="pq-summary">
            <div><dt>Started</dt><dd>{formatDay(community.created_at)}</dd></div>
            <div><dt>Who can join</dt><dd>{community.privacy === "private" ? "By request" : "Anyone"}</dd></div>
            {category && <div><dt>Category</dt><dd>{category.name}</dd></div>}
            <div><dt>Members</dt><dd>{community.member_count || 0}</dd></div>
            <div><dt>Posts</dt><dd>{community.post_count || 0}</dd></div>
          </dl>
        </div>

        {team.length > 0 && (
          <div className="pq-side-card" style={{ padding: 0 }}>
            <h2 className="pq-side-card__title px-[1.125rem] pt-4">Run by</h2>
            <div>
              {team.map((member) => (
                <PersonRow key={member.id} person={member.profile} word={member.role === "admin" ? "Admin" : "Moderator"} />
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
