"use client";

import { ChevronLeftIcon, ChevronRightIcon, PlayIcon } from "@/components/ui/Icons";
import type { DetailMedia, DetailTone } from "./types";

interface MediaGalleryProps {
  media: DetailMedia[];
  index: number;
  onIndexChange: (next: number) => void;
  tone: DetailTone;
  authorName: string;
}

/** The work's images and video, one at a time, with quiet arrows and thumbnails. */
export default function MediaGallery({ media, index, onIndexChange, tone, authorName }: MediaGalleryProps) {
  if (media.length === 0) return null;
  const current = media[Math.min(index, media.length - 1)];
  const prev = () => onIndexChange(index === 0 ? media.length - 1 : index - 1);
  const next = () => onIndexChange(index === media.length - 1 ? 0 : index + 1);

  return (
    <figure className="pq-detail__gallery">
      <div className="pq-detail__stage">
        {current.media_type === "video" ? (
          <video src={current.media_url} controls playsInline preload="metadata" className="pq-detail__video" aria-label={current.caption || `Video by ${authorName}`} />
        ) : (
          <button
            type="button"
            className="pq-detail__image-button"
            aria-label={`Open image ${index + 1} of ${media.length} full size`}
            onClick={() => window.dispatchEvent(new CustomEvent("openLightbox", { detail: { images: media, index } }))}
          >
            <img src={current.media_url} alt={current.caption || `Image ${index + 1} by ${authorName}`} className="pq-detail__image" />
          </button>
        )}
        {media.length > 1 && (
          <>
            <button type="button" onClick={prev} className="pq-detail__arrow pq-detail__arrow--prev" aria-label="Previous">
              <ChevronLeftIcon />
            </button>
            <button type="button" onClick={next} className="pq-detail__arrow pq-detail__arrow--next" aria-label="Next">
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>
      {current.caption && <figcaption className={`pq-detail__caption ${tone.muted}`}>{current.caption}</figcaption>}
      {media.length > 1 && (
        <div className="pq-detail__thumbs" role="group" aria-label="Choose an image">
          {media.map((item, i) => (
            <button
              key={item.id || i}
              type="button"
              onClick={() => onIndexChange(i)}
              aria-label={`${item.media_type === "video" ? "Video" : "Image"} ${i + 1} of ${media.length}`}
              aria-current={i === index ? "true" : undefined}
              className="pq-detail__thumb"
            >
              {item.media_type === "video" ? (
                <>
                  <video src={item.media_url} preload="metadata" muted />
                  <span className="pq-detail__thumb-play" aria-hidden="true"><PlayIcon size="sm" /></span>
                </>
              ) : (
                <img src={item.media_url} alt="" />
              )}
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
