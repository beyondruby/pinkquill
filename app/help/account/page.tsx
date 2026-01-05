"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faCamera, faLink, faKey, faTrash } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "profile-overview", label: "Profile Overview" },
  { id: "editing-profile", label: "Editing Your Profile" },
  { id: "avatar-cover", label: "Avatar & Cover Image" },
  { id: "social-links", label: "Social Links" },
  { id: "username", label: "Changing Username" },
  { id: "email-password", label: "Email & Password" },
  { id: "delete-account", label: "Deleting Your Account" },
];

export default function AccountHelpPage() {
  const [activeSection, setActiveSection] = useState("profile-overview");

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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <FontAwesomeIcon icon={faUser} className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-ink">Account & Profile</h1>
            <p className="font-body text-muted">Manage your profile and account settings</p>
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
          <section id="profile-overview" className="scroll-mt-24 mb-16">
            <h2>Profile Overview</h2>
            <p>
              Your profile (called your "Studio" on PinkQuill) is your creative identity. It's where
              others can learn about you, see your work, and decide whether to follow you.
            </p>
            <h3>What's on your profile</h3>
            <ul>
              <li><strong>Header area</strong> — Cover image, avatar, name, username, tagline</li>
              <li><strong>About section</strong> — Bio, role, location, social links</li>
              <li><strong>Stats</strong> — Follower count, following count, post count</li>
              <li><strong>Content tabs</strong> — Your posts, relays, and more</li>
            </ul>
            <p>
              To view your profile, click on your avatar in the sidebar or go to{" "}
              <code>pinkquill.app/studio/yourusername</code>.
            </p>
          </section>

          <section id="editing-profile" className="scroll-mt-24 mb-16">
            <h2>Editing Your Profile</h2>
            <p>
              To edit your profile, go to <Link href="/settings/profile" className="text-purple-primary hover:underline">Settings → Edit Profile</Link>.
            </p>
            <h3>Profile fields</h3>
            <ul>
              <li>
                <strong>Display name</strong> — Your name as shown to others. Can include spaces,
                emojis, and special characters. This is different from your username.
              </li>
              <li>
                <strong>Username</strong> — Your unique identifier (e.g., @yourname). Used in your
                profile URL and for mentions.
              </li>
              <li>
                <strong>Bio</strong> — A longer description about you and your work. Supports
                multiple paragraphs.
              </li>
              <li>
                <strong>Tagline</strong> — A short phrase that appears under your name. Keep it
                brief and memorable.
              </li>
              <li>
                <strong>Role/Occupation</strong> — What you do (e.g., "Poet", "Visual Artist",
                "Writer & Designer").
              </li>
              <li>
                <strong>Education</strong> — Your educational background if you want to share it.
              </li>
              <li>
                <strong>Location</strong> — Where you're based (city, country, or region).
              </li>
              <li>
                <strong>Website</strong> — A link to your personal website or portfolio.
              </li>
            </ul>
          </section>

          <section id="avatar-cover" className="scroll-mt-24 mb-16">
            <h2>Avatar & Cover Image</h2>

            <h3>Avatar</h3>
            <p>
              Your avatar is the profile picture that appears next to your name throughout PinkQuill.
              It's shown on your posts, comments, and in search results.
            </p>
            <ul>
              <li><strong>Recommended size:</strong> 400x400 pixels or larger</li>
              <li><strong>Format:</strong> JPG, PNG, or GIF</li>
              <li><strong>Shape:</strong> Will be displayed as a circle</li>
            </ul>
            <p>To change your avatar:</p>
            <ol>
              <li>Go to Settings → Edit Profile</li>
              <li>Click on your current avatar or the camera icon</li>
              <li>Select an image from your device</li>
              <li>Save your changes</li>
            </ol>

            <h3>Cover image</h3>
            <p>
              The cover image is the banner at the top of your profile page. It's a great way to
              showcase your style or featured work.
            </p>
            <ul>
              <li><strong>Recommended size:</strong> 1500x500 pixels</li>
              <li><strong>Format:</strong> JPG or PNG</li>
              <li><strong>Aspect ratio:</strong> 3:1 works best</li>
            </ul>
          </section>

          <section id="social-links" className="scroll-mt-24 mb-16">
            <h2>Social Links</h2>
            <p>
              Connect your other platforms to your PinkQuill profile so people can find you elsewhere.
              We support 15+ platforms:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 my-6">
              {["Twitter/X", "Instagram", "GitHub", "LinkedIn", "YouTube", "TikTok",
                "Threads", "Facebook", "Behance", "Dribbble", "Spotify", "SoundCloud",
                "Medium", "Substack", "Patreon", "Ko-fi"].map((platform) => (
                <div key={platform} className="px-3 py-2 bg-black/[0.02] rounded-lg font-ui text-sm text-ink">
                  {platform}
                </div>
              ))}
            </div>
            <h3>Adding social links</h3>
            <ol>
              <li>Go to Settings → Edit Profile</li>
              <li>Scroll to the "Social Links" section</li>
              <li>Click "Add link"</li>
              <li>Paste your profile URL — the platform is auto-detected</li>
              <li>Save your changes</li>
            </ol>
            <p>
              Social links appear on your profile with their respective icons, making it easy
              for followers to connect with you across platforms.
            </p>
          </section>

          <section id="username" className="scroll-mt-24 mb-16">
            <h2>Changing Username</h2>
            <p>
              Your username is your unique identifier on PinkQuill. It appears in your profile URL
              and is used when others mention you.
            </p>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200/50 my-6">
              <p className="font-ui text-sm text-orange-800 mb-0">
                <strong>Important:</strong> Changing your username will break any existing links
                to your profile. Old mentions of your username won't redirect to your new one.
              </p>
            </div>
            <h3>Username rules</h3>
            <ul>
              <li>Must be unique — no two users can have the same username</li>
              <li>Can contain letters, numbers, and underscores</li>
              <li>Cannot contain spaces or special characters</li>
              <li>Minimum 3 characters, maximum 30 characters</li>
            </ul>
            <p>
              To change your username, go to Settings → Edit Profile and update the username field.
            </p>
          </section>

          <section id="email-password" className="scroll-mt-24 mb-16">
            <h2>Email & Password</h2>

            <h3>Changing your email</h3>
            <ol>
              <li>Go to <Link href="/settings/account" className="text-purple-primary hover:underline">Settings → Account</Link></li>
              <li>Enter your new email address</li>
              <li>Click "Update email"</li>
              <li>Verify your new email by clicking the link sent to it</li>
            </ol>

            <h3 id="password">Changing your password</h3>
            <ol>
              <li>Go to <Link href="/settings/account" className="text-purple-primary hover:underline">Settings → Account</Link></li>
              <li>Enter your new password</li>
              <li>Confirm your new password</li>
              <li>Click "Update password"</li>
            </ol>
            <p>Password requirements:</p>
            <ul>
              <li>Minimum 6 characters</li>
              <li>We recommend using a mix of letters, numbers, and symbols</li>
              <li>Don't reuse passwords from other sites</li>
            </ul>

            <h3>Forgot your password?</h3>
            <p>
              If you're logged out and can't remember your password, go to the login page and
              click "Forgot password?" to receive a reset link via email.
            </p>
          </section>

          <section id="delete-account" className="scroll-mt-24 mb-16">
            <h2>Deleting Your Account</h2>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200/50 my-6">
              <p className="font-ui text-sm text-red-800 mb-0">
                <strong>Warning:</strong> Deleting your account is permanent and cannot be undone.
                All your posts, comments, and data will be permanently removed.
              </p>
            </div>
            <p>If you decide to delete your account:</p>
            <ol>
              <li>Go to Settings → Account</li>
              <li>Scroll to the "Danger Zone" section</li>
              <li>Click "Delete Account"</li>
              <li>Confirm your decision</li>
            </ol>
            <h3>What happens when you delete</h3>
            <ul>
              <li>Your profile will be immediately removed</li>
              <li>All your posts and comments will be deleted</li>
              <li>Your username will become available for others</li>
              <li>Messages you sent will remain visible to recipients</li>
              <li>This action cannot be reversed</li>
            </ul>
            <p>
              If you just need a break, consider logging out instead of deleting your account.
              Your content will remain, and you can come back anytime.
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
        .help-content code {
          background: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 0.25rem;
          font-size: 0.9em;
        }
      `}</style>
    </div>
  );
}
