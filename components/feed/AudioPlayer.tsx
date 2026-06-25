"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

// =============================================================================
// AudioPlayer — a fully on-brand, reactive audio player for the "Sound" /
// "Voice" post showcases.
//
//   variant="card"  (default) — album-art style: cover + title with a glowing
//                                gradient play button and a live canvas waveform.
//   variant="voice"           — compact single-row bar (play + waveform + time).
//
// The waveform is drawn on a <canvas> and, while playing, reacts to the actual
// audio via a Web Audio AnalyserNode (Supabase public storage serves CORS `*`,
// so routing the element through Web Audio does NOT mute playback). When the
// analyser is unavailable it falls back to a deterministic, gently-animated
// "resting" waveform — so it always looks alive. Played bars are filled with the
// brand gradient (purple → pink → orange); upcoming bars are dimmed. Click or use
// the keyboard on the bar to seek.
//
// Brand rules: full subtle bg + full matching border (no accent-line borders);
// theme tokens only (the canvas reads --color-* live, so it adapts to themes).
// Only one AudioPlayer plays at a time via a module-level registry.
// =============================================================================

// --- Module-level "currently playing" coordination ---------------------------
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

// Deterministic "resting" waveform derived from the src — so the same track
// always renders the same shape, and it reads like a real waveform envelope.
function seededBars(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    // Soft bell envelope so the middle of the track "swells" a little.
    const env = 0.6 + 0.4 * Math.sin((i / Math.max(1, count - 1)) * Math.PI);
    const v = 0.28 + rand() * 0.72;
    bars.push(Math.min(1, v * env));
  }
  return bars;
}

function pathRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [metadataDuration, setMetadataDuration] = useState<number | null>(null);

  const total =
    durationSec && Number.isFinite(durationSec) && durationSec > 0
      ? durationSec
      : metadataDuration ?? 0;

  const barCount = variant === "voice" ? 44 : 60;

  // --- Web Audio + canvas refs ----------------------------------------------
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const freqDataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const barsRef = useRef<number[]>([]); // current animated heights (eased)
  const restRef = useRef<number[]>(seededBars(src, barCount)); // resting shape
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const colorsRef = useRef({
    purple: "#8e44ad",
    pink: "#ff007f",
    orange: "#ff9f43",
    ink: "#1e1e1e",
  });

  // Read the live theme tokens off the canvas so the waveform matches whatever
  // theme is active (and updates when it changes).
  const readColors = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const get = (v: string, fallback: string) => cs.getPropertyValue(v).trim() || fallback;
    colorsRef.current = {
      purple: get("--color-purple-primary", "#8e44ad"),
      pink: get("--color-pink-vivid", "#ff007f"),
      orange: get("--color-orange-warm", "#ff9f43"),
      ink: get("--color-ink", "#1e1e1e"),
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const rest = restRef.current;
    const count = rest.length;
    const gap = Math.max(1.5, (cssW / count) * 0.34);
    const barW = Math.max(1.5, (cssW - gap * (count - 1)) / count);
    const cy = cssH / 2;
    const maxH = cssH * 0.94;
    const minH = Math.max(2, cssH * 0.07);

    // Targets: live frequency data while playing, resting shape otherwise.
    const analyser = analyserRef.current;
    const freq = freqDataRef.current;
    const targets = new Array<number>(count);
    if (playingRef.current && analyser && freq) {
      analyser.getByteFrequencyData(freq as Uint8Array<ArrayBuffer>);
      const usable = Math.max(1, Math.floor(freq.length * 0.72)); // skip empty top bins
      for (let i = 0; i < count; i++) {
        const idx = Math.floor((i / count) * usable);
        const v = freq[idx] / 255;
        // Blend with resting shape so silent passages still show texture.
        targets[i] = Math.max(rest[i] * 0.22, Math.min(1, v * 1.15));
      }
    } else {
      for (let i = 0; i < count; i++) {
        targets[i] = playingRef.current ? rest[i] : rest[i] * 0.82;
      }
    }

    const bars = barsRef.current;
    const ease = playingRef.current ? 0.42 : 0.16;

    const grad = ctx.createLinearGradient(0, 0, cssW, 0);
    grad.addColorStop(0, colorsRef.current.purple);
    grad.addColorStop(0.5, colorsRef.current.pink);
    grad.addColorStop(1, colorsRef.current.orange);

    const progress = progressRef.current;
    for (let i = 0; i < count; i++) {
      const prev = bars[i] ?? 0;
      const next = prev + (targets[i] - prev) * ease;
      bars[i] = next;
      const h = Math.max(minH, next * maxH);
      const x = i * (barW + gap);
      const fraction = (i + 0.5) / count;
      const played = fraction <= progress;
      ctx.beginPath();
      pathRoundRect(ctx, x, cy - h / 2, barW, h, barW / 2);
      if (played) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = grad;
      } else {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = colorsRef.current.ink;
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, []);

  // Run the animation loop while playing; when paused, keep ticking only until
  // the bars have eased back to their resting state, then idle.
  const ensureLoop = useCallback(() => {
    if (rafRef.current != null) return;
    const loop = () => {
      draw();
      let settled = true;
      if (!playingRef.current) {
        const bars = barsRef.current;
        const rest = restRef.current;
        for (let i = 0; i < rest.length; i++) {
          if (Math.abs((bars[i] ?? 0) - rest[i] * 0.82) > 0.008) {
            settled = false;
            break;
          }
        }
      } else {
        settled = false;
      }
      if (settled) {
        rafRef.current = null;
      } else {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  // Lazily build the Web Audio graph on first play (must follow a user gesture).
  const setupAudioGraph = useCallback(() => {
    if (sourceRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      // Analyser unavailable (e.g. unexpected CORS) — the resting/animated
      // fallback keeps the waveform looking alive, playback still works.
    }
  }, []);

  // Keep refs in sync with the resolved src (resting shape is src-derived).
  useEffect(() => {
    restRef.current = seededBars(src, barCount);
    barsRef.current = [];
    ensureLoop();
  }, [src, barCount, ensureLoop]);

  // Reflect progress into the canvas; redraw on seek while paused.
  useEffect(() => {
    progressRef.current = total > 0 ? Math.min(1, currentTime / total) : 0;
    if (!playingRef.current) ensureLoop();
  }, [currentTime, total, ensureLoop]);

  // Mount: register pause coordination, read colors, observe resize + theme.
  useEffect(() => {
    const pause = () => {
      audioRef.current?.pause();
    };
    activePlayers.add(pause);

    readColors();
    ensureLoop();

    const canvas = canvasRef.current;
    let resizeObs: ResizeObserver | null = null;
    if (canvas && typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(() => ensureLoop());
      resizeObs.observe(canvas);
    }

    let themeObs: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      themeObs = new MutationObserver(() => {
        readColors();
        ensureLoop();
      });
      themeObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "style"],
      });
    }

    return () => {
      activePlayers.delete(pause);
      resizeObs?.disconnect();
      themeObs?.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        void audioCtxRef.current?.close();
      } catch {
        // ignore teardown errors
      }
    };
  }, [readColors, ensureLoop]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setupAudioGraph();
      void audioCtxRef.current?.resume();
      pauseOthers(() => audio.pause());
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [setupAudioGraph]);

  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Number(event.target.value);
    audio.currentTime = next;
    setCurrentTime(next);
  }, []);

  const progressMax = total > 0 ? total : 0;

  // The waveform: a canvas with a transparent range input overlaid for
  // accessible, draggable, keyboard-operable seeking.
  const waveform = (heightClass: string) => (
    <div className={`relative w-full ${heightClass}`}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
      <input
        type="range"
        min={0}
        max={progressMax || 1}
        step={0.05}
        value={Math.min(currentTime, progressMax || currentTime)}
        onChange={handleSeek}
        disabled={progressMax === 0}
        aria-label="Seek"
        aria-valuetext={`${formatTime(currentTime)} of ${formatTime(total)}`}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default [&::-webkit-slider-thumb]:h-full [&::-webkit-slider-thumb]:w-1 [&::-webkit-slider-thumb]:appearance-none"
      />
    </div>
  );

  const playButton = (sizeClasses: string) => (
    <button
      type="button"
      onClick={togglePlay}
      aria-label={isPlaying ? "Pause" : "Play"}
      aria-pressed={isPlaying}
      className={`group relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm text-white shadow-[0_6px_20px_-6px_color-mix(in_oklab,var(--color-pink-vivid)_70%,transparent)] transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-vivid focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${sizeClasses}`}
    >
      {isPlaying ? <PauseIcon /> : <PlayIcon />}
    </button>
  );

  const audioElement = (
    <audio
      ref={audioRef}
      src={src}
      crossOrigin="anonymous"
      preload="metadata"
      onPlay={() => {
        setIsPlaying(true);
        playingRef.current = true;
        ensureLoop();
      }}
      onPause={() => {
        setIsPlaying(false);
        playingRef.current = false;
        void audioCtxRef.current?.suspend();
        ensureLoop();
      }}
      onEnded={() => {
        setIsPlaying(false);
        playingRef.current = false;
        setCurrentTime(0);
        ensureLoop();
      }}
      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      onLoadedMetadata={(e) => {
        const d = e.currentTarget.duration;
        if (Number.isFinite(d) && d > 0) setMetadataDuration(d);
      }}
    />
  );

  const timeLabel = (
    <span className="shrink-0 text-xs tabular-nums text-muted">
      {formatTime(currentTime)} / {formatTime(total)}
    </span>
  );

  // --- Voice variant: compact single row ------------------------------------
  if (variant === "voice") {
    return (
      <div className="flex w-full items-center gap-3 rounded-2xl border border-border-light bg-gradient-to-br from-purple-primary/[0.06] via-pink-vivid/[0.05] to-orange-warm/[0.06] px-3 py-2.5">
        {audioElement}
        {playButton("h-10 w-10")}
        <div className="min-w-0 flex-1">{waveform("h-9")}</div>
        {timeLabel}
      </div>
    );
  }

  // --- Card variant: album-art style ----------------------------------------
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border-light bg-gradient-to-br from-purple-primary/[0.07] via-pink-vivid/[0.05] to-orange-warm/[0.07] p-3.5">
      {audioElement}
      <div className="flex items-center gap-3.5">
        {cover ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-border-light ring-1 ring-pink-vivid/20">
            <Image src={cover} alt={title ? `${title} cover art` : "Cover art"} fill sizes="64px" className="object-cover" />
          </div>
        ) : (
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm text-white shadow-[0_8px_24px_-10px_color-mix(in_oklab,var(--color-purple-primary)_80%,transparent)]"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{title || "Sound"}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-muted">
            {isPlaying ? "Now playing" : "Tap to play"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        {playButton("h-11 w-11")}
        <div className="min-w-0 flex-1">{waveform("h-12")}</div>
      </div>
      <div className="mt-1.5 pl-[3.5rem]">{timeLabel}</div>
    </div>
  );
}
