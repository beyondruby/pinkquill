"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface TakePlayerProps {
  src: string;
  isActive: boolean;
  isMuted: boolean;
  volume: number;
  onTap?: () => void;
  onDoubleTap?: () => void;
}

export default function TakePlayer({
  src,
  isActive,
  isMuted,
  volume,
  onTap,
  onDoubleTap,
}: TakePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [progress, setProgress] = useState(0);

  const lastTapRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
      setProgress(0);
    }
  }, [isActive]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [isActive]);

  const handleTap = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      clearTimeout(tapTimeoutRef.current);
      onDoubleTap?.();
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        if (onTap) {
          onTap();
        } else {
          const video = videoRef.current;
          if (video) {
            if (video.paused) {
              video.play();
            } else {
              video.pause();
            }
          }
        }
      }, 300);
    }

    lastTapRef.current = now;
  }, [onTap, onDoubleTap]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    videoRef.current?.load();
  }, []);

  return (
    <div className="tiktok-player" onClick={handleTap}>
      <video
        ref={videoRef}
        src={src}
        className="tiktok-player-video"
        playsInline
        loop
        muted={isMuted}
        preload={isActive ? "auto" : "metadata"}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />

      {/* Progress bar */}
      <div className="tiktok-progress">
        <div className="tiktok-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Loading state */}
      {isLoading && isActive && !hasError && (
        <div className="tiktok-player-overlay">
          <div className="tiktok-spinner" />
        </div>
      )}

      {/* Paused state - branded play button */}
      {!isPlaying && isActive && !isLoading && !hasError && (
        <div className="tiktok-player-overlay">
          <div className="tiktok-play-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="tiktok-player-error">
          <div className="tiktok-error-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p>Failed to load video</p>
          <button onClick={(e) => { e.stopPropagation(); handleRetry(); }} className="tiktok-retry-btn">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
