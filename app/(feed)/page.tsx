import FeedBoundary from "@/components/feed/FeedBoundary";

// Public — guests can browse the feed. Interactions (comment, react,
// save, relay, post, follow, message) are individually gated and trigger
// the auth modal at the point of action. Reddit-style read-anywhere,
// log-in-to-act behavior.
export default function Home() {
  return <FeedBoundary />;
}
