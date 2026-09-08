"use client";

// Pinkquill's own video player.
//
// Idle: the poster (or a brand-gradient placeholder) with a white play disc
// wrapped in a slowly turning purple→pink→orange ring, and the clip length in
// a chip. Nothing is fetched until the first play.
//
// Playing: a soft scrim carries a gradient scrubber (buffered range, hover
// time tip, a thumb that appears on hover), play/pause, ±10s skips, time,
// speed, volume (slider unfolds on hover), picture-in-picture and fullscreen.
// Controls fade after a couple of seconds and return on any movement.
//
// Feel: tap the picture to toggle (a play/pause pulse blooms in the centre),
// double-tap either side on touch to skip ten seconds, double-click on
// desktop for fullscreen. Keyboard: space / K play, J / L or ← / → skip,
// ↑ / ↓ volume, M mute, F fullscreen. Only one Pinkquill player plays at a
// time, a clip pauses when scrolled out of view, and the last volume is
// remembered.

import "./video-player.css";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { announcePlayback, onOtherPlayback } from "@/lib/media/playback";

interface VideoPlayerProps {
  src: string;
  poster?: string | null;
  title?: string;
  /** Pre-known length ("4:32") shown on the poster before metadata loads. */
  durationLabel?: string;
  /** Start playing on mount (the feed card swaps its poster for the player on tap). */
  autoPlay?: boolean;
  /** Tallest the box may grow; portrait clips are letterboxed on an ambient blur. */
  maxHeight?: number;
  className?: string;
}

