"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faPaperPlane, faTrash, faShield } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "overview", label: "Messaging Overview" },
  { id: "starting", label: "Starting Conversations" },
  { id: "sending", label: "Sending Messages" },
  { id: "managing", label: "Managing Conversations" },
  { id: "notifications", label: "Message Notifications" },
  { id: "privacy", label: "Privacy & Blocking" },
];

export default function MessagingHelpPage() {
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <FontAwesomeIcon icon={faEnvelope} className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-ink">Messaging</h1>
            <p className="font-body text-muted">Connect privately with other creators</p>
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
            <h2>Messaging Overview</h2>
            <p>
              Direct messages let you have private conversations with other creators on PinkQuill.
              Use messaging to collaborate, give feedback, or simply connect.
            </p>

            <h3>Accessing messages</h3>
            <p>
              Click "Messages" in the left sidebar to open your messaging inbox. You'll see
              all your conversations listed on the left, with the chat view on the right.
            </p>

            <h3>Message layout</h3>
            <ul>
              <li><strong>Conversation list</strong> — All your chats, sorted by most recent</li>
              <li><strong>Chat view</strong> — The selected conversation's message history</li>
              <li><strong>New message button</strong> — Start a new conversation</li>
              <li><strong>Info button</strong> — Access conversation options</li>
            </ul>
          </section>

          <section id="starting" className="scroll-mt-24 mb-16">
            <h2>Starting Conversations</h2>
            <p>There are several ways to start a new conversation:</p>

            <h3>From the messages page</h3>
            <ol>
              <li>Go to Messages</li>
              <li>Click the "New Message" button (✏️ icon)</li>
              <li>Search for the user you want to message</li>
              <li>Select them to start a conversation</li>
              <li>Type your message and send</li>
            </ol>

            <h3>From a profile</h3>
            <ol>
              <li>Visit the user's profile (Studio)</li>
              <li>Click the "Message" button</li>
              <li>This opens a new conversation with them</li>
            </ol>

            <div className="bg-purple-primary/5 rounded-xl p-4 border border-purple-primary/10 my-6">
              <p className="font-ui text-sm text-ink mb-0">
                <strong>Note:</strong> You can message anyone on PinkQuill, even if you don't
                follow each other. However, users can block others to prevent messages.
              </p>
            </div>
          </section>

          <section id="sending" className="scroll-mt-24 mb-16">
            <h2>Sending Messages</h2>

            <h3>Composing a message</h3>
            <ol>
              <li>Select a conversation or start a new one</li>
              <li>Type your message in the text field at the bottom</li>
              <li>Press Enter or click the send button</li>
            </ol>

            <h3>Message features</h3>
            <ul>
              <li><strong>Text messages</strong> — Share your thoughts in text form</li>
              <li><strong>Links</strong> — Links are automatically clickable</li>
              <li><strong>Emoji</strong> — Express yourself with emoji</li>
            </ul>

            <h3>Read receipts</h3>
            <p>
              Messages show when they've been read by the recipient. You'll see a visual
              indicator when your message has been seen.
            </p>

            <h3>Real-time delivery</h3>
            <p>
              Messages are delivered instantly. New messages appear in real-time without
              needing to refresh the page.
            </p>
          </section>

          <section id="managing" className="scroll-mt-24 mb-16">
            <h2>Managing Conversations</h2>

            <h3>Conversation info</h3>
            <p>
              Click the info button (ⓘ) in the chat header to access conversation options:
            </p>
            <ul>
              <li>View the user's profile</li>
              <li>Block the user</li>
              <li>Report the user</li>
              <li>Delete the conversation</li>
            </ul>

            <h3>Deleting conversations</h3>
            <ol>
              <li>Open the conversation</li>
              <li>Click the info button (ⓘ)</li>
              <li>Select "Delete conversation"</li>
              <li>Confirm deletion</li>
            </ol>
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200/50 my-6">
              <p className="font-ui text-sm text-orange-800 mb-0">
                <strong>Note:</strong> Deleting a conversation removes it from your inbox,
                but the other person will still see their copy of the messages.
              </p>
            </div>

            <h3>Finding conversations</h3>
            <p>
              Your conversations are sorted by most recent activity. Scroll through the
              conversation list or use search to find specific chats.
            </p>
          </section>

          <section id="notifications" className="scroll-mt-24 mb-16">
            <h2>Message Notifications</h2>

            <h3>Unread indicator</h3>
            <p>
              When you have unread messages, you'll see a badge on the Messages icon in
              the sidebar showing the number of unread conversations.
            </p>

            <h3>In-app notifications</h3>
            <p>
              New messages trigger real-time updates. If you're on the messages page,
              new messages appear instantly. Otherwise, the unread count updates.
            </p>

            <h3>Email notifications</h3>
            <p>
              Depending on your notification settings, you may receive email notifications
              for new messages. Manage these in Settings → Notifications.
            </p>
          </section>

          <section id="privacy" className="scroll-mt-24 mb-16">
            <h2>Privacy & Blocking</h2>

            <h3>How blocking affects messages</h3>
            <p>
              PinkQuill uses a silent blocking system, similar to Instagram. When you block
              someone:
            </p>
            <ul>
              <li>They can still send messages, but you won't receive them</li>
              <li>Messages they send appear to go through on their end</li>
              <li>They won't know they've been blocked</li>
              <li>Existing conversation history remains visible to both parties</li>
              <li>Their messages won't count toward your unread badge</li>
            </ul>

            <h3>Blocking from messages</h3>
            <ol>
              <li>Open the conversation</li>
              <li>Click the info button (ⓘ)</li>
              <li>Select "Block"</li>
              <li>Confirm the block</li>
            </ol>

            <h3>Reporting abuse</h3>
            <p>
              If someone is harassing you or sending inappropriate content:
            </p>
            <ol>
              <li>Open the conversation</li>
              <li>Click the info button (ⓘ)</li>
              <li>Select "Report"</li>
              <li>Choose a reason and submit</li>
            </ol>
            <p>
              Reports are reviewed by our team. We take harassment seriously and will
              take appropriate action.
            </p>

            <h3>Message privacy</h3>
            <ul>
              <li>Messages are private between participants</li>
              <li>We don't read your messages except when reviewing reports</li>
              <li>Messages are encrypted in transit</li>
              <li>See our <Link href="/privacy" className="text-purple-primary hover:underline">Privacy Policy</Link> for more details</li>
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
