"use client";

import type { CSSProperties, DragEvent, ReactNode, RefObject } from "react";
import type { Sound, TakeAspectRatio, TakePlaybackSpeed } from "@/lib/hooks/useTakes";
import { icons } from "@/components/ui/Icons";

/**
 * The Take editor, in pieces. `/takes/create` and the composer's Take mode
 * keep their own state and upload logic; these render the shared controls so
 * a filter, a speed or a cover looks and behaves the same in both places.
 */

const musicIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
  </svg>
);

const videoIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10l5-3v10l-5-3" />
  </svg>
);

const imageIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 16l5-5 4 4 3-3 6 6" />
    <circle cx="16" cy="9" r="1.5" />
  </svg>
);

export function formatSeconds(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/* ---- Dropzone ------------------------------------------------------------ */

export function TakeDropzone({
  active,
  inputRef,
  onFile,
  onDrop,
  onDragOver,
  onDragLeave,
}: {
  active: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
}) {
  const open = () => inputRef.current?.click();
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add your video"
      className="pq-dropzone pq-dropzone--stage"
      data-active={active || undefined}
      style={active ? { borderColor: "var(--color-action)", background: "var(--color-tint)" } : undefined}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      {videoIcon}
      <strong>Add your video</strong>
      <small>Drag it here or tap to choose · MP4 or MOV · up to 3 minutes · 200MB</small>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/mov"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
        className="hidden"
        tabIndex={-1}
      />
    </div>
  );
}

/* ---- Preview ------------------------------------------------------------- */

export function TakePreview({
  videoRef,
  src,
  aspectRatio,
  filterStyle,
  muted,
  playing,
  onToggle,
  onLoadedData,
  onRemove,
  badges,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  aspectRatio: TakeAspectRatio;
  filterStyle?: CSSProperties;
  muted: boolean;
  playing: boolean;
  onToggle: () => void;
  onLoadedData?: () => void;
  onRemove: () => void;
  badges?: ReactNode;
}) {
  return (
    <div className="pq-take-preview" style={{ aspectRatio: aspectRatio.replace(":", " / ") }}>
      <video
        ref={videoRef}
        src={src}
        className="pq-take-preview__video"
        style={filterStyle}
        loop
        playsInline
        muted={muted}
        onClick={onToggle}
        onLoadedData={onLoadedData}
      />
      <button
        type="button"
        className="pq-take-preview__toggle"
        onClick={onToggle}
        aria-pressed={playing}
        aria-label={playing ? "Pause preview" : "Play preview"}
      >
        {playing ? icons.pause : icons.play}
      </button>
      <button type="button" className="pq-take-preview__remove" onClick={onRemove} aria-label="Remove video">
        {icons.close}
      </button>
      {badges && <div className="pq-take-preview__badges">{badges}</div>}
    </div>
  );
}

export function PreviewBadge({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="pq-take-preview__badge">
      {icon}
      <span>{children}</span>
    </span>
  );
}

/* ---- Choices -------------------------------------------------------------- */

export function TakeFilterChoice({
  options,
  value,
  onChange,
}: {
  options: { name: string; label: string; style?: CSSProperties }[];
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="pq-take-filters" role="radiogroup" aria-label="Filter">
      {options.map((filter) => (
        <button
          key={filter.name}
          type="button"
          role="radio"
          aria-checked={value === filter.name}
          className="pq-take-filter"
          onClick={() => onChange(filter.name)}
        >
          <span className="pq-take-filter__swatch" style={filter.style} aria-hidden="true" />
          {filter.label}
        </button>
      ))}
    </div>
  );
}

export function TakeSegmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="pq-segmented flex-wrap" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className="pq-segmented__option"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const TAKE_SPEED_LABELS: { value: TakePlaybackSpeed; label: string }[] = [
  { value: 0.25, label: "0.25×" },
  { value: 0.5, label: "0.5×" },
  { value: 0.75, label: "0.75×" },
  { value: 1.0, label: "1×" },
  { value: 1.5, label: "1.5×" },
  { value: 2.0, label: "2×" },
  { value: 3.0, label: "3×" },
];

