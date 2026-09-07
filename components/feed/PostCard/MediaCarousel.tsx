"use client";

// Visual-story carousel for the classic card (after the quill-v6 reference):
// one slide per image or clip, a caption band over the bottom of the slide,
// round prev/next buttons and dots. A single item renders as one plain slide.

import { useState } from "react";
import Image from "next/image";
import type { MediaItem } from "./types";

interface MediaCarouselProps {
  items: MediaItem[];
  authorName: string;
}

export function MediaCarousel({ items, authorName }: MediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const count = items.length;
  if (count === 0) return null;
  const hasCaptions = items.some((m) => !!m.caption);
  const go = (next: number) => setIndex(((next % count) + count) % count);

  return (
    <div
      className={`carousel-container ${hasCaptions ? "has-captions" : ""}`}
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${count} ${count === 1 ? "image" : "images"} by ${authorName}`}
    >
      <div className="carousel-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            className="carousel-slide"
            aria-hidden={idx !== index}
            aria-roledescription="slide"
            aria-label={`${idx + 1} of ${count}`}
          >
            {item.media_type === "video" ? (
              <video src={item.media_url} className="carousel-media" controls preload="metadata" aria-label={item.caption || `Video ${idx + 1}`} />
            ) : (
              <Image
                src={item.media_url}
                alt={item.caption || `Image ${idx + 1} in post by ${authorName}`}
                width={1200}
                height={760}
                className="carousel-media"
                sizes="(max-width: 640px) 92vw, 540px"
                quality={80}
                loading={idx === 0 ? "eager" : "lazy"}
              />
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
          <button type="button" className="carousel-nav prev" aria-label="Previous" onClick={() => go(index - 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button type="button" className="carousel-nav next" aria-label="Next" onClick={() => go(index + 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
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
