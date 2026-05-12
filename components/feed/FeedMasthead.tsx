"use client";

import { useState } from "react";
import { FeedViewSwitcher } from "./FeedViewSwitcher";

function formatDate(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const parts = fmt.formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${weekday} · ${month} ${day}, ${year}`;
}

// Editorial masthead — replaces the "thin bar above the feed". The view
// switcher tucks into the masthead's bottom rule, so the feed reads like the
// front page of a magazine. Brand fonts only, no decorative glyphs.
export function FeedMasthead({ wrapperClass }: { wrapperClass: string }) {
  // Lazy init so the date doesn't drift between SSR and first client paint;
  // suppressHydrationWarning on the span handles any timezone differences.
  const [dateLine] = useState(() => formatDate(new Date()));

  return (
    <header className={`${wrapperClass} px-4 md:px-6 pt-6 md:pt-10`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <span className="font-ui text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted">
          Today
        </span>
        <span className="h-px flex-1 bg-border-light" aria-hidden="true" />
        <span
          suppressHydrationWarning
          className="font-ui text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-muted tabular-nums"
        >
          {dateLine}
        </span>
      </div>

      <div className="text-center mb-5 md:mb-7">
        <h1 className="font-display text-3xl md:text-5xl font-bold text-ink tracking-tight leading-none">
          The{" "}
          <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent italic">
            Feed
          </span>
        </h1>
        <p className="mt-2 font-display italic text-muted text-sm md:text-base">
          Voices from the studio, gathered for you.
        </p>
      </div>

      <div className="flex justify-center">
        <FeedViewSwitcher />
      </div>
    </header>
  );
}
