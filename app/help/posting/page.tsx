"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenNib, faImage, faVideo, faFont, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

const tocItems = [
  { id: "creating-a-post", label: "Creating a Post" },
  { id: "post-types", label: "Post Types" },
  { id: "adding-media", label: "Adding Media" },
  { id: "fonts-formatting", label: "Fonts & Formatting" },
  { id: "content-warnings", label: "Content Warnings" },
  { id: "visibility", label: "Visibility Settings" },
  { id: "editing-deleting", label: "Editing & Deleting" },
  { id: "takes", label: "Takes (Short Videos)" },
];

export default function PostingHelpPage() {
  const [activeSection, setActiveSection] = useState("creating-a-post");

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

  const postTypes = [
    { name: "Thought", description: "Short reflections and manifestos", label: "shared a thought" },
    { name: "Poem", description: "Poetry with centered, italic styling", label: "wrote a poem" },
    { name: "Journal", description: "Personal diary-style entries", label: "wrote in their journal" },
    { name: "Essay", description: "Long-form analytical writing", label: "wrote an essay" },
    { name: "Story", description: "Fiction and narrative pieces", label: "shared a story" },
    { name: "Letter", description: "Letter-format writing", label: "wrote a letter" },
    { name: "Screenplay", description: "Script and dialogue format", label: "wrote a screenplay" },
    { name: "Quote", description: "Quotations with attribution", label: "shared a quote" },
    { name: "Visual", description: "Image-focused posts", label: "shared a visual story" },
    { name: "Audio", description: "Voice notes and audio content", label: "recorded a voice note" },
    { name: "Video", description: "Video content", label: "shared a video" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center">
            <FontAwesomeIcon icon={faPenNib} className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-3xl text-ink">Creating & Sharing</h1>
            <p className="font-body text-muted">Express yourself with posts and takes</p>
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
          <section id="creating-a-post" className="scroll-mt-24 mb-16">
            <h2>Creating a Post</h2>
            <p>
              Sharing your creative work on PinkQuill is simple. Here's how to create your first post:
            </p>
            <ol>
              <li>
                <strong>Open the creator</strong> — Click "Create" in the left sidebar or press the
                + button
              </li>
              <li>
                <strong>Choose a post type</strong> — Select the format that best fits your content
              </li>
              <li>
                <strong>Add a title</strong> — Optional for most types, but helps readers find your work
              </li>
              <li>
                <strong>Write your content</strong> — Express yourself in the main content area
              </li>
              <li>
                <strong>Add media</strong> — Attach images or videos if desired
              </li>
              <li>
                <strong>Set visibility</strong> — Choose who can see your post
              </li>
              <li>
                <strong>Publish</strong> — Click "Post" to share with the world
              </li>
            </ol>
            <div className="bg-purple-primary/5 rounded-xl p-4 border border-purple-primary/10 my-6">
              <p className="font-ui text-sm text-ink mb-0">
                <strong>Tip:</strong> You can save drafts by navigating away — your content is
                preserved until you publish or clear it.
              </p>
            </div>
          </section>

          <section id="post-types" className="scroll-mt-24 mb-16">
            <h2>Post Types</h2>
            <p>
              PinkQuill offers 11 unique post types, each designed for different creative expressions.
              The post type affects how your content is displayed and labeled.
            </p>

            <div className="space-y-3 my-6">
              {postTypes.map((type) => (
                <div key={type.name} className="p-4 bg-white rounded-xl border border-black/5">
                  <div className="flex items-baseline gap-2 mb-1">
                    <h4 className="font-ui font-semibold text-ink">{type.name}</h4>
                    <span className="text-xs text-muted italic">"{type.label}"</span>
                  </div>
                  <p className="font-body text-sm text-muted mb-0">{type.description}</p>
                </div>
              ))}
            </div>

            <h3>Choosing the right type</h3>
            <ul>
              <li><strong>Short form:</strong> Use "Thought" for brief reflections or manifestos</li>
              <li><strong>Poetry:</strong> Use "Poem" — content is centered and italicized</li>
              <li><strong>Personal:</strong> Use "Journal" for diary-style entries</li>
              <li><strong>Long form:</strong> Use "Essay" or "Story" for in-depth pieces</li>
              <li><strong>Visual-first:</strong> Use "Visual" when images are the focus</li>
            </ul>
          </section>

          <section id="adding-media" className="scroll-mt-24 mb-16">
            <h2>Adding Media</h2>
            <p>Enhance your posts with images and videos:</p>

            <h3>Images</h3>
            <ul>
              <li><strong>Formats:</strong> JPG, PNG, GIF, WebP</li>
              <li><strong>Multiple images:</strong> Add several images to create a gallery</li>
              <li><strong>Captions:</strong> Add captions to each image</li>
              <li><strong>Order:</strong> Drag to reorder images in your gallery</li>
            </ul>

            <h3>Videos</h3>
            <ul>
              <li><strong>Formats:</strong> MP4, WebM, MOV</li>
              <li><strong>Duration:</strong> No strict limit for post videos</li>
              <li><strong>Playback:</strong> Videos auto-play muted in the feed</li>
            </ul>

            <h3>Tips for media</h3>
            <ul>
              <li>Use high-quality images for best display</li>
              <li>Keep file sizes reasonable for faster loading</li>
              <li>Add alt text for accessibility when possible</li>
            </ul>
          </section>

          <section id="fonts-formatting" className="scroll-mt-24 mb-16">
            <h2>Fonts & Formatting</h2>
            <p>
              Customize how your text appears with different font options:
            </p>

            <h3>Available fonts</h3>
            <ul>
              <li><strong>Default</strong> — Crimson Pro, a classic serif</li>
              <li><strong>Serif</strong> — Traditional book-style text</li>
              <li><strong>Display</strong> — Libre Baskerville for elegant headers</li>
              <li><strong>Monospace</strong> — Fixed-width for code or typewriter style</li>
              <li><strong>Handwriting</strong> — Casual, personal feel</li>
            </ul>

            <h3>Text formatting</h3>
            <p>
              The content editor supports rich text formatting including:
            </p>
            <ul>
              <li><strong>Bold</strong> and <em>italic</em> text</li>
              <li>Links</li>
              <li>Line breaks and paragraphs</li>
            </ul>
          </section>

          <section id="content-warnings" className="scroll-mt-24 mb-16">
            <h2>Content Warnings</h2>
            <p>
              If your content contains sensitive material, add a content warning to let readers
              know before they view it.
            </p>

            <h3>When to use content warnings</h3>
            <ul>
              <li><strong>Sensitive content</strong> — Topics that may be triggering</li>
              <li><strong>Mature themes</strong> — Adult themes or discussions</li>
              <li><strong>Violence</strong> — Descriptions of violence or conflict</li>
              <li><strong>Mental health</strong> — Topics about mental health struggles</li>
              <li><strong>Strong language</strong> — Explicit language</li>
            </ul>

            <h3>How content warnings work</h3>
            <p>
              Posts with content warnings are initially hidden behind a warning message.
              Readers must click to reveal the content. This respects their choice about
              what they want to see.
            </p>

            <h3>Adding a content warning</h3>
            <ol>
              <li>While creating your post, click the content warning option</li>
              <li>Select a preset warning or write a custom one</li>
              <li>Your post will display the warning before the content</li>
            </ol>
          </section>

          <section id="visibility" className="scroll-mt-24 mb-16">
            <h2>Visibility Settings</h2>
            <p>Control who can see your posts:</p>

            <h3>Public</h3>
            <p>
              Anyone can see your post. It will appear in feeds, search results, and on your
              profile. This is the default setting for sharing your creative work widely.
            </p>

            <h3>Private</h3>
            <p>
              Only you can see the post. Use this for drafts or personal content you don't
              want to share.
            </p>

            <h3>Community posts</h3>
            <p>
              When posting to a community, your post follows the community's visibility settings.
              Public communities show posts to everyone; private communities only show to members.
            </p>
          </section>

          <section id="editing-deleting" className="scroll-mt-24 mb-16">
            <h2>Editing & Deleting</h2>

            <h3>Editing posts</h3>
            <p>
              To edit a post you've published:
            </p>
            <ol>
              <li>Go to your post</li>
              <li>Click the three-dot menu (⋯)</li>
              <li>Select "Edit"</li>
              <li>Make your changes</li>
              <li>Save</li>
            </ol>
            <p>
              Note: Edited posts may show an "edited" indicator so readers know the content
              was changed.
            </p>

            <h3>Deleting posts</h3>
            <ol>
              <li>Go to your post</li>
              <li>Click the three-dot menu (⋯)</li>
              <li>Select "Delete"</li>
              <li>Confirm deletion</li>
            </ol>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200/50 my-6">
              <p className="font-ui text-sm text-red-800 mb-0">
                <strong>Warning:</strong> Deleted posts cannot be recovered. All comments and
                reactions on the post will also be removed.
              </p>
            </div>
          </section>

          <section id="takes" className="scroll-mt-24 mb-16">
            <h2>Takes (Short Videos)</h2>
            <p>
              Takes are short-form video content, similar to TikTok or Reels. They're a great
              way to share quick creative moments.
            </p>

            <h3>Creating a take</h3>
            <ol>
              <li>Go to Takes in the sidebar</li>
              <li>Click "Create Take"</li>
              <li>Upload a video (max 90 seconds, 100MB)</li>
              <li>Add a caption with hashtags</li>
              <li>Add content warning if needed</li>
              <li>Optionally post to a community</li>
              <li>Publish</li>
            </ol>

            <h3>Video requirements</h3>
            <ul>
              <li><strong>Duration:</strong> Maximum 90 seconds</li>
              <li><strong>File size:</strong> Maximum 100MB</li>
              <li><strong>Format:</strong> MP4, WebM, or MOV</li>
              <li><strong>Orientation:</strong> Vertical works best</li>
            </ul>

            <h3>Hashtags</h3>
            <p>
              Add hashtags to your caption (e.g., #poetry #nature) to help people discover
              your take. Hashtags are automatically detected and become searchable tags.
            </p>

            <h3>Interacting with takes</h3>
            <p>
              Takes support the same interactions as posts: admire, reactions, comments,
              saves, and relays. Double-tap to quickly admire a take.
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
        .help-content em { font-style: italic; }
      `}</style>
    </div>
  );
}
