"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear, faUser, faLock, faBell, faShield } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "overview", label: "Settings Overview" },
  { id: "profile-settings", label: "Profile Settings" },
  { id: "account-settings", label: "Account Settings" },
  { id: "notification-settings", label: "Notification Settings" },
  { id: "privacy-settings", label: "Privacy Settings" },
];

export default function SettingsHelpPage() {
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
            <FontAwesomeIcon icon={faGear} className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-ink">Settings</h1>
            <p className="font-body text-muted">Customize your PinkQuill experience</p>
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
          <section id="overview" className="scroll-mt-24 mb-16">
            <h2>Settings Overview</h2>
            <p>
              Access your settings by clicking the gear icon or going to the Settings
              page from your profile. Settings are organized into several categories.
            </p>

            <h3>Settings sections</h3>
            <div className="space-y-3 my-6">
              <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faUser} className="w-5 h-5 text-purple-primary" />
                <div>
                  <h4 className="font-ui font-semibold text-ink">Edit Profile</h4>
                  <p className="font-body text-sm text-muted mb-0">Update your profile information</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faLock} className="w-5 h-5 text-purple-primary" />
                <div>
                  <h4 className="font-ui font-semibold text-ink">Account</h4>
                  <p className="font-body text-sm text-muted mb-0">Email, password, and account management</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faBell} className="w-5 h-5 text-purple-primary" />
                <div>
                  <h4 className="font-ui font-semibold text-ink">Notifications</h4>
                  <p className="font-body text-sm text-muted mb-0">Control how you receive notifications</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5">
                <FontAwesomeIcon icon={faShield} className="w-5 h-5 text-purple-primary" />
                <div>
                  <h4 className="font-ui font-semibold text-ink">Privacy</h4>
                  <p className="font-body text-sm text-muted mb-0">Blocked users and privacy controls</p>
                </div>
              </div>
            </div>
          </section>

          <section id="profile-settings" className="scroll-mt-24 mb-16">
            <h2>Profile Settings</h2>
            <p>
              Edit your public profile at{" "}
              <Link href="/settings/profile" className="text-purple-primary hover:underline">
                Settings → Edit Profile
              </Link>.
            </p>

            <h3>Basic information</h3>
            <ul>
              <li><strong>Display name</strong> — How your name appears to others</li>
              <li><strong>Username</strong> — Your unique @handle</li>
              <li><strong>Bio</strong> — Tell others about yourself</li>
              <li><strong>Tagline</strong> — A short phrase under your name</li>
            </ul>

            <h3>Images</h3>
            <ul>
              <li><strong>Avatar</strong> — Your profile picture (displayed as a circle)</li>
              <li><strong>Cover image</strong> — The banner at the top of your profile</li>
            </ul>

            <h3>Details</h3>
            <ul>
              <li><strong>Role/Occupation</strong> — What you do</li>
              <li><strong>Education</strong> — Your educational background</li>
              <li><strong>Location</strong> — Where you're based</li>
              <li><strong>Languages</strong> — Languages you speak</li>
              <li><strong>Website</strong> — Link to your site</li>
            </ul>

            <h3>Social links</h3>
            <p>
              Add links to your other social profiles. PinkQuill automatically detects
              the platform from the URL and shows the appropriate icon.
            </p>
            <p>Supported platforms include:</p>
            <ul>
              <li>Twitter/X, Instagram, Threads, Facebook</li>
              <li>GitHub, LinkedIn</li>
              <li>YouTube, TikTok</li>
              <li>Behance, Dribbble</li>
              <li>Spotify, SoundCloud</li>
              <li>Medium, Substack</li>
              <li>Patreon, Ko-fi</li>
            </ul>
          </section>

          <section id="account-settings" className="scroll-mt-24 mb-16">
            <h2>Account Settings</h2>
            <p>
              Manage your account at{" "}
              <Link href="/settings/account" className="text-purple-primary hover:underline">
                Settings → Account
              </Link>.
            </p>

            <h3>Email address</h3>
            <p>
              Change the email associated with your account. You'll need to verify
              the new email address before the change takes effect.
            </p>
            <ol>
              <li>Enter your new email</li>
              <li>Click "Update email"</li>
              <li>Check your new email for a verification link</li>
              <li>Click the link to confirm</li>
            </ol>

            <h3 id="password">Password</h3>
            <p>Update your password for security:</p>
            <ol>
              <li>Enter your new password</li>
              <li>Confirm by typing it again</li>
              <li>Click "Update password"</li>
            </ol>
            <p>Password requirements:</p>
            <ul>
              <li>Minimum 6 characters</li>
              <li>Use a mix of letters, numbers, and symbols for better security</li>
            </ul>

            <h3>Danger zone</h3>
            <p>
              The danger zone contains irreversible actions:
            </p>
            <ul>
              <li>
                <strong>Delete account</strong> — Permanently remove your account and all
                content. This cannot be undone.
              </li>
            </ul>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200/50 my-6">
              <p className="font-ui text-sm text-red-800 mb-0">
                <strong>Warning:</strong> Account deletion is permanent. Make sure you've
                downloaded any content you want to keep before deleting.
              </p>
            </div>
          </section>

          <section id="notification-settings" className="scroll-mt-24 mb-16">
            <h2>Notification Settings</h2>
            <p>
              Control how and when you receive notifications at Settings → Notifications.
            </p>

            <h3>Notification types</h3>
            <p>You can configure preferences for:</p>
            <ul>
              <li><strong>Reactions</strong> — When someone reacts to your post</li>
              <li><strong>Comments</strong> — When someone comments on your post</li>
              <li><strong>Follows</strong> — When someone follows you</li>
              <li><strong>Relays</strong> — When someone relays your post</li>
              <li><strong>Messages</strong> — When you receive direct messages</li>
              <li><strong>Mentions</strong> — When someone mentions you</li>
            </ul>

            <h3>Delivery methods</h3>
            <ul>
              <li><strong>In-app</strong> — See notifications in the notification panel</li>
              <li><strong>Email</strong> — Receive email notifications (configurable)</li>
            </ul>
          </section>

          <section id="privacy-settings" className="scroll-mt-24 mb-16">
            <h2>Privacy Settings</h2>
            <p>
              Manage your privacy at{" "}
              <Link href="/settings/privacy" className="text-purple-primary hover:underline">
                Settings → Privacy
              </Link>.
            </p>

            <h3>Blocked users</h3>
            <p>
              View and manage your block list. This page shows everyone you've blocked
              and lets you unblock them if you change your mind.
            </p>
            <p>To unblock someone:</p>
            <ol>
              <li>Find them in your blocked list</li>
              <li>Click "Unblock"</li>
              <li>They can now see your profile and interact with you again</li>
            </ol>

            <h3>Who you've blocked</h3>
            <p>Blocked users cannot:</p>
            <ul>
              <li>See your profile</li>
              <li>See your posts in their feed</li>
              <li>Follow you</li>
              <li>Send you messages (messages appear to send but aren't delivered)</li>
            </ul>

            <p>
              For more on blocking, see{" "}
              <Link href="/help/privacy-safety#blocking" className="text-purple-primary hover:underline">
                Privacy & Safety → Blocking
              </Link>.
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
        .help-content ol { list-style: decimal; }
        .help-content ul { list-style: disc; }
        .help-content strong { font-weight: 600; color: var(--ink); }
      `}</style>
    </div>
  );
}
