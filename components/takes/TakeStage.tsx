"use client";

import type { CSSProperties, RefObject } from "react";
import { icons, PlayIcon } from "@/components/ui/Icons";

interface TakeStageProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  poster?: string | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  /** Seconds. Hidden when 0. */
  duration: number;
  contentWarning?: string | null;
  revealed: boolean;
  onReveal: () => void;
  videoStyle?: CSSProperties;
  className?: string;
}

export function formatTakeDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * The video stage shared by the Take page and the Take modal: a portrait
 * frame on a dark ground, tap to play, one mute control and the running
 * time pinned to a bar that stays readable over any footage. A content
 * warning veils the frame until the viewer chooses to look.
 */
export default function TakeStage({
  videoRef,
  src,
  poster,
  isPlaying,
  onTogglePlay,
  isMuted,
  onToggleMute,
  duration,
  contentWarning,
  revealed,
  onReveal,
  videoStyle,
  className = "",
}: TakeStageProps) {
  const veiled = Boolean(contentWarning) && !revealed;

  return (
    <div className={`pq-take-stage ${className}`.trim()} data-veiled={veiled || undefined}>
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        className="pq-take-stage__video"
        style={videoStyle}
        loop
        playsInline
        muted={isMuted}
        onClick={veiled ? undefined : onTogglePlay}
        aria-hidden={veiled || undefined}
      />

      {veiled ? (
        <div className="pq-take-stage__cw" role="group" aria-label="Content warning">
          <p className="pq-take-stage__cw-label">Content warning</p>
          <p className="pq-take-stage__cw-text">{contentWarning}</p>
          <button type="button" className="pq-take-stage__reveal" onClick={onReveal}>
            Show the take
          </button>
        </div>
      ) : (
        !isPlaying && (
          <button type="button" className="pq-take-stage__play" onClick={onTogglePlay} aria-label="Play">
            <PlayIcon size="lg" className="translate-x-[2px]" />
          </button>
        )
      )}

      <div className="pq-take-stage__bar">
        {duration > 0 && <span className="pq-take-stage__time">{formatTakeDuration(duration)}</span>}
        <button
          type="button"
          className="pq-take-stage__mute"
          onClick={onToggleMute}
          aria-label={isMuted ? "Unmute" : "Mute"}
          aria-pressed={!isMuted}
        >
          {isMuted ? icons.volumeOff : icons.volumeOn}
        </button>
      </div>
    </div>
  );
}
