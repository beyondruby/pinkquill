// One consistent icon set for post types: 24px grid, 1.75 stroke, round caps.
// Monochrome by design — colour is inherited from `currentColor`.
import type { ReactNode } from "react";
import type { PostType } from "./PostCard/types";

const GLYPHS: Record<PostType, ReactNode> = {
  // Speech bubble
  thought: (
    <>
      <path d="M12 4.5c-4.4 0-8 2.8-8 6.3 0 1.9 1 3.6 2.7 4.8L6 19.5l4.2-1.6c.6.1 1.2.2 1.8.2 4.4 0 8-2.8 8-6.3s-3.6-7.3-8-7.3z" />
    </>
  ),
  // Feather quill
  poem: (
    <>
      <path d="M20 4c-5.6 0-10.5 3.2-12.3 9.2L6.2 17.5h4.2C16 16.6 19.4 11 20 4z" />
      <path d="M4 20l5.5-5.5" />
      <path d="M10.4 17.5l4.6-4.6" />
    </>
  ),
  // Notebook with ribbon
  journal: (
    <>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5z" />
      <path d="M8.5 3v18" />
      <path d="M13 3v6l1.75-1.25L16.5 9V3" />
    </>
  ),
  // Document with folded corner
  essay: (
    <>
      <path d="M7 3h7l5 5v11.5A1.5 1.5 0 0 1 17.5 21h-10A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7.5 3z" />
      <path d="M14 3v5h5" />
      <path d="M9.5 12.5h5M9.5 16h5" />
    </>
  ),
  // Article layout
  blog: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M4 9.5h16" />
      <path d="M7.5 13h9M7.5 16h5.5" />
    </>
  ),
  // Open book
  story: (
    <>
      <path d="M12 6.6c-1.7-1.3-4-1.9-8-1.9v13.6c4 0 6.3.6 8 1.9 1.7-1.3 4-1.9 8-1.9V4.7c-4 0-6.3.6-8 1.9z" />
      <path d="M12 6.6v13.6" />
    </>
  ),
  // Envelope
  letter: (
    <>
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <path d="M4.5 7.2l7.5 5.8 7.5-5.8" />
    </>
  ),
  // Quotation marks
  quote: (
    <>
      <path d="M10 7.5H6.8A2.8 2.8 0 0 0 4 10.3v3.2h6V7.5z" />
      <path d="M10 13.5c0 2-1.2 3.2-3 3.5" />
      <path d="M20 7.5h-3.2a2.8 2.8 0 0 0-2.8 2.8v3.2h6V7.5z" />
      <path d="M20 13.5c0 2-1.2 3.2-3 3.5" />
    </>
  ),
  // Picture frame with horizon
  visual: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M4 16.5l4.4-4.4a1.5 1.5 0 0 1 2.1 0L16 17.5" />
      <path d="M13.5 15l1.6-1.6a1.5 1.5 0 0 1 2.1 0L20 16.2" />
      <circle cx="15.5" cy="8.5" r="1.25" />
    </>
  ),
  // Play in a rounded frame
  video: (
    <>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" />
      <path d="M10.2 9.2v5.6l4.6-2.8z" />
    </>
  ),
  // Musical note
  audio: (
    <>
      <path d="M9.5 18V6.8l9.5-2v11.2" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
};

interface PostTypeIconProps {
  type: PostType | string;
  className?: string;
  strokeWidth?: number;
}

export function PostTypeIcon({ type, className = "w-4 h-4", strokeWidth = 1.75 }: PostTypeIconProps) {
  const glyph = GLYPHS[type as PostType] ?? GLYPHS.thought;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  );
}

export default PostTypeIcon;