export function TakeRange({
  id,
  label,
  value,
  min,
  max,
  onChange,
  format = (v) => String(v),
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <div className="pq-range-row">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="pq-range" />
      <output htmlFor={id}>{format(value)}</output>
    </div>
  );
}

/* ---- Cover ----------------------------------------------------------------- */

export function TakeCoverChoice({
  fromVideo,
  custom,
  onUseFrame,
  inputRef,
  onCustomFile,
}: {
  fromVideo: string | null;
  custom: string | null;
  onUseFrame: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onCustomFile: (file: File) => void;
}) {
  return (
    <div className="pq-take-covers" role="radiogroup" aria-label="Cover image">
      <button type="button" role="radio" aria-checked={!custom} className="pq-take-cover" onClick={onUseFrame} disabled={!fromVideo}>
        {fromVideo ? <img src={fromVideo} alt="" /> : <span>Add a video to capture a frame</span>}
        {fromVideo && <span className="pq-take-cover__label">From the video</span>}
      </button>
      <button type="button" role="radio" aria-checked={Boolean(custom)} className="pq-take-cover" onClick={() => inputRef.current?.click()}>
        {custom ? (
          <>
            <img src={custom} alt="" />
            <span className="pq-take-cover__label">Your image</span>
          </>
        ) : (
          <span className="grid justify-items-center gap-1">
            <span className="w-6 h-6">{imageIcon}</span>
            Upload an image
            <small>JPG or PNG, up to 5MB</small>
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file.type.startsWith("image/")) onCustomFile(file);
          }}
        />
      </button>
    </div>
  );
}

/* ---- Sound ----------------------------------------------------------------- */

export function TakeSoundRow({ sound, onRemove, trailing }: { sound: Sound; onRemove: () => void; trailing?: ReactNode }) {
  return (
    <div className="pq-sound">
      <span className="pq-sound__icon">
        {sound.cover_url ? <img src={sound.cover_url} alt="" className="pq-sound__art" /> : <span className="w-5 h-5">{musicIcon}</span>}
      </span>
      <div className="pq-sound__meta">
        <strong className="block truncate">{sound.name}</strong>
        <small className="truncate">{sound.artist || "Original sound"}{sound.use_count ? ` · ${sound.use_count} uses` : ""}</small>
      </div>
      {trailing}
      <button type="button" className="pq-icon-button" onClick={onRemove} aria-label="Remove sound">
        {icons.close}
      </button>
    </div>
  );
}

export function TakeSoundList({
  sounds,
  loading,
  onSelect,
  onPreview,
  playingUrl,
}: {
  sounds: Sound[];
  loading: boolean;
  onSelect: (sound: Sound) => void;
  onPreview?: (sound: Sound) => void;
  playingUrl?: string | null;
}) {
  if (loading) return <p className="pq-discussion__state">Searching…</p>;
  if (sounds.length === 0) return <p className="pq-discussion__state">No sounds match.</p>;
  return (
    <div className="pq-take-sound-list">
      {sounds.map((sound) => (
        <div key={sound.id} className="flex items-center gap-1">
          <button type="button" className="pq-take-sound-item" onClick={() => onSelect(sound)}>
            <span className="pq-take-sound-item__art">
              {sound.cover_url ? <img src={sound.cover_url} alt="" /> : musicIcon}
            </span>
            <span className="pq-take-sound-item__meta">
              <strong>{sound.name}</strong>
              <small>{sound.artist || "Original"}{sound.use_count ? ` · ${sound.use_count} uses` : ""}</small>
            </span>
          </button>
          {onPreview && (
            <button
              type="button"
              className="pq-icon-button"
              onClick={() => onPreview(sound)}
              aria-label={playingUrl === sound.audio_url ? `Pause ${sound.name}` : `Preview ${sound.name}`}
              aria-pressed={playingUrl === sound.audio_url}
            >
              {playingUrl === sound.audio_url ? icons.pause : icons.play}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export { musicIcon as takeMusicIcon };
