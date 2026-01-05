"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faRocket,
  faUserPlus,
  faCompass,
  faPenNib,
  faUsers,
  faHeart,
  faBell,
  faCheckCircle
} from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "welcome", label: "Welcome to PinkQuill" },
  { id: "creating-account", label: "Creating Your Account" },
  { id: "setting-up-profile", label: "Setting Up Your Profile" },
  { id: "navigating", label: "Navigating PinkQuill" },
  { id: "first-post", label: "Your First Post" },
  { id: "finding-creators", label: "Finding Creators" },
  { id: "joining-communities", label: "Joining Communities" },
  { id: "next-steps", label: "Next Steps" },
];

export default function GettingStartedPage() {
  const [activeSection, setActiveSection] = useState("welcome");

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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <FontAwesomeIcon icon={faRocket} className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-ink">Getting Started</h1>
            <p className="font-body text-muted">Everything you need to begin your PinkQuill journey</p>
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
          <section id="welcome" className="scroll-mt-24 mb-16">
            <h2>Welcome to PinkQuill</h2>
            <p>
              PinkQuill is a creative social platform designed for artists, poets, writers, and creators of all kinds.
              It's a space where you can share your work, connect with like-minded creators, and build a community
              around your art.
            </p>
            <p>
              Whether you're a seasoned writer or just starting out, PinkQuill provides the tools and community
              you need to express yourself and grow as a creator.
            </p>
            <div className="bg-purple-primary/5 rounded-xl p-6 border border-purple-primary/10 my-6">
              <h4 className="font-ui text-sm font-semibold text-ink mb-3">What makes PinkQuill special?</h4>
              <ul>
                <li><strong>11 post types</strong> tailored for different creative expressions</li>
                <li><strong>Communities</strong> to find your tribe and collaborate</li>
                <li><strong>Takes</strong> for short-form video content</li>
                <li><strong>Rich reactions</strong> beyond just likes</li>
                <li><strong>Insights</strong> to understand your audience</li>
              </ul>
            </div>
          </section>

          <section id="creating-account" className="scroll-mt-24 mb-16">
            <h2>Creating Your Account</h2>
            <p>Getting started on PinkQuill takes just a minute:</p>
            <ol>
              <li>
                <strong>Visit the signup page</strong> — Go to <Link href="/login" className="text-purple-primary hover:underline">pinkquill.app/login</Link>
              </li>
              <li>
                <strong>Enter your email</strong> — Use an email you have access to for verification
              </li>
              <li>
                <strong>Create a password</strong> — Choose a strong, unique password (at least 6 characters)
              </li>
              <li>
                <strong>Choose your username</strong> — This is your unique identifier on PinkQuill (e.g., @yourname)
              </li>
              <li>
                <strong>Verify your email</strong> — Check your inbox and click the verification link
              </li>
            </ol>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200/50 my-6">
              <p className="font-ui text-sm text-orange-800 mb-0">
                <strong>Tip:</strong> Choose a username that represents you as a creator. It can't be changed easily later.
              </p>
            </div>
          </section>

          <section id="setting-up-profile" className="scroll-mt-24 mb-16">
            <h2>Setting Up Your Profile</h2>
            <p>
              Your profile is your creative identity on PinkQuill. Take time to make it reflect who you are:
            </p>
            <h3>Profile basics</h3>
            <ul>
              <li><strong>Display name</strong> — Your name as shown to others (can include spaces and special characters)</li>
              <li><strong>Avatar</strong> — Upload a photo or image that represents you</li>
              <li><strong>Cover image</strong> — A banner image at the top of your profile</li>
              <li><strong>Bio</strong> — Tell others about yourself and your creative work</li>
              <li><strong>Tagline</strong> — A short phrase that captures your essence</li>
            </ul>
            <h3>Additional details</h3>
            <ul>
              <li><strong>Role/Occupation</strong> — What you do (e.g., "Poet", "Visual Artist")</li>
              <li><strong>Location</strong> — Where you're based</li>
              <li><strong>Website</strong> — Link to your personal site or portfolio</li>
              <li><strong>Social links</strong> — Connect your other platforms (Instagram, Twitter, etc.)</li>
            </ul>
            <p>
              To edit your profile, go to <Link href="/settings/profile" className="text-purple-primary hover:underline">Settings → Edit Profile</Link>.
            </p>
          </section>

          <section id="navigating" className="scroll-mt-24 mb-16">
            <h2>Navigating PinkQuill</h2>
            <p>The PinkQuill interface is designed to be intuitive. Here's a quick tour:</p>

            <h3>Left sidebar</h3>
            <ul>
              <li><strong>Home</strong> — Your main feed with posts from people you follow</li>
              <li><strong>Explore</strong> — Discover new content and creators</li>
              <li><strong>Takes</strong> — Short-form video content</li>
              <li><strong>Communities</strong> — Browse and join creative communities</li>
              <li><strong>Messages</strong> — Direct conversations with other users</li>
              <li><strong>Saved</strong> — Posts you've bookmarked</li>
              <li><strong>Create</strong> — Start a new post</li>
              <li><strong>Notifications</strong> — See who's interacting with your content</li>
            </ul>

            <h3>Main feed</h3>
            <p>
              Your home feed shows posts from creators you follow. Each post displays the author,
              post type, content, and interaction buttons (admire, comment, relay, save).
            </p>

            <h3>Right sidebar</h3>
            <p>
              Depending on the page, you'll see trending topics, suggested creators to follow,
              or community information.
            </p>
          </section>

          <section id="first-post" className="scroll-mt-24 mb-16">
            <h2>Your First Post</h2>
            <p>Ready to share your first piece of content? Here's how:</p>
            <ol>
              <li>Click <strong>Create</strong> in the left sidebar</li>
              <li>Choose your <strong>post type</strong> (poem, journal, thought, etc.)</li>
              <li>Add a <strong>title</strong> (optional for most types)</li>
              <li>Write your <strong>content</strong></li>
              <li>Upload any <strong>media</strong> if desired (images, video)</li>
              <li>Set <strong>visibility</strong> (public or private)</li>
              <li>Click <strong>Post</strong> to publish!</li>
            </ol>
            <p>
              See <Link href="/help/posting" className="text-purple-primary hover:underline">Creating & Sharing</Link> for
              detailed information about all post types and options.
            </p>
          </section>

          <section id="finding-creators" className="scroll-mt-24 mb-16">
            <h2>Finding Creators</h2>
            <p>Build your network by finding creators whose work inspires you:</p>
            <ul>
              <li><strong>Explore page</strong> — Browse trending and recommended content</li>
              <li><strong>Search</strong> — Look for creators by username or content</li>
              <li><strong>Communities</strong> — Find creators in communities you join</li>
              <li><strong>Suggestions</strong> — Check the "Who to follow" suggestions</li>
            </ul>
            <p>
              When you find someone interesting, visit their profile (their "Studio") and click
              <strong> Follow</strong> to see their posts in your feed.
            </p>
          </section>

          <section id="joining-communities" className="scroll-mt-24 mb-16">
            <h2>Joining Communities</h2>
            <p>
              Communities are spaces organized around shared interests, genres, or themes.
              They're a great way to connect with like-minded creators.
            </p>
            <ol>
              <li>Go to <strong>Communities</strong> in the sidebar</li>
              <li>Browse or search for communities that interest you</li>
              <li>Click on a community to see its description and content</li>
              <li>Click <strong>Join</strong> to become a member</li>
            </ol>
            <p>
              Once you join, you can post content to the community and participate in discussions.
              See <Link href="/help/communities" className="text-purple-primary hover:underline">Communities</Link> for more details.
            </p>
          </section>

          <section id="next-steps" className="scroll-mt-24 mb-16">
            <h2>Next Steps</h2>
            <p>Now that you're set up, here are some things to try:</p>

            <div className="grid gap-4 my-6">
              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-ui font-medium text-ink mb-1">Complete your profile</p>
                  <p className="font-body text-sm text-muted mb-0">Add a bio, avatar, and social links</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-ui font-medium text-ink mb-1">Follow 5 creators</p>
                  <p className="font-body text-sm text-muted mb-0">Build your feed with inspiring content</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-ui font-medium text-ink mb-1">Join a community</p>
                  <p className="font-body text-sm text-muted mb-0">Find your creative tribe</p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-ui font-medium text-ink mb-1">Share your first post</p>
                  <p className="font-body text-sm text-muted mb-0">Express yourself and start creating</p>
                </div>
              </div>
            </div>

            <p>
              Have questions? Browse the other help topics or{" "}
              <a href="mailto:support@pinkquill.app" className="text-purple-primary hover:underline">contact support</a>.
            </p>
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
        .help-content ol {
          list-style: decimal;
        }
        .help-content ul {
          list-style: disc;
        }
        .help-content strong {
          font-weight: 600;
          color: var(--ink);
        }
        .help-content a {
          color: var(--primary-purple);
        }
        .help-content a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
