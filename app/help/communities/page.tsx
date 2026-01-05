"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faPlus, faCog, faGavel, faUserShield } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "what-are-communities", label: "What Are Communities" },
  { id: "discovering", label: "Discovering Communities" },
  { id: "joining", label: "Joining Communities" },
  { id: "creating", label: "Creating a Community" },
  { id: "posting", label: "Posting in Communities" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "moderation", label: "Moderation" },
  { id: "settings", label: "Community Settings" },
  { id: "leaving", label: "Leaving a Community" },
];

export default function CommunitiesHelpPage() {
  const [activeSection, setActiveSection] = useState("what-are-communities");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    tocItems.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <FontAwesomeIcon icon={faUsers} className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-ink">Communities</h1>
            <p className="font-body text-muted">Find your tribe and build creative spaces</p>
          </div>
        </div>
      </header>

      <div className="flex gap-12">
        {/* Sidebar TOC */}
        <aside className="hidden xl:block w-48 flex-shrink-0">
          <nav className="sticky top-24">
            <p className="font-ui text-[0.6rem] tracking-[0.2em] uppercase text-muted/60 mb-4">
              On this page
            </p>
            <ul className="space-y-1">
              {tocItems.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={`group flex items-center gap-2 py-1.5 text-sm transition-all duration-200 ${
                      activeSection === id
                        ? "text-purple-primary font-medium"
                        : "text-muted/70 hover:text-ink"
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full transition-all duration-200 ${
                        activeSection === id
                          ? "bg-purple-primary scale-150"
                          : "bg-muted/30 group-hover:bg-muted"
                      }`}
                    />
                    <span className="font-body text-[0.85rem]">{label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <article className="flex-1 help-content">
          <section id="what-are-communities" className="scroll-mt-24 mb-16">
            <h2>What Are Communities</h2>
            <p>
              Communities are spaces on PinkQuill organized around shared interests, genres, themes,
              or creative goals. They're where creators with similar passions come together to
              share work, give feedback, and inspire each other.
            </p>

            <h3>Types of communities</h3>
            <ul>
              <li>
                <strong>Public communities</strong> — Anyone can view and join. Content is visible
                to everyone.
              </li>
              <li>
                <strong>Private communities</strong> — Membership by request or invitation. Content
                is only visible to members.
              </li>
            </ul>

            <h3>What you can do in communities</h3>
            <ul>
              <li>Post content relevant to the community's focus</li>
              <li>Comment on and react to members' posts</li>
              <li>Connect with like-minded creators</li>
              <li>Participate in community discussions</li>
            </ul>
          </section>

          <section id="discovering" className="scroll-mt-24 mb-16">
            <h2>Discovering Communities</h2>
            <p>Find communities that match your interests:</p>

            <h3>Browse communities</h3>
            <ol>
              <li>Click "Communities" in the left sidebar</li>
              <li>Browse the Discover tab for popular and trending communities</li>
              <li>Use the search bar to find specific topics</li>
              <li>Filter by topics (Poetry, Fiction, Visual Arts, etc.)</li>
            </ol>

            <h3>Community cards</h3>
            <p>Each community card shows:</p>
            <ul>
              <li>Community name and description</li>
              <li>Cover image and avatar</li>
              <li>Member count</li>
              <li>Topics/tags</li>
              <li>Privacy setting (public or private)</li>
            </ul>

            <h3>Trending communities</h3>
            <p>
              The Discover page highlights trending communities based on activity and growth.
              This is a great way to find active, engaging spaces.
            </p>
          </section>

          <section id="joining" className="scroll-mt-24 mb-16">
            <h2>Joining Communities</h2>

            <h3>Joining a public community</h3>
            <ol>
              <li>Find the community you want to join</li>
              <li>Click the "Join" button</li>
              <li>You're now a member!</li>
            </ol>

            <h3>Joining a private community</h3>
            <ol>
              <li>Find the private community</li>
              <li>Click "Request to Join"</li>
              <li>Wait for an admin or moderator to approve your request</li>
              <li>You'll be notified when accepted</li>
            </ol>

            <h3>Accepting invitations</h3>
            <p>
              If you receive an invitation to a community, you'll see it in your notifications.
              Click to accept or decline the invitation.
            </p>
          </section>

          <section id="creating" className="scroll-mt-24 mb-16">
            <h2>Creating a Community</h2>
            <p>Ready to start your own space? Here's how:</p>

            <ol>
              <li>Go to Communities → click "Create Community"</li>
              <li>
                <strong>Basic info:</strong>
                <ul>
                  <li>Enter a community name</li>
                  <li>Create a URL slug (e.g., /community/your-slug)</li>
                  <li>Write a description</li>
                  <li>Choose privacy (public or private)</li>
                </ul>
              </li>
              <li>
                <strong>Categorize:</strong>
                <ul>
                  <li>Select topics that describe your community</li>
                  <li>Add genres, themes, and community types</li>
                </ul>
              </li>
              <li>
                <strong>Rules:</strong>
                <ul>
                  <li>Add community rules and guidelines</li>
                  <li>These help members understand expectations</li>
                </ul>
              </li>
              <li>Click "Create Community" to finish</li>
            </ol>

            <div className="bg-purple-primary/5 rounded-xl p-4 border border-purple-primary/10 my-6">
              <p className="font-ui text-sm text-ink mb-0">
                <strong>Tip:</strong> Choose a clear, descriptive name and add topics to help
                people find your community.
              </p>
            </div>
          </section>

          <section id="posting" className="scroll-mt-24 mb-16">
            <h2>Posting in Communities</h2>
            <p>Share your work with community members:</p>

            <h3>Creating a community post</h3>
            <ol>
              <li>Go to the community page</li>
              <li>Click "Create Post" in the header</li>
              <li>Create your post as usual</li>
              <li>The post will automatically be associated with the community</li>
            </ol>

            <p>
              Alternatively, when creating a post from the main Create page, you can select
              a community to post to from the community dropdown.
            </p>

            <h3>Community post guidelines</h3>
            <ul>
              <li>Follow the community's specific rules</li>
              <li>Keep content relevant to the community's theme</li>
              <li>Respect other members and their work</li>
              <li>Use content warnings when appropriate</li>
            </ul>
          </section>

          <section id="roles" className="scroll-mt-24 mb-16">
            <h2>Roles & Permissions</h2>
            <p>Communities have three member roles:</p>

            <h3>Admin</h3>
            <ul>
              <li>Full control over community settings</li>
              <li>Can add/remove moderators</li>
              <li>Can delete any post or comment</li>
              <li>Can ban or mute members</li>
              <li>Can edit community info and rules</li>
              <li>Can delete the community</li>
            </ul>
            <p>The creator of a community is automatically the admin.</p>

            <h3>Moderator</h3>
            <ul>
              <li>Can remove posts and comments</li>
              <li>Can mute or ban members</li>
              <li>Can pin posts</li>
              <li>Cannot change community settings</li>
              <li>Cannot add other moderators</li>
            </ul>

            <h3>Member</h3>
            <ul>
              <li>Can view community content</li>
              <li>Can post (if not muted)</li>
              <li>Can comment and react</li>
              <li>Can report content</li>
            </ul>
          </section>

          <section id="moderation" className="scroll-mt-24 mb-16">
            <h2>Moderation</h2>
            <p>If you're an admin or moderator, you have tools to keep your community healthy:</p>

            <h3>Moderation actions</h3>
            <ul>
              <li><strong>Remove post</strong> — Delete a post that violates rules</li>
              <li><strong>Mute member</strong> — Temporarily prevent a member from posting</li>
              <li><strong>Ban member</strong> — Permanently remove a member from the community</li>
              <li><strong>Pin post</strong> — Keep an important post at the top of the feed</li>
            </ul>

            <h3>Handling reports</h3>
            <p>
              Members can report content that violates rules. Reports appear in the moderation
              settings. Review each report and take appropriate action.
            </p>

            <h3>Community rules</h3>
            <p>
              Clear rules help set expectations. Go to Community Settings → Rules to add,
              edit, or reorder your community's guidelines.
            </p>
          </section>

          <section id="settings" className="scroll-mt-24 mb-16">
            <h2>Community Settings</h2>
            <p>
              Admins can access community settings by clicking the gear icon on the
              community page or going to Community → Settings.
            </p>

            <h3>General settings</h3>
            <ul>
              <li>Edit community name and description</li>
              <li>Update avatar and cover image</li>
              <li>Change privacy settings</li>
              <li>Update topics and tags</li>
            </ul>

            <h3>Member management</h3>
            <ul>
              <li>View all members</li>
              <li>Promote members to moderator</li>
              <li>Mute or ban members</li>
              <li>Handle join requests (for private communities)</li>
            </ul>

            <h3>Moderation settings</h3>
            <ul>
              <li>Configure auto-moderation</li>
              <li>Review reported content</li>
              <li>View moderation log</li>
            </ul>

            <h3>Rules management</h3>
            <ul>
              <li>Add new rules</li>
              <li>Edit existing rules</li>
              <li>Reorder rules</li>
              <li>Delete rules</li>
            </ul>
          </section>

          <section id="leaving" className="scroll-mt-24 mb-16">
            <h2>Leaving a Community</h2>
            <p>If you want to leave a community:</p>
            <ol>
              <li>Go to the community page</li>
              <li>Click the "Joined" button (or the settings menu)</li>
              <li>Select "Leave community"</li>
              <li>Confirm your choice</li>
            </ol>

            <h3>What happens when you leave</h3>
            <ul>
              <li>You'll no longer see the community in your "Joined" tab</li>
              <li>Your posts in the community remain (unless you delete them)</li>
              <li>You can rejoin public communities anytime</li>
              <li>For private communities, you'll need to request to join again</li>
            </ul>

            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200/50 my-6">
              <p className="font-ui text-sm text-orange-800 mb-0">
                <strong>Note:</strong> If you're the only admin of a community, you should
                assign another admin before leaving, or the community will become unmoderated.
              </p>
            </div>
          </section>
        </article>
      </div>

      <style jsx global>{`
        .help-content h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          font-weight: 500;
          color: var(--ink);
          margin-bottom: 1rem;
        }
        .help-content h3 {
          font-family: var(--font-ui);
          font-size: 1rem;
          font-weight: 600;
          color: var(--ink);
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .help-content p {
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.75;
          color: #4a4a4a;
          margin-bottom: 1rem;
        }
        .help-content ul, .help-content ol {
          margin: 1rem 0;
          padding-left: 1.5rem;
        }
        .help-content li {
          font-family: var(--font-body);
          font-size: 0.95rem;
          line-height: 1.7;
          color: #4a4a4a;
          margin-bottom: 0.5rem;
        }
        .help-content li ul, .help-content li ol {
          margin: 0.5rem 0;
        }
        .help-content ol { list-style: decimal; }
        .help-content ul { list-style: disc; }
        .help-content strong { font-weight: 600; color: var(--ink); }
      `}</style>
    </div>
  );
}
