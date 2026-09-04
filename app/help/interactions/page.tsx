"use client";

import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeart } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "overview", label: "Interactions Overview" },
  { id: "following", label: "Following & Followers" },
  { id: "reactions", label: "Reactions" },
  { id: "comments", label: "Comments & Replies" },
  { id: "relays", label: "Relays (Reposts)" },
  { id: "saves", label: "Saves (Bookmarks)" },
  { id: "notifications", label: "Interaction Notifications" },
];

export default function InteractionsHelpPage() {
  const [activeSection, setActiveSection] = useState("overview");

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

  const reactionTypes = [
    { name: "Admire", emoji: "❤️", description: "Classic appreciation — like a heart" },
    { name: "Snap", emoji: "🎵", description: "Like snapping your fingers in appreciation" },
    { name: "Ovation", emoji: "👏", description: "Applause for outstanding work" },
    { name: "Support", emoji: "🤝", description: "Showing solidarity and encouragement" },
    { name: "Inspired", emoji: "✨", description: "The work sparked something in you" },
    { name: "Applaud", emoji: "🎭", description: "Standing ovation-level appreciation" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
            <FontAwesomeIcon icon={faHeart} className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-ink">Interactions</h1>
            <p className="font-body text-muted">Engage with the creative community</p>
          </div>
        </div>
      </header>

      <div className="flex gap-12">
        {/* Sidebar TOC */}
        <aside className="hidden xl:block w-48 flex-shrink-0">
          <nav className="sticky top-24">
            <p className="font-ui text-xs text-muted/60 mb-4">
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
          <section id="overview" className="scroll-mt-24 mb-16">
            <h2>Interactions Overview</h2>
            <p>
              PinkQuill offers multiple ways to engage with content and connect with creators.
              These interactions help build community and show appreciation for great work.
            </p>

            <h3>Ways to interact</h3>
            <ul>
              <li><strong>Follow</strong> — Subscribe to a creator&apos;s content</li>
              <li><strong>React</strong> — Show appreciation with different reaction types</li>
              <li><strong>Comment</strong> — Join the discussion</li>
              <li><strong>Relay</strong> — Share content with your followers</li>
              <li><strong>Save</strong> — Bookmark for later</li>
            </ul>
          </section>

          <section id="following" className="scroll-mt-24 mb-16">
            <h2>Following & Followers</h2>

            <h3>Following someone</h3>
            <p>
              When you follow someone, their posts appear in your home feed. To follow:
            </p>
            <ol>
              <li>Visit their profile (Studio)</li>
              <li>Click the &quot;Follow&quot; button</li>
              <li>You&apos;ll now see their posts in your feed</li>
            </ol>

            <h3>Unfollowing</h3>
            <ol>
              <li>Visit their profile</li>
              <li>Click the &quot;Following&quot; button</li>
              <li>This will unfollow them</li>
            </ol>

            <h3>Viewing followers</h3>
            <p>On any profile, you can see:</p>
            <ul>
              <li><strong>Followers</strong> — People who follow this creator</li>
              <li><strong>Following</strong> — People this creator follows</li>
            </ul>
            <p>Click on either count to see the full list.</p>

            <h3>Your followers</h3>
            <p>
              To see who follows you, go to your profile and click on your follower count.
              You can view each follower&apos;s profile and choose to follow them back.
            </p>
          </section>

          <section id="reactions" className="scroll-mt-24 mb-16">
            <h2>Reactions</h2>
            <p>
              Unlike simple &quot;likes,&quot; PinkQuill offers multiple reaction types to express
              different kinds of appreciation:
            </p>

            <div className="space-y-3 my-6">
              {reactionTypes.map((reaction) => (
                <div key={reaction.name} className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-border-light">
                  <span className="text-2xl">{reaction.emoji}</span>
                  <div>
                    <h4 className="font-ui font-semibold text-ink">{reaction.name}</h4>
                    <p className="font-body text-sm text-muted mb-0">{reaction.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <h3>How to react</h3>
            <ol>
              <li>Click the heart icon on any post</li>
              <li>To use a different reaction, long-press or right-click the heart</li>
              <li>Select your reaction from the picker</li>
            </ol>

            <h3>Quick admire</h3>
            <p>
              For takes (short videos), you can double-tap anywhere on the video to
              quickly admire it. A heart animation will confirm your reaction.
            </p>

            <h3>Changing reactions</h3>
            <p>
              You can change your reaction by selecting a different one, or remove it
              entirely by clicking the heart again.
            </p>
          </section>

          <section id="comments" className="scroll-mt-24 mb-16">
            <h2>Comments & Replies</h2>

            <h3>Adding a comment</h3>
            <ol>
              <li>Click the comment icon on a post</li>
              <li>This opens the post detail view with comments</li>
              <li>Type your comment in the text field</li>
              <li>Click send or press Enter</li>
            </ol>

            <h3>Replying to comments</h3>
            <p>
              Comments support nested replies. Click &quot;Reply&quot; on any comment to respond
              directly to it. Replies are indented under the parent comment.
            </p>

            <h3>Liking comments</h3>
            <p>
              Click the heart icon next to any comment to like it. This shows appreciation
              for thoughtful responses.
            </p>

            <h3>Deleting comments</h3>
            <p>To delete your own comment:</p>
            <ol>
              <li>Find your comment</li>
              <li>Click the menu (⋯) on your comment</li>
              <li>Select &quot;Delete&quot;</li>
            </ol>
            <p>
              Post authors can also delete any comments on their posts.
            </p>

            <h3>Comment etiquette</h3>
            <ul>
              <li>Be respectful and constructive</li>
              <li>Offer genuine feedback when appropriate</li>
              <li>Avoid spam or self-promotion</li>
              <li>Report inappropriate comments</li>
            </ul>
          </section>

          <section id="relays" className="scroll-mt-24 mb-16">
            <h2>Relays (Reposts)</h2>
            <p>
              Relaying (also known as reposting) shares someone else&apos;s content with your
              followers. It&apos;s a way to amplify work you appreciate.
            </p>

            <h3>How to relay</h3>
            <ol>
              <li>Click the relay icon (↻) on a post</li>
              <li>The post is now shared to your profile</li>
              <li>Your followers will see it in their feeds</li>
            </ol>

            <h3>Viewing relays</h3>
            <p>
              Relayed posts appear on your profile in a separate &quot;Relays&quot; tab. They show
              the original author&apos;s information so credit is maintained.
            </p>

            <h3>Undoing a relay</h3>
            <p>
              Click the relay icon again on a post you&apos;ve relayed to un-relay it.
              It will be removed from your relays.
            </p>
          </section>

          <section id="saves" className="scroll-mt-24 mb-16">
            <h2>Saves (Bookmarks)</h2>
            <p>
              Save posts you want to revisit later. Saved posts are private — only you
              can see what you&apos;ve saved.
            </p>

            <h3>Saving a post</h3>
            <p>Click the bookmark icon on any post to save it.</p>

            <h3>Viewing saved posts</h3>
            <ol>
              <li>Click &quot;Saved&quot; in the left sidebar</li>
              <li>Browse all your bookmarked posts</li>
            </ol>

            <h3>Removing saves</h3>
            <p>
              Click the bookmark icon again on a saved post to unsave it. It will be
              removed from your saved collection.
            </p>

            <div className="bg-purple-primary/5 rounded-xl p-4 border border-purple-primary/10 my-6">
              <p className="font-ui text-sm text-ink mb-0">
                <strong>Privacy:</strong> Your saved posts are completely private. Authors
                are notified when you save their post, but they can&apos;t see your full saved list.
              </p>
            </div>
          </section>

          <section id="notifications" className="scroll-mt-24 mb-16">
            <h2>Interaction Notifications</h2>
            <p>
              When people interact with your content, you&apos;ll receive notifications:
            </p>

            <h3>Notification types</h3>
            <ul>
              <li><strong>Admire</strong> — Someone reacted to your post</li>
              <li><strong>Comment</strong> — Someone commented on your post</li>
              <li><strong>Reply</strong> — Someone replied to your comment</li>
              <li><strong>Comment like</strong> — Someone liked your comment</li>
              <li><strong>Relay</strong> — Someone relayed your post</li>
              <li><strong>Save</strong> — Someone saved your post</li>
              <li><strong>Follow</strong> — Someone followed you</li>
            </ul>

            <h3>Viewing notifications</h3>
            <p>
              Click the bell icon in the left sidebar to open your notification panel.
              Unread notifications are highlighted.
            </p>

            <h3>Managing notifications</h3>
            <ul>
              <li>Click a notification to go to the relevant content</li>
              <li>Notifications are automatically marked as read when viewed</li>
              <li>Use &quot;Mark all as read&quot; to clear all unread notifications</li>
            </ul>
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
        .help-content h4 {
          font-family: var(--font-ui);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--ink);
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
        .help-content ol { list-style: decimal; }
        .help-content ul { list-style: disc; }
        .help-content strong { font-weight: 600; color: var(--ink); }
      `}</style>
    </div>
  );
}
