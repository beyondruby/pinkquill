"use client";

import { type ConcreteThemeId, SYSTEM_LIGHT, SYSTEM_DARK } from "@/lib/theme/registry";

// Mini mock-app preview rendered in the picker. The wrapper carries a scoped
// data-theme attribute so every nested utility (bg-canvas, bg-surface, text-ink,
// bg-accent, …) resolves through that theme's CSS variable overrides — i.e. the
// preview is rendered with the actual theme, not painted from duplicated hex.
function ThemePreviewInner({ themeId }: { themeId: ConcreteThemeId }) {
  return (
    <div data-theme={themeId} className="bg-canvas h-full w-full">
      <div className="p-3 h-full flex flex-col gap-2">
        <div className="bg-surface rounded-md p-2 border border-border-light flex-1 min-h-0">
          <div className="h-1.5 w-3/5 bg-ink/85 rounded mb-1.5" />
          <div className="h-1 w-4/5 bg-muted rounded mb-1" />
          <div className="h-1 w-2/3 bg-muted rounded" />
        </div>
        <div className="flex items-center gap-2 px-0.5">
          <div className="h-3 w-3 rounded-full bg-accent flex-shrink-0" />
          <div className="h-2 flex-1 bg-accent-2/70 rounded" />
        </div>
      </div>
    </div>
  );
}

export function ThemePreview({ themeId }: { themeId: ConcreteThemeId }) {
  return (
    <div className="aspect-[4/3] rounded-lg overflow-hidden border border-border-light">
      <ThemePreviewInner themeId={themeId} />
    </div>
  );
}

// Shows the SYSTEM_LIGHT / SYSTEM_DARK pair side-by-side so users see what
// "match system" actually means — both halves use real CSS variable values
// from their respective themes.
export function SystemThemePreview() {
  return (
    <div
      className="aspect-[4/3] rounded-lg overflow-hidden border border-border-light grid grid-cols-2 divide-x divide-border-light"
    >
      <ThemePreviewInner themeId={SYSTEM_LIGHT} />
      <ThemePreviewInner themeId={SYSTEM_DARK} />
    </div>
  );
}
