"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShield, faBan, faFlag, faEyeSlash, faUserSlash } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "overview", label: "Safety Overview" },
  { id: "blocking", label: "Blocking Users" },
  { id: "reporting", label: "Reporting Content" },
  { id: "content-warnings", label: "Content Warnings" },
  { id: "privacy-settings", label: "Privacy Settings" },
  { id: "account-security", label: "Account Security" },
  { id: "community-guidelines", label: "Community Guidelines" },
];

export default function PrivacySafetyHelpPage() {
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
            <FontAwesomeIcon icon={faShield} className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-ink">Privacy & Safety</h1>
            <p className="font-body text-muted">Stay safe and control your experience</p>
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
            <h2>Safety Overview</h2>
            <p>
              PinkQuill is committed to being a safe space for creators. We provide tools
              to help you control your experience and protect yourself from unwanted
              interactions.
            </p>

            <h3>Your safety tools</h3>
            <ul>
              <li><strong>Block</strong> — Prevent specific users from interacting with you</li>
              <li><strong>Report</strong> — Flag content or users that violate guidelines</li>
              <li><strong>Content warnings</strong> — Filter sensitive content</li>
              <li><strong>Privacy settings</strong> — Control who sees your content</li>
            </ul>

            <div className="bg-purple-primary/5 rounded-xl p-4 border border-purple-primary/10 my-6">
              <p className="font-ui text-sm text-ink mb-0">
                <strong>Need help?</strong> If you're experiencing harassment or feel unsafe,
                contact us immediately at <a href="mailto:safety@pinkquill.com" className="text-purple-primary hover:underline">safety@pinkquill.com</a>.
              </p>
            </div>
          </section>

          <section id="blocking" className="scroll-mt-24 mb-16">
            <h2>Blocking Users</h2>
            <p>
              Blocking is the most effective way to stop unwanted interactions. When you
              block someone, they can no longer see your content or contact you.
            </p>

            <h3>How to block someone</h3>
            <p>You can block a user from multiple places:</p>

            <p><strong>From their profile:</strong></p>
            <ol>
              <li>Visit their Studio (profile)</li>
              <li>Click the three-dot menu (⋯)</li>
              <li>Select "Block"</li>
              <li>Confirm</li>
            </ol>

            <p><strong>From a post:</strong></p>
            <ol>
              <li>Click the three-dot menu (⋯) on their post</li>
              <li>Select "Block"</li>
              <li>Confirm</li>
            </ol>

            <p><strong>From messages:</strong></p>
            <ol>
              <li>Open the conversation</li>
              <li>Click the info button (ⓘ)</li>
              <li>Select "Block"</li>
              <li>Confirm</li>
            </ol>

            <h3>What happens when you block someone</h3>
            <ul>
              <li>They can't see your profile — it shows "User not found"</li>
              <li>Your posts disappear from their feed</li>
              <li>Their posts disappear from your feed</li>
              <li>They can't follow you (existing follows are removed)</li>
              <li>Messages are silently blocked (they can send, but you won't receive)</li>
              <li>They aren't notified that they've been blocked</li>
            </ul>

            <h3>Viewing and managing blocks</h3>
            <ol>
              <li>Go to <Link href="/settings/privacy" className="text-purple-primary hover:underline">Settings → Privacy</Link></li>
              <li>See your list of blocked users</li>
              <li>Click "Unblock" next to any user to remove the block</li>
            </ol>

            <h3>Unblocking someone</h3>
            <p>
              When you unblock someone:
            </p>
            <ul>
              <li>They can see your profile again</li>
              <li>They can follow you (they won't automatically re-follow)</li>
              <li>You'll need to follow them again if you want to</li>
            </ul>
          </section>

          <section id="reporting" className="scroll-mt-24 mb-16">
            <h2>Reporting Content</h2>
            <p>
              If you see content that violates our Community Guidelines, please report it.
              Reports help us keep PinkQuill safe for everyone.
            </p>

            <h3>What you can report</h3>
            <ul>
              <li><strong>Posts</strong> — Individual pieces of content</li>
              <li><strong>Users</strong> — Entire accounts</li>
              <li><strong>Comments</strong> — Individual comments</li>
              <li><strong>Messages</strong> — Direct message content</li>
            </ul>

            <h3>How to report</h3>
            <ol>
              <li>Click the three-dot menu (⋯) on the content or profile</li>
              <li>Select "Report"</li>
              <li>Choose a reason:
                <ul>
                  <li>Spam</li>
                  <li>Harassment</li>
                  <li>Impersonation</li>
                  <li>Inappropriate content</li>
                  <li>Other</li>
                </ul>
              </li>
              <li>Add details if needed</li>
              <li>Submit the report</li>
            </ol>

            <h3>What happens after you report</h3>
            <ul>
              <li>Our team reviews all reports</li>
              <li>We may remove content that violates guidelines</li>
              <li>Repeat offenders may be suspended or banned</li>
              <li>We don't tell the reported person who reported them</li>
            </ul>

            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200/50 my-6">
              <p className="font-ui text-sm text-orange-800 mb-0">
                <strong>Note:</strong> Reporting doesn't automatically block the user.
                If you don't want to see their content, block them separately.
              </p>
            </div>
          </section>

          <section id="content-warnings" className="scroll-mt-24 mb-16">
            <h2>Content Warnings</h2>
            <p>
              Content warnings help you avoid content you'd rather not see, while still
              allowing creators to share sensitive topics.
            </p>

            <h3>How content warnings work</h3>
            <ul>
              <li>Posts with warnings are hidden behind a warning message</li>
              <li>You see the warning type before revealing the content</li>
              <li>Click to reveal if you choose to view it</li>
            </ul>

            <h3>Warning categories</h3>
            <ul>
              <li><strong>Sensitive content</strong> — Generally sensitive topics</li>
              <li><strong>Mature themes</strong> — Adult themes or discussions</li>
              <li><strong>Violence</strong> — Descriptions of violence</li>
              <li><strong>Mental health</strong> — Topics about mental health struggles</li>
              <li><strong>Strong language</strong> — Explicit language</li>
            </ul>

            <h3>Adding warnings to your posts</h3>
            <p>
              When creating content that might need a warning, use the content warning
              option in the post creator. See{" "}
              <Link href="/help/posting#content-warnings" className="text-purple-primary hover:underline">
                Creating & Sharing
              </Link> for details.
            </p>
          </section>

          <section id="privacy-settings" className="scroll-mt-24 mb-16">
            <h2>Privacy Settings</h2>
            <p>
              Control who sees your content and how your account appears to others.
            </p>

            <h3>Post visibility</h3>
            <p>Each post can be set to:</p>
            <ul>
              <li><strong>Public</strong> — Visible to everyone</li>
              <li><strong>Private</strong> — Only visible to you</li>
            </ul>

            <h3>Profile visibility</h3>
            <p>
              Your profile is public by default. Others can see your display name, bio,
              and public posts. To hide from specific users, block them.
            </p>

            <h3>Saved posts</h3>
            <p>
              Your saved posts are always private. Only you can see your saved collection.
            </p>

            <h3>Search visibility</h3>
            <p>
              Public profiles and posts may appear in search results, both on PinkQuill and
              external search engines.
            </p>
          </section>

          <section id="account-security" className="scroll-mt-24 mb-16">
            <h2>Account Security</h2>
            <p>Keep your account safe with these practices:</p>

            <h3>Strong password</h3>
            <ul>
              <li>Use at least 6 characters (longer is better)</li>
              <li>Mix letters, numbers, and symbols</li>
              <li>Don't reuse passwords from other sites</li>
              <li>Change your password if you suspect it's compromised</li>
            </ul>

            <h3>Secure your email</h3>
            <p>
              Your email is used for password resets. Keep your email account secure
              with a strong password and two-factor authentication.
            </p>

            <h3>Watch for phishing</h3>
            <ul>
              <li>We'll never ask for your password via email or DM</li>
              <li>Check URLs carefully before entering credentials</li>
              <li>Report suspicious messages claiming to be from PinkQuill</li>
            </ul>

            <h3>Logging out</h3>
            <p>
              Always log out when using shared or public devices. You can log out
              from your profile menu.
            </p>
          </section>

          <section id="community-guidelines" className="scroll-mt-24 mb-16">
            <h2>Community Guidelines</h2>
            <p>
              PinkQuill is a space for creative expression. To keep it positive and safe,
              we have guidelines that all users must follow.
            </p>

            <h3>What's not allowed</h3>
            <ul>
              <li><strong>Harassment</strong> — Targeting, bullying, or intimidating others</li>
              <li><strong>Hate speech</strong> — Content that attacks people based on identity</li>
              <li><strong>Spam</strong> — Repetitive, unwanted, or misleading content</li>
              <li><strong>Impersonation</strong> — Pretending to be someone else</li>
              <li><strong>Illegal content</strong> — Content that violates laws</li>
              <li><strong>Privacy violations</strong> — Sharing others' private information</li>
            </ul>

            <h3>Consequences</h3>
            <ul>
              <li>Content removal</li>
              <li>Warning</li>
              <li>Temporary suspension</li>
              <li>Permanent ban</li>
            </ul>

            <p>
              For full details, read our{" "}
              <Link href="/terms" className="text-purple-primary hover:underline">
                Terms of Service
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
        .help-content li ul {
          margin: 0.5rem 0;
        }
        .help-content ol { list-style: decimal; }
        .help-content ul { list-style: disc; }
        .help-content strong { font-weight: 600; color: var(--ink); }
      `}</style>
    </div>
  );
}
