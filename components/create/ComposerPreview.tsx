"use client";

import React from "react";
import { getBackgroundStyle, isDarkBackground } from "@/lib/utils/background";
import { getFormatSpec } from "@/lib/feed-view/formats";
import type { PostStyling, TextAlignment } from "@/lib/types";

export interface ComposerPreviewMedia {
  id: string;
  preview: string;
  type: "image" | "video" | "audio";
  caption?: string;
  durationSec?: number;
}

export interface ComposerPreviewProps {
  authorName: string;
  authorUsername?: string;
  authorAvatar?: string | null;
  title?: string;
  /** Plain-text excerpt of the body. */
  excerpt?: string;
  formatId: string;
  styling?: PostStyling;
  textAlignment?: TextAlignment;
  media: ComposerPreviewMedia[];
  /** Per-format extras that should surface in the preview. */
  attribution?: string;
  subtitle?: string;
  artist?: string;
  spotify?: { name: string; artist: string; albumArt?: string } | null;
}

function formatDuration(sec?: number): string {
  if (typeof sec !== "number" || !isFinite(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Lightweight, non-interactive feed-card preview for the composer's Format step.
 * Mirrors the live composer state (NOT the heavy interactive PostCard) so the
 * creator sees what they're making while picking a format and its options.
 */
export default function ComposerPreview(props: ComposerPreviewProps) {
  const {
    authorName,
    authorUsername,
    authorAvatar,
    title,
    excerpt,
    formatId,
    styling,
    textAlignment = "left",
    media,
    attribution,
    subtitle,
    artist,
    spotify,
  } = props;

  const spec = getFormatSpec(formatId);
  const formatLabel = spec.label;

  const images = media.filter((m) => m.type === "image");
  const video = media.find((m) => m.type === "video") || null;
  const audio = media.find((m) => m.type === "audio") || null;

  const background = styling?.background;
  const hasBackground = Boolean(background);
  const bgIsDark = hasBackground && isDarkBackground(background);
  const bgStyle = hasBackground ? getBackgroundStyle(background) : undefined;

  const alignClass =
    textAlignment === "center"
      ? "text-center"
      : textAlignment === "right"
        ? "text-right"
        : "text-left";

  const inkOnBg = bgIsDark ? "text-white" : "text-ink";
  const subduedOnBg = bgIsDark ? "text-white/70" : "text-muted";

  return (
    <div className="rounded-2xl border border-border-light bg-surface shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-skeleton flex-shrink-0 ring-2 ring-border-light">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={authorAvatar || "/defaultprofile.png"}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-ui text-sm font-semibold text-ink truncate">
            {authorName}
          </p>
          {authorUsername && (
            <p className="font-ui text-xs text-muted truncate">@{authorUsername}</p>
          )}
        </div>
        <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary font-ui text-[0.7rem] font-semibold whitespace-nowrap">
          {formatLabel}
        </span>
      </div>

      {/* Body */}
      <div
        className={`px-4 pb-4 ${alignClass}`}
        style={hasBackground ? { ...bgStyle, borderRadius: 16, padding: 20, margin: "0 16px 16px" } : undefined}
      >
        {title && (
          <h3 className={`font-display text-lg font-bold leading-snug ${inkOnBg} ${formatId === "quote" ? "italic" : ""}`}>
            {formatId === "quote" ? `“${title}”` : title}
          </h3>
        )}

        {subtitle && (formatId === "essay" || formatId === "blog") && (
          <p className={`mt-1 font-display text-sm italic ${subduedOnBg}`}>{subtitle}</p>
        )}

        {excerpt && (
          <p className={`mt-2 font-ui text-sm leading-relaxed whitespace-pre-line line-clamp-6 ${bgIsDark ? "text-white/90" : "text-ink/80"}`}>
            {excerpt}
          </p>
        )}

        {attribution && formatId === "quote" && (
          <p className={`mt-3 font-ui text-xs font-medium ${subduedOnBg}`}>
            {"— "}{attribution}
          </p>
        )}

        {!title && !excerpt && !audio && images.length === 0 && !video && !spotify && (
          <p className="font-ui text-sm text-muted/60 italic">Your post preview will appear here.</p>
        )}
      </div>

      {/* Image gallery */}
      {images.length > 0 && (
        <div className="px-4 pb-4">
          {images.length === 1 ? (
            <div className="rounded-xl overflow-hidden bg-skeleton">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[0].preview} alt="" className="w-full max-h-80 object-cover" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
              {images.slice(0, 4).map((img, i) => (
                <div key={img.id} className="relative aspect-square bg-skeleton overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  {i === 3 && images.length > 4 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-ui text-lg font-semibold">
                      +{images.length - 4}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Video */}
      {video && (
        <div className="px-4 pb-4">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video src={video.preview} className="w-full h-full object-cover" muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded audio (Sound / Voice) */}
      {audio && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-primary/5 to-pink-vivid/5 border border-purple-primary/15">
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v4M9 6v12M12 3v18M15 6v12M19 10v4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-ui text-sm font-medium text-ink truncate">
                {audio.caption || title || (formatId === "voice" ? "Voice note" : "Untitled track")}
              </p>
              <p className="font-ui text-xs text-muted truncate">
                {artist ? artist : formatId === "voice" ? "Voice" : "Sound"}
                {audio.durationSec ? ` · ${formatDuration(audio.durationSec)}` : ""}
              </p>
            </div>
            <svg className="w-8 h-8 text-purple-primary flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Spotify soundtrack */}
      {spotify && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1DB954]/5 border border-[#1DB954]/20">
            {spotify.albumArt && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={spotify.albumArt} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-ui text-sm font-medium text-ink truncate">{spotify.name}</p>
              <p className="font-ui text-xs text-muted truncate">{spotify.artist}</p>
            </div>
            <svg className="w-6 h-6 text-[#1DB954] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.96-.6-.122-.418.18-.84.6-.96 4.561-1.021 8.52-.6 11.64 1.32.36.181.48.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.481.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.561.3z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
