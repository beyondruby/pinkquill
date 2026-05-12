import type { Metadata } from "next";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { FeedViewPicker } from "@/components/feed/FeedViewPicker";

export const metadata: Metadata = {
  title: "Appearance — Settings",
};

export default function AppearancePage() {
  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="font-display text-2xl font-bold text-ink mb-2">
          Appearance
        </h1>
        <p className="font-body text-muted">
          Choose how PinkQuill looks to you. Your selection syncs across devices when you&apos;re signed in.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="font-display text-lg font-semibold text-ink mb-3">
          Theme
        </h2>
        <ThemePicker />
        <p className="font-body text-[0.8rem] text-muted mt-4 leading-relaxed">
          Tip: <span className="text-subdued">Match system</span> automatically follows your operating system&apos;s light or dark preference. Override anytime by picking a specific theme — your choice is saved instantly.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold text-ink mb-3">
          Feed layout
        </h2>
        <p className="font-body text-muted text-sm mb-4">
          Choose how the home feed is laid out. You can also switch from the toggle above the feed at any time.
        </p>
        <FeedViewPicker />
      </section>
    </div>
  );
}
