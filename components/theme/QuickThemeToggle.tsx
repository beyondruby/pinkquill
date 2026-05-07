"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { THEMES, SYSTEM_LIGHT, SYSTEM_DARK } from "@/lib/theme/registry";

type Segment = "system" | "light" | "dark";

const segments: Array<{ id: Segment; label: string; icon: React.ReactElement }> = [
  {
    id: "system",
    label: "System",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v3m6-3v3M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "light",
    label: "Light",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: "dark",
    label: "Dark",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
];

// Categorical 3-segment switch (System / Light / Dark) for the profile dropdown.
// Light/Dark map to the system-fallback themes (SYSTEM_LIGHT, SYSTEM_DARK), not
// to specific theme ids — so the toggle stays meaningful as the theme library
// grows. Active segment is derived from THEMES[currentId].appearance, so a user
// on a custom light theme still sees "Light" highlighted.
export function QuickThemeToggle() {
  const { themeId, setTheme } = useTheme();

  let activeSegment: Segment = "system";
  if (themeId !== "system") {
    activeSegment = THEMES[themeId].appearance === "dark" ? "dark" : "light";
  }

  const select = (id: Segment, e: React.MouseEvent) => {
    // Don't bubble up — the parent dropdown closes on outside-click and we
    // want the user to be able to flick between segments without dismissing.
    e.stopPropagation();
    // No-op when the click matches the current category. A user on a custom
    // light theme (e.g. Cream) clicking "Light" should NOT lose their choice
    // and snap back to the canonical SYSTEM_LIGHT — they're already on light.
    // Switching across categories (Light→Dark, Dark→Light, anything→System)
    // does jump to the canonical fallback, which is the intended UX for a
    // categorical quick-toggle. Fine-grained picks live in /settings/appearance.
    if (id === activeSegment) return;
    if (id === "system") setTheme("system");
    else if (id === "light") setTheme(SYSTEM_LIGHT);
    else setTheme(SYSTEM_DARK);
  };

  return (
    <div className="px-1.5 py-1.5">
      <p className="font-ui text-[0.7rem] font-semibold text-muted uppercase tracking-wider px-1.5 pb-1.5">
        Appearance
      </p>
      <div
        role="radiogroup"
        aria-label="Color theme"
        className="grid grid-cols-3 gap-1 p-1 bg-subtle rounded-xl"
      >
        {segments.map((seg) => {
          const isActive = activeSegment === seg.id;
          return (
            <button
              key={seg.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={(e) => select(seg.id, e)}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg font-ui text-[0.7rem] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                isActive
                  ? "bg-surface text-accent shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {seg.icon}
              <span>{seg.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
