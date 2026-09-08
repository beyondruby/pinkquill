"use client";

import type { PostPalette } from "./palette";

interface Props {
  warning: string;
  /** Post body: the palette decides the tint. Omit with `variant="video"`. */
  palette?: PostPalette;
  onShow: () => void;
  className?: string;
  /** "video" — the dark cover over a take player (feed, modal, page). */
  variant?: "post" | "video";
}

/** The "Content Warning" cover over a post body or a take (V-52: five copies). */
export function ContentWarningOverlay({ warning, palette, onShow, className = "", variant = "post" }: Props) {
  if (variant === "video") {
    return (
      <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 ${className}`}>
        <div className="flex flex-col items-center gap-4 p-6 max-w-[280px] text-center">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-ui text-base font-semibold text-white mb-1">Content Warning</h3>
            <p className="font-ui text-sm text-white/70">{warning}</p>
          </div>
          <button onClick={onShow} className="px-6 py-2.5 rounded-full font-ui text-sm font-medium text-white bg-surface/20 hover:bg-surface/30 transition-colors">
            Show Content
          </button>
        </div>
      </div>
    );
  }
  const { hasBackground, hasDarkBg, text } = palette ?? { hasBackground: false, hasDarkBg: false, text: "text-ink" };
  return (
    <div
      className={`content-warning-overlay absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-2xl rounded-xl ${
        hasBackground ? (hasDarkBg ? "bg-black/40" : "bg-white/60") : "bg-surface/40"
      } ${className}`}
    >
      <div className="relative text-center px-8 py-10">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-ui text-sm font-semibold text-amber-700">Content Warning</span>
        </div>
        <p className={`font-body text-base mb-6 max-w-md mx-auto ${text}`}>{warning}</p>
        <button
          onClick={onShow}
          className={`content-warning-show px-6 py-2.5 rounded-full font-ui text-sm font-medium transition-colors ${
            hasBackground ? (hasDarkBg ? "text-[#1e1e1e] bg-white/90 hover:bg-white" : "text-white bg-[#1e1e1e]/85 hover:bg-[#1e1e1e]") : "text-white bg-ink/80 hover:bg-ink"
          }`}
        >
          Show Content
        </button>
      </div>
    </div>
  );
}
