import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
      <div className="text-center max-w-md">
        <p className="font-ui text-sm text-muted mb-2">404</p>
        <h1 className="font-display text-3xl text-ink mb-3">This page doesn&apos;t exist</h1>
        <p className="font-body text-muted mb-8">
          The link may be broken, or the page may have been removed.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white hover:opacity-90 transition-opacity"
        >
          Back to the feed
        </Link>
      </div>
    </div>
  );
}
