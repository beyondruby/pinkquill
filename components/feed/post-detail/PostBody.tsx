"use client";

import { weatherIcons, moodIcons } from "@/components/feed/PostCard/journalIcons";
import { formatDate, formatTime } from "@/lib/utils/time";
import { createSafeHtml, stripHtmlPreserveLines } from "@/lib/utils/sanitize";
import { AudioPlayer } from "@/components/feed/AudioPlayer";
import type { ModalPost } from "@/components/feed/PostCard/types";
import type { PostPalette } from "./palette";

function formatMood(mood?: string): string {
  if (!mood) return "";
  return mood.charAt(0).toUpperCase() + mood.slice(1);
}

const WEATHER_LABELS: Record<string, string> = {
  sunny: "Sunny",
  "partly-cloudy": "Partly Cloudy",
  cloudy: "Cloudy",
  rainy: "Rainy",
  stormy: "Stormy",
  snowy: "Snowy",
  foggy: "Foggy",
  windy: "Windy",
};
function formatWeather(weather?: string): string {
  if (!weather) return "";
  return WEATHER_LABELS[weather] || weather;
}

const LocationGlyph = ({ className, strokeWidth = "2" }: { className?: string; strokeWidth?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

interface Props {
  post: ModalPost;
  palette: PostPalette;
  /** The page owns the document's h1; the modal sits under a page that already has one. */
  titleAs?: "h1" | "h2";
}

/**
 * Journal header, location, Spotify embed, title, body and audio player —
 * the part of a post that reads the same in the modal and on its page
 * (profile audit 2e, V-52).
 */
export function PostBody({ post, palette, titleAs = "h2" }: Props) {
  const { hasBackground, hasDarkBg, text, muted, subtle } = palette;
  const textAlignment = post.styling?.textAlignment || "left";
  const lineSpacing = post.styling?.lineSpacing || "normal";
  const dropCapEnabled = post.styling?.dropCap || false;
  const alignmentClass = { left: "text-left", center: "text-center", right: "text-right", justify: "text-justify" }[textAlignment];
  const lineSpacingClass = { normal: "leading-relaxed", relaxed: "leading-[2]", loose: "leading-[2.5]" }[lineSpacing];

  const audioMedia = post.media?.find((m) => m.media_type === "audio") || null;
  const audioCover = post.media?.find((m) => m.media_type === "image")?.media_url || null;
  const isVoicePost = (post.type as string) === "voice";
  const meta = post.metadata;
  const Title = titleAs;
  const iconTone = hasBackground ? subtle : hasDarkBg ? "text-white/50" : "text-purple-primary/70";
  const dotTone = hasBackground ? (hasDarkBg ? "bg-white/30" : "bg-black/25") : hasDarkBg ? "bg-surface/30" : "bg-accent/30";

  return (
    <>
      {post.type === "journal" && post.createdAt && (
        <div className={`journal-header mb-8 ${hasBackground ? text : hasDarkBg ? "text-white" : ""}`}>
          <div className="flex items-center gap-4 mb-4">
            <h2 className={`font-display text-3xl md:text-4xl font-normal tracking-tight ${hasBackground ? text : hasDarkBg ? "text-white" : "text-purple-primary"}`}>
              {formatDate(post.createdAt)}
            </h2>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-ui ${
                hasBackground
                  ? hasDarkBg
                    ? "bg-white/10 text-white"
                    : "bg-black/5 text-[#1e1e1e]"
                  : hasDarkBg
                    ? "bg-surface/10 text-white/70"
                    : "bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary"
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {formatTime(post.createdAt)}
            </span>
          </div>

          {(post.post_location || meta?.weather || meta?.temperature || meta?.mood) && (
            <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 mb-5 ${hasBackground ? muted : hasDarkBg ? "text-white/80" : "text-ink/70"}`}>
              {post.post_location && (
                <div className="flex items-center gap-2">
                  <LocationGlyph className={`w-4 h-4 ${iconTone}`} />
                  <span className="font-ui text-sm">{post.post_location}</span>
                </div>
              )}
              {post.post_location && (meta?.weather || meta?.temperature) && <span className={`hidden sm:block w-1 h-1 rounded-full ${dotTone}`} />}
              {(meta?.weather || meta?.temperature) && (
                <div className="flex items-center gap-2">
                  <span className={iconTone}>
                    {meta?.weather ? (
                      weatherIcons[meta.weather]
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M14 4a6 6 0 00-6 6c0 2.5 1.5 4.5 3.5 5.5L10 20h4l-1.5-4.5c2-1 3.5-3 3.5-5.5a6 6 0 00-2-4.5" />
                      </svg>
                    )}
                  </span>
                  <span className="font-ui text-sm">
                    {meta?.temperature}
                    {meta?.temperature && meta?.weather && <span className="mx-1 opacity-40">·</span>}
                    {meta?.weather && formatWeather(meta.weather)}
                  </span>
                </div>
              )}
              {(meta?.weather || meta?.temperature) && meta?.mood && <span className={`hidden sm:block w-1 h-1 rounded-full ${dotTone}`} />}
              {meta?.mood && (
                <div className="flex items-center gap-2">
                  <span className={iconTone}>{moodIcons[meta.mood] || moodIcons["reflective"]}</span>
                  <span className="font-ui text-sm">
                    <span className={subtle}>Mood:</span> <span className="italic">{formatMood(meta.mood)}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          <div
            className={`h-px w-full ${
              hasBackground
                ? hasDarkBg
                  ? "bg-gradient-to-r from-white/25 via-white/10 to-transparent"
                  : "bg-gradient-to-r from-black/20 via-black/10 to-transparent"
                : hasDarkBg
                  ? "bg-gradient-to-r from-surface/20 via-surface/10 to-transparent"
                  : "bg-gradient-to-r from-purple-primary/30 via-pink-vivid/20 to-transparent"
            }`}
          />
        </div>
      )}

      {post.type !== "journal" && post.post_location && (
        <div className={`flex items-center gap-2 mb-4 ${muted}`}>
          <LocationGlyph className="w-4 h-4" strokeWidth="1.5" />
          <span className="font-ui text-sm">{post.post_location}</span>
        </div>
      )}

      {post.spotify_track && (
        <div className="mb-6">
          <div className={`rounded-xl overflow-hidden ${hasDarkBg ? "bg-[#121212]" : "bg-gradient-to-r from-[#1DB954]/5 to-[#191414]/5 border border-[#1DB954]/20"}`}>
            <iframe
              src={`https://open.spotify.com/embed/track/${post.spotify_track.id}?utm_source=generator&theme=${hasDarkBg ? "0" : "1"}`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-xl"
              title={`${post.spotify_track.name} by ${post.spotify_track.artist}`}
            />
          </div>
          <div className={`flex items-center justify-center gap-2 mt-2 ${muted}`}>
            <svg className="w-4 h-4 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            <span className="font-ui text-xs opacity-60">Listening to this track</span>
          </div>
        </div>
      )}

      {post.title && (
        <Title
          className={`font-display text-[1.5rem] md:text-[2.2rem] font-semibold mb-4 md:mb-5 leading-[1.2] tracking-tight ${text} ${
            post.type === "poem" || textAlignment === "center" ? "text-center" : alignmentClass
          }`}
        >
          {post.title}
        </Title>
      )}

      {post.type === "poem" ? (
        <div className={`font-body text-[1.05rem] md:text-[1.3rem] leading-loose italic text-center whitespace-pre-line py-4 md:py-8 post-content ${text} ${dropCapEnabled ? "drop-cap-enabled" : ""}`}>
          {stripHtmlPreserveLines(post.content)}
        </div>
      ) : (
        <div
          className={`font-body text-[0.95rem] md:text-[1.1rem] post-content ${text} ${alignmentClass} ${lineSpacingClass} ${dropCapEnabled ? "drop-cap-enabled" : ""}`}
          dangerouslySetInnerHTML={createSafeHtml(post.content)}
        />
      )}

      {audioMedia && (
        <div className="mt-5 md:mt-6 mb-6" onClick={(e) => e.stopPropagation()}>
          <AudioPlayer src={audioMedia.media_url} title={post.title || undefined} cover={isVoicePost ? null : audioCover} variant={isVoicePost ? "voice" : "card"} />
        </div>
      )}
    </>
  );
}
