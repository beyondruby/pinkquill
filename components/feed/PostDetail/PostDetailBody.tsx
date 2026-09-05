"use client";

import type { ReactNode } from "react";
import { AudioPlayer } from "@/components/feed/AudioPlayer";
import Button from "@/components/ui/Button";
import { createSafeHtml, stripHtmlPreserveLines } from "@/lib/utils/sanitize";
import { getBackgroundStyle } from "@/lib/utils/background";
import JournalHeader from "./JournalHeader";
import MediaGallery from "./MediaGallery";
import { alignmentClass, lineSpacingClass, type DetailPost, type DetailTone } from "./types";

interface PostDetailBodyProps {
  post: DetailPost;
  tone: DetailTone;
  /** Heading level for the title: the page uses h1, the modal h2. */
  headingLevel?: "h1" | "h2";
  mediaIndex: number;
  onMediaIndexChange: (index: number) => void;
  /** Content-warning state lives with the surface. */
  revealed: boolean;
  onReveal: () => void;
  /** Anything to show above the work (e.g. a failed-upload notice). */
  notice?: ReactNode;
}

/**
 * The work itself: journal header, music, sound, title, text, then images or
 * video. Honours creator styling (alignment, spacing, drop cap, background)
 * and keeps a content warning in front until the reader chooses to look.
 */
export default function PostDetailBody({
  post,
  tone,
  headingLevel = "h2",
  mediaIndex,
  onMediaIndexChange,
  revealed,
  onReveal,
  notice,
}: PostDetailBodyProps) {
  const Heading = headingLevel;
  const visual = post.media.filter((m) => m.media_type !== "audio");
  const audio = post.media.find((m) => m.media_type === "audio") || null;
  const audioCover = visual.find((m) => m.media_type === "image")?.media_url || null;
  const isVoice = post.type === "voice";
  const isPoem = post.type === "poem";
  const align = isPoem ? "text-center" : alignmentClass(post.styling);
  const spacing = lineSpacingClass(post.styling);
  const dropCap = post.styling?.dropCap ? "drop-cap-enabled" : "";
  const background = post.styling?.background;
  const hidden = Boolean(post.contentWarning) && !revealed;

  return (
    <div className={`pq-detail__work ${tone.hasBackground ? "pq-detail__work--styled" : ""}`}>
      {tone.hasBackground && (
        <>
          <div
            className="pq-detail__backdrop"
            style={{
              ...getBackgroundStyle(background),
              opacity: background?.type === "image" ? background.opacity ?? 1 : 1,
              filter: background?.type === "image" && background.blur ? `blur(${background.blur}px)` : undefined,
            }}
            aria-hidden="true"
          />
          {background?.type === "image" && <div className="pq-detail__backdrop pq-detail__backdrop--shade" aria-hidden="true" />}
        </>
      )}

      <div className={`pq-detail__work-inner ${hidden ? "pq-detail__work-inner--hidden" : ""}`} aria-hidden={hidden || undefined}>
        {notice}

        {post.type === "journal" && post.createdAt && (
          <JournalHeader createdAt={post.createdAt} location={post.post_location} metadata={post.metadata} tone={tone} />
        )}

        {post.type !== "journal" && post.post_location && (
          <p className={`pq-detail__place ${tone.muted}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            {post.post_location}
          </p>
        )}

        {post.spotify_track && (
          <div className="pq-detail__track">
            <iframe
              src={`https://open.spotify.com/embed/track/${post.spotify_track.id}?utm_source=generator&theme=${tone.dark ? "0" : "1"}`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title={`${post.spotify_track.name} by ${post.spotify_track.artist}`}
            />
          </div>
        )}

        {audio && (
          <div className="pq-detail__audio">
            <AudioPlayer src={audio.media_url} title={post.title || undefined} cover={isVoice ? null : audioCover} variant={isVoice ? "voice" : "card"} />
          </div>
        )}

        {post.title && <Heading className={`pq-detail__title ${tone.text} ${align}`}>{post.title}</Heading>}

        {isPoem ? (
          <div className={`pq-detail__text pq-detail__text--poem post-content ${tone.text} ${spacing} ${dropCap}`}>
            {stripHtmlPreserveLines(post.content)}
          </div>
        ) : (
          <div
            className={`pq-detail__text post-content ${tone.text} ${align} ${spacing} ${dropCap}`}
            dangerouslySetInnerHTML={createSafeHtml(post.content)}
          />
        )}

        {visual.length > 0 ? (
          <MediaGallery media={visual} index={mediaIndex} onIndexChange={onMediaIndexChange} tone={tone} authorName={post.author.name} />
        ) : post.image ? (
          <figure className="pq-detail__gallery">
            <div className="pq-detail__stage">
              <img src={post.image} alt={post.title || `Image by ${post.author.name}`} className="pq-detail__image" />
            </div>
          </figure>
        ) : null}
      </div>

      {hidden && (
        <div className="pq-detail__cw" role="group" aria-label="Content warning">
          <p className="pq-detail__cw-label">Content warning</p>
          <p className="pq-detail__cw-text">{post.contentWarning}</p>
          <Button variant="secondary" onClick={onReveal}>Show the work</Button>
        </div>
      )}
    </div>
  );
}
