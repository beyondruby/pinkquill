"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

// =============================================================================
// AudioPlayer — calm, on-brand inline audio player for the "Sound" / "Voice"
// feed showcases (see docs/POST_CREATION_BLUEPRINT.md §6).
//
//   variant="card"  (default) — album-art style: square cover + title, with a
//                                play button + seekable progress + time below.
//   variant="voice"           — compact single-row bar (small play + progress +
//                                time), no cover.
//
// Only one AudioPlayer plays at a time: starting one pauses any other via a
// module-level registry. Brand rules: full subtle bg + full matching border
// (no accent-line borders); theme tokens only; aria-labelled, keyboard-operable.
// =============================================================================

// --- Module-level "currently playing" coordination ---------------------------
// Each mounted player registers a pause callback; when one starts, it pauses
// every other registered player.
const activePlayers = new Set<() => void>();

function pauseOthers(self: () => void) {
  for (const pause of activePlayers) {
    if (pause !== self) pause();
  }
}

function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const secs = Math.floor(totalSeconds);
  const mins = Math.floor(secs / 60);
  const remainder = secs % 60;
  return `${mins}:${remainder.toString().padStart(2, "0")}`;
}

interface AudioPlayerProps {
  src: string;
  title?: string;
  cover?: string | null;
  durationSec?: number;
  variant?: "card" | "voice";
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-1/2 w-1/2 translate-x-[1px]">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-1/2 w-1/2">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

export function AudioPlayer({
  src,
  title,
  cover,
  durationSec,
  variant = "card",
}: AudioPlayerProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Total comes from the explicit prop, falling back to the element's metadata.
  const [metadataDuration, setMetadataDuration] = useState<number | null>(null);

  const total =
    durationSec && Number.isFinite(durationSec) && durationSec > 0
      ? durationSec
      : metadataDuration ?? 0;

  // Register a pause callback so other players can stop this one.
  useEffect(() => {
    const pause = () => {
      audioRef.current?.pause();
    };
    activePlayers.add(pause);
    return () => {
      activePlayers.delete(pause);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      pauseOthers(() => audio.pause());
      void audio.play().catch(() => {
        // Autoplay/playback rejection — stay paused, no UI crash.
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, []);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Number(event.target.value);
    audio.currentTime = next;
    setCurrentTime(next);
  }, []);

  const progressMax = total > 0 ? total : 0;

  const progressBar = (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={0}
        max={progressMax || 1}
        step={0.1}
        value={Math.min(currentTime, progressMax || currentTime)}
        onChange={handleSeek}
        disabled={progressMax === 0}
        aria-label="Seek"
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(total)}`}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border-light accent-accent disabled:cursor-default"
      />
      <span className="shrink-0 text-xs tabular-nums text-muted">
        {formatTime(currentTime)} / {formatTime(total)}
      </span>
    </div>
  );

  const playButton = (sizeClasses: string) => (
    <button
      type="button"
      onClick={togglePlay}
      aria-label={isPlaying ? "Pause" : "Play"}
      aria-pressed={isPlaying}
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${sizeClasses}`}
    >
      {isPlaying ? <PauseIcon /> : <PlayIcon />}
    </button>
  );

  const audioElement = (
    <audio
      ref={audioRef}
      src={src}
      preload="metadata"
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
      onEnded={() => {
        setIsPlaying(false);
        setCurrentTime(0);
      }}
      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (Number.isFinite(d) && d > 0) setMetadataDuration(d);
      }}
    />
  );

  // --- Voice variant: compact single row ------------------------------------
  if (variant === "voice") {
    return (
      <div className="flex w-full items-center gap-3 rounded-xl border border-border-light bg-surface px-3 py-2">
        {audioElement}
        {playButton("h-9 w-9")}
        <div className="min-w-0 flex-1">{progressBar}</div>
      </div>
    );
  }

  // --- Card variant: album-art style ----------------------------------------
  return (
    <div className="w-full rounded-xl border border-border-light bg-surface p-3">
      {audioElement}
      <div className="flex items-center gap-3">
        {cover ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-border-light">
            <Image src={cover} alt={title ? `${title} cover art` : "Cover art"} fill sizes="64px" className="object-cover" />
          </div>
        ) : (
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border-light bg-border-light/40 text-muted"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {title ? (
            <p className="truncate text-sm font-medium text-ink">{title}</p>
          ) : (
            <p className="truncate text-sm font-medium text-muted">Sound</p>
          )}
          <div className="mt-2 flex items-center gap-3">
            {playButton("h-10 w-10")}
            <div className="min-w-0 flex-1">{progressBar}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
