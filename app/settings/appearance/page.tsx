import type { Metadata } from "next";
import { ThemePicker } from "@/components/theme/ThemePicker";

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
      <ThemePicker />
      <p className="font-body text-[0.8rem] text-muted mt-8 leading-relaxed">
        Tip: <span className="text-subdued">Match system</span> automatically follows your operating system&apos;s light or dark preference. Override anytime by picking a specific theme — your choice is saved instantly.
      </p>
    </div>
  );
}