const VOLUME_KEY = "pq-video-volume";
const RATES = [1, 1.25, 1.5, 2, 0.75];
const HIDE_AFTER_MS = 2400;
const SKIP_SECONDS = 10;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(rest).padStart(2, "0")}`;
}

/* ---- Glyphs: same 24-grid, 2px round stroke as the action row ------------ */
const G = ({ children, fill = "none", ...rest }: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>
    {children}
  </svg>
);
const PlayIcon = () => (
  <G fill="currentColor" strokeWidth={1}>
    <path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z" />
  </G>
);
const PauseIcon = () => (
  <G fill="currentColor" strokeWidth={1}>
    <rect x="5" y="4" width="5" height="16" rx="1.2" />
    <rect x="14" y="4" width="5" height="16" rx="1.2" />
  </G>
);
const ReplayIcon = () => (
  <G>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </G>
);
const SkipBackIcon = () => (
  <G>
    <path d="M3 12a9 9 0 1 0 2.6-6.4" />
    <path d="M3 3v5.5h5.5" />
  </G>
);
const SkipForwardIcon = () => (
  <G>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v5.5h-5.5" />
  </G>
);
const VolumeIcon = ({ level }: { level: number }) => (
  <G>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    {level > 0 && <path d="M15.5 8.5a5 5 0 0 1 0 7" />}
    {level > 0.55 && <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
  </G>
);
const MutedIcon = () => (
  <G>
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    <path d="m22 9-6 6" />
    <path d="m16 9 6 6" />
  </G>
);
const PipIcon = () => (
  <G>
    <rect x="2" y="4" width="20" height="16" rx="2.5" />
    <rect x="11" y="11" width="8" height="6" rx="1.2" fill="currentColor" stroke="none" />
  </G>
);
const ExpandIcon = () => (
  <G>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M16 3h3a2 2 0 0 1 2 2v3" />
    <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </G>
);
const ShrinkIcon = () => (
  <G>
    <path d="M3 8h3a2 2 0 0 0 2-2V3" />
    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
    <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
  </G>
);

export function VideoPlayer({
  src,
  poster,
  title,
  durationLabel,
  autoPlay = false,
  maxHeight = 560,
  className = "",
}: VideoPlayerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTap = useRef<{ t: number; side: "left" | "right" } | null>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overControls = useRef(false);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = localStorage.getItem(VOLUME_KEY);
      const v = saved === null ? 1 : Number(saved);
      return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
    } catch {
      return 1;
    }
  });
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [pipSupported] = useState(
    () => typeof document !== "undefined" && "pictureInPictureEnabled" in document && document.pictureInPictureEnabled,
  );
  const [controlsVisible, setControlsVisible] = useState(true);
  const [ratio, setRatio] = useState<number | null>(null);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pulse, setPulse] = useState<{ kind: "play" | "pause"; key: number } | null>(null);
  const [ripple, setRipple] = useState<{ side: "left" | "right"; key: number } | null>(null);

  /* ---- Element sync ------------------------------------------------------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.playbackRate = rate;
  }, [rate]);

  /* ---- Controls visibility ----------------------------------------------- */
  const clearHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const scheduleHide = useCallback(() => {
    clearHide();
    hideTimer.current = setTimeout(() => {
      if (!overControls.current) setControlsVisible(false);
    }, HIDE_AFTER_MS);
  }, []);
  const wake = useCallback(() => {
    setControlsVisible(true);
    if (playing) scheduleHide();
  }, [playing, scheduleHide]);

  useEffect(() => {
    if (playing) scheduleHide();
    else clearHide();
    return clearHide;
  }, [playing, scheduleHide]);

  /* ---- Smooth progress while playing ------------------------------------- */
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        setCurrent(v.currentTime);
        const b = v.buffered;
        if (b.length) {
          for (let i = b.length - 1; i >= 0; i--) {
            if (b.start(i) <= v.currentTime) {
              setBuffered(b.end(i));
              break;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  /* ---- One player at a time; pause when scrolled away --------------------- */
  useEffect(() => {
    return onOtherPlayback(id, () => videoRef.current?.pause());
  }, [id]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !videoRef.current?.paused && !document.fullscreenElement && !document.pictureInPictureElement) {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement && document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ---- Actions ------------------------------------------------------------ */
  const play = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    announcePlayback(id);
    setStarted(true);
    setEnded(false);
    void v.play().catch(() => setPlaying(false));
  }, [id]);

  const togglePlay = useCallback(
    (withPulse = false) => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused || v.ended) {
        play();
        if (withPulse) setPulse({ kind: "play", key: Date.now() });
      } else {
        v.pause();
        if (withPulse) setPulse({ kind: "pause", key: Date.now() });
      }
    },
    [play],
  );

  useEffect(() => {
    if (!autoPlay) return;
    const frame = requestAnimationFrame(() => play());
    return () => cancelAnimationFrame(frame);
  }, [autoPlay, play]);

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    const max = Number.isFinite(v.duration) ? v.duration : duration;
    const next = Math.min(Math.max(0, t), max || t);
    v.currentTime = next;
    setCurrent(next);
    if (v.ended || ended) setEnded(false);
  }, [duration, ended]);

  const skip = useCallback(
    (delta: number, side?: "left" | "right") => {
      const v = videoRef.current;
      if (!v) return;
      seekTo(v.currentTime + delta);
      if (side) setRipple({ side, key: Date.now() });
      wake();
    },
    [seekTo, wake],
  );

  const changeVolume = useCallback((next: number) => {
    const v = Math.min(1, Math.max(0, next));
    setVolume(v);
    setMuted(v === 0);
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (m && volume === 0) {
        setVolume(0.6);
        return false;
      }
      return !m;
    });
  }, [volume]);

  const cycleRate = useCallback(() => {
    setRate((r) => RATES[(RATES.indexOf(r) + 1) % RATES.length]);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!root) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (root.requestFullscreen) {
      void root.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.());
    } else {
      v?.webkitEnterFullscreen?.();
    }
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* not allowed here */
    }
  }, []);

  /* ---- Picture surface: tap / double-tap / keys --------------------------- */
  const onSurfacePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const side: "left" | "right" = e.clientX - rect.left < rect.width / 2 ? "left" : "right";
    const now = Date.now();
    if (lastTap.current && now - lastTap.current.t < 320 && lastTap.current.side === side) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      lastTap.current = null;
      skip(side === "left" ? -SKIP_SECONDS : SKIP_SECONDS, side);
      return;
    }
    lastTap.current = { t: now, side };
    singleTapTimer.current = setTimeout(() => {
      lastTap.current = null;
      if (started) togglePlay(true);
      else play();
    }, 260);
  };

  const onSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Touch is handled in pointerup; here it is the mouse.
    if ((e.nativeEvent as PointerEvent).pointerType === "touch") return;
    if (started) togglePlay(true);
    else play();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT") return;
    switch (e.key) {
      case " ":
      case "k":
      case "K":
        e.preventDefault();
        togglePlay(true);
        break;
      case "ArrowRight":
        e.preventDefault();
        skip(5, "right");
        break;
      case "ArrowLeft":
        e.preventDefault();
        skip(-5, "left");
        break;
      case "l":
      case "L":
        skip(SKIP_SECONDS, "right");
        break;
      case "j":
      case "J":
        skip(-SKIP_SECONDS, "left");
        break;
      case "ArrowUp":
        e.preventDefault();
        changeVolume(volume + 0.1);
        break;
      case "ArrowDown":
        e.preventDefault();
        changeVolume(volume - 0.1);
        break;
      case "m":
      case "M":
        toggleMute();
        break;
      case "f":
      case "F":
        toggleFullscreen();
        break;
      default:
        return;
    }
    wake();
  };

  /* ---- Derived ------------------------------------------------------------ */
  const total = duration || 0;
  const playedFrac = total > 0 ? Math.min(1, current / total) : 0;
  const bufferedFrac = total > 0 ? Math.min(1, buffered / total) : 0;
  const showPoster = !started;
  const level = muted ? 0 : volume;
  const aspect = ratio ?? 16 / 9;
  const rootClass = [
    "pqv",
    className,
    controlsVisible || !started ? "controls-visible" : "controls-hidden",
    started ? "is-started" : "is-idle",
    playing ? "is-playing" : "",
    ended ? "is-ended" : "",
    fullscreen ? "is-fullscreen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={rootRef}
      className={rootClass}
      style={{ aspectRatio: `${aspect}`, maxHeight: fullscreen ? undefined : maxHeight }}
      tabIndex={0}
      role="region"
      aria-label={title ? `Video: ${title}` : "Video"}
      onKeyDown={onKeyDown}
      onMouseMove={wake}
      onMouseLeave={() => {
        if (playing) scheduleHide();
      }}
      onTouchStart={wake}
    >
      {/* Ambient backdrop: the poster blurred behind letterboxed clips */}
      <div
        className={`pqv-ambient ${poster ? "" : "is-gradient"}`}
        style={poster ? { backgroundImage: `url("${poster}")` } : undefined}
        aria-hidden="true"
      />

      <video
        ref={videoRef}
        className="pqv-video"
        src={src}
        preload={autoPlay ? "auto" : "none"}
        playsInline
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          setControlsVisible(true);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (Number.isFinite(v.duration)) setDuration(v.duration);
          if (v.videoWidth && v.videoHeight) {
            setRatio(Math.min(2.2, Math.max(0.5625, v.videoWidth / v.videoHeight)));
          }
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          if (!playing) setCurrent(e.currentTarget.currentTime);
        }}
      />

      {showPoster && poster && (
        <div className="pqv-poster" aria-hidden="true">
          <Image src={poster} alt="" fill sizes="(max-width: 640px) 92vw, 640px" className="object-cover" />
        </div>
      )}

      {/* The picture itself: tap to toggle, double-tap edges to skip */}
      <div
        className="pqv-surface"
        onClick={onSurfaceClick}
        onPointerUp={onSurfacePointerUp}
        onDoubleClick={(e) => {
          if ((e.nativeEvent as PointerEvent).pointerType === "touch") return;
          toggleFullscreen();
        }}
        aria-hidden="true"
      />

      {title && started && <div className="pqv-title">{title}</div>}

      {(!started || ended) && (
        <button
          type="button"
          className="pqv-disc"
          onClick={() => (ended ? (seekTo(0), play()) : play())}
          aria-label={ended ? "Replay" : "Play"}
        >
          {ended ? <ReplayIcon /> : <PlayIcon />}
        </button>
      )}

      {!started && (durationLabel || total > 0) && (
        <span className="pqv-chip" aria-hidden="true">
          {total > 0 ? formatTime(total) : durationLabel}
        </span>
      )}

      {buffering && started && !ended && <div className="pqv-spinner" aria-hidden="true" />}

      {pulse && (
        <div key={pulse.key} className="pqv-pulse" aria-hidden="true" onAnimationEnd={() => setPulse(null)}>
          {pulse.kind === "play" ? <PlayIcon /> : <PauseIcon />}
        </div>
      )}
      {ripple && (
        <div key={ripple.key} className={`pqv-ripple ${ripple.side}`} aria-hidden="true" onAnimationEnd={() => setRipple(null)}>
          {ripple.side === "left" ? `−${SKIP_SECONDS}s` : `+${SKIP_SECONDS}s`}
        </div>
      )}

      {started && (
        <div
          className="pqv-controls"
          onMouseEnter={() => {
            overControls.current = true;
          }}
          onMouseLeave={() => {
            overControls.current = false;
            if (playing) scheduleHide();
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scrubber */}
          <div
            className={`pqv-scrub ${dragging ? "is-dragging" : ""}`}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHoverFrac(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
            }}
            onMouseLeave={() => setHoverFrac(null)}
          >
            <div className="pqv-track">
              <div className="pqv-buffered" style={{ width: `${bufferedFrac * 100}%` }} />
              <div className="pqv-played" style={{ width: `${playedFrac * 100}%` }} />
              <div className="pqv-thumb" style={{ left: `${playedFrac * 100}%` }} />
            </div>
            {hoverFrac !== null && total > 0 && (
              <span className="pqv-tip" style={{ left: `${hoverFrac * 100}%` }}>
                {formatTime(hoverFrac * total)}
              </span>
            )}
            <input
              type="range"
              min={0}
              max={total || 1}
              step={0.05}
              value={Math.min(current, total || current)}
              disabled={total === 0}
              onChange={(e) => seekTo(Number(e.target.value))}
              onPointerDown={() => setDragging(true)}
              onPointerUp={() => setDragging(false)}
              onKeyDown={(e) => e.stopPropagation()}
              aria-label="Seek"
              aria-valuetext={`${formatTime(current)} of ${formatTime(total)}`}
            />
          </div>

          <div className="pqv-row">
            <button type="button" className="pqv-btn" onClick={() => togglePlay()} aria-label={playing ? "Pause" : "Play"} aria-pressed={playing}>
              {playing ? <PauseIcon /> : ended ? <ReplayIcon /> : <PlayIcon />}
            </button>
            <button type="button" className="pqv-btn pqv-skip" onClick={() => skip(-SKIP_SECONDS)} aria-label={`Back ${SKIP_SECONDS} seconds`}>
              <SkipBackIcon />
              <span>{SKIP_SECONDS}</span>
            </button>
            <button type="button" className="pqv-btn pqv-skip" onClick={() => skip(SKIP_SECONDS)} aria-label={`Forward ${SKIP_SECONDS} seconds`}>
              <SkipForwardIcon />
              <span>{SKIP_SECONDS}</span>
            </button>
            <span className="pqv-time" aria-live="off">
              {formatTime(current)} <span className="pqv-time-sep">/</span> {formatTime(total)}
            </span>
            <span className="pqv-spacer" />
            <button type="button" className="pqv-btn pqv-rate" onClick={cycleRate} aria-label={`Playback speed ${rate}×`}>
              {rate}×
            </button>
            <div className="pqv-volume">
              <button type="button" className="pqv-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}>
                {level === 0 ? <MutedIcon /> : <VolumeIcon level={level} />}
              </button>
              <div className="pqv-volume-slider">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={level}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-label="Volume"
                  style={{ ["--pqv-vol" as string]: `${level * 100}%` }}
                />
              </div>
            </div>
            {pipSupported && (
              <button type="button" className="pqv-btn pqv-pip" onClick={togglePip} aria-label="Picture in picture">
                <PipIcon />
              </button>
            )}
            <button type="button" className="pqv-btn" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} aria-pressed={fullscreen}>
              {fullscreen ? <ShrinkIcon /> : <ExpandIcon />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
