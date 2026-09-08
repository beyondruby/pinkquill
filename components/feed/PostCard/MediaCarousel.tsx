"use client";

// Visual-story carousel for the classic card (after the quill-v6 reference):
// one slide per image or clip, a caption band across the bottom of the slide,
// round prev/next buttons, dots, and a frame counter. A single item renders
// as one plain slide with no controls. Swipe and arrow keys both move it.

import { useRef, useState } from "react";
import Image from "next/image";
import type { MediaItem } from "./types";
import { ChevronLeftGlyph, ChevronRightGlyph } from "./ActionIcons";
import { VideoPlayer } from "../VideoPlayer";

interface MediaCarouselProps {
  items: MediaItem[];
  authorName: string;
  /** Opens the post (used when a slide itself is clicked). */
  onOpen?: () => void;
}

export function MediaCarousel({ items, authorName, onOpen }: MediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const count = items.length;
  if (count === 0) return null;

  const hasCaptions = items.some((m) => !!m.caption);
  const go = (next: number) => setIndex(((next % count) + count) % count);

  return (
    <div
      className={`carousel-container ${hasCaptions ? "has-captions" : ""}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (count < 2) return;
        if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
        if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
      }}
      onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchX.current === null || count < 2) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      }}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${count} ${count === 1 ? "image" : "images"} by ${authorName}`}
      tabIndex={count > 1 ? 0 : -1}
    >
      <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            className="carousel-slide"
            aria-hidden={idx !== index}
            inert={idx !== index}
            aria-roledescription="slide"
            aria-label={`${idx + 1} of ${count}`}
          >
            {item.media_type === "video" ? (
              <div className="carousel-video">
                <VideoPlayer src={item.media_url} poster={item.thumbnail_url} title={item.caption || undefined} />
              </div>
            ) : (
              <button
                type="button"
                className="carousel-open"
                onClick={onOpen}
                aria-label={item.caption ? `Open: ${item.caption}` : `Open image ${idx + 1} of ${count}`}
                tabIndex={idx === index ? 0 : -1}
              >
                <Image
                  src={item.media_url}
                  alt={item.caption || `Image ${idx + 1} in post by ${authorName}`}
                  width={1200}
                  height={800}
                  className="carousel-media"
                  sizes="(max-width: 640px) 92vw, 560px"
                  quality={80}
                  loading={idx === 0 ? "eager" : "lazy"}
                />
              </button>
            )}
            {item.caption && (
              <div className="carousel-caption">
                <p>{item.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <span className="carousel-counter" aria-hidden="true">
            {index + 1} / {count}
          </span>
          <button type="button" className="carousel-nav prev" aria-label="Previous image" onClick={() => go(index - 1)}>
            <ChevronLeftGlyph size={14} />
          </button>
          <button type="button" className="carousel-nav next" aria-label="Next image" onClick={() => go(index + 1)}>
            <ChevronRightGlyph size={14} />
          </button>
          <div className="carousel-dots" role="tablist" aria-label="Choose image">
            {items.map((item, idx) => (
              <button
                key={item.id || idx}
                type="button"
                role="tab"
                aria-selected={idx === index}
                aria-label={`Image ${idx + 1}`}
                className={`carousel-dot ${idx === index ? "active" : ""}`}
                onClick={() => go(idx)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default MediaCarousel;
