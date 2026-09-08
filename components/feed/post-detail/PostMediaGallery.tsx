"use client";

import Image from "next/image";
import { VideoPlayer } from "@/components/feed/VideoPlayer";
import { LazyVideoThumb } from "@/components/feed/LazyVideoThumb";
import type { MediaItem } from "@/components/feed/PostCard/types";
import type { PostPalette } from "./palette";

function toRomanNumeral(num: number): string {
  const numerals: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let result = "";
  for (const [value, numeral] of numerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

interface Props {
  media: MediaItem[];
  index: number;
  onIndexChange: (index: number) => void;
  title?: string;
  palette: PostPalette;
  maxHeight?: number;
}

/** Current item, arrows, Roman-numeral caption and the thumbnail strip (V-52). */
export function PostMediaGallery({ media, index, onIndexChange, title, palette, maxHeight = 450 }: Props) {
  const { hasBackground, hasDarkBg, subtle } = palette;
  const current = media[index];
  if (!current) return null;
  return (
    <div className="post-media-gallery mt-4 md:mt-6 pb-6">
      <div className={`post-media-frame relative group rounded-lg overflow-hidden border ${hasDarkBg ? "border-surface/20" : "border-ink/10"}`}>
        {current.media_type === "video" ? (
          <VideoPlayer src={current.media_url} poster={current.thumbnail_url} title={title} maxHeight={maxHeight} />
        ) : (
          <div className="relative">
            <Image
              src={current.media_url}
              alt={current.caption || "Post media"}
              width={900}
              height={500}
              className="w-full h-auto max-h-[350px] md:max-h-[450px] object-cover cursor-pointer"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("openLightbox", { detail: { images: media, index } }));
              }}
              sizes="(max-width: 640px) 95vw, (max-width: 1024px) 600px, 700px"
              quality={80}
              priority={index === 0}
            />
          </div>
        )}

        {media.length > 1 && (
          <>
            <button
              onClick={() => onIndexChange(index === 0 ? media.length - 1 : index - 1)}
              aria-label="Previous media"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface/90 shadow-md flex items-center justify-center text-ink/70 opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-ink transition-colors duration-200 z-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => onIndexChange(index === media.length - 1 ? 0 : index + 1)}
              aria-label="Next media"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-surface/90 shadow-md flex items-center justify-center text-ink/70 opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-ink transition-colors duration-200 z-10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {current.caption && (
        <p className={`text-center mt-4 font-body text-[0.95rem] italic tracking-wide ${hasBackground ? subtle : hasDarkBg ? "text-white/60" : "text-ink/50"}`}>
          {toRomanNumeral(index + 1)}. {current.caption}
        </p>
      )}

      {media.length > 1 && (
        <div className="post-media-thumbs flex gap-2 justify-center mt-4">
          {media.map((item, idx) => (
            <button
              key={item.id || idx}
              onClick={() => onIndexChange(idx)}
              aria-label={`Show media ${idx + 1} of ${media.length}`}
              className={`post-media-thumb relative w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden transition-colors duration-200 ${
                idx === index ? "ring-2 ring-purple-primary/60 ring-offset-2" : "opacity-50 hover:opacity-80"
              }`}
            >
              {item.media_type === "video" ? (
                <div className="relative w-full h-full bg-black">
                  <LazyVideoThumb src={item.media_url} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              ) : (
                <Image src={item.media_url} alt={item.caption || "Media thumbnail"} width={64} height={64} className="w-full h-full object-cover" sizes="64px" quality={60} loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
