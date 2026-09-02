"use client";

import "./takes.css";

import { useRef, useState, useEffect, useCallback, type CSSProperties } from "react";

interface TakePlayerProps {
  src: string;
  isActive: boolean;
  isMuted: boolean;
  volume: number;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onToggleMute?: () => void;
  onPlayStart?: () => void;
  onPauseStop?: () => void;
  onLoop?: () => void;
  onComplete?: () => void;
  playbackRate?: number;
  videoStyle?: CSSProperties;
  soundSrc?: string | null;
  soundStartTime?: number;
  soundVolume?: number;
  originalVolume?: number;
}

export default function TakePlayer({
  src,
  isActive,
  isMuted,
  volume,
  onTap,
  onDoubleTap,
  onToggleMute,
  onPlayStart,
  onPauseStop,
  onLoop,
  onComplete,
  playbackRate = 1,
  videoStyle,
  soundSrc,
  soundStartTime = 0,
  soundVolume = 100,
  originalVolume = 100,
}: TakePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPausedOverlay, setShowPausedOverlay] = useState(false);

  const lastTapRef = useRef(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const pausedOverlayTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastPlaybackTimeRef = useRef(0);
  const completionReportedRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup all timeouts on unmount to prevent state updates on unmounted component
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (pausedOverlayTimeoutRef.current) clearTimeout(pausedOverlayTimeoutRef.current);
    };
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  const playMedia = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    video.playbackRate = playbackRate;
    video.play().catch(() => {});

    if (audio && soundSrc) {
      if (audio.paused || audio.ended) {
        audio.currentTime = Math.min(soundStartTime, Math.max(0, audio.duration || soundStartTime));
      }
      audio.play().catch(() => {});
    }
  }, [playbackRate, soundSrc, soundStartTime]);

  const pauseMedia = useCallback(() => {
    videoRef.current?.pause();
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    // Clear pending tap timeout when isActive changes to prevent stale state updates
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = undefined;
    }

    if (isActive) {
      playMedia();
    } else {
      pauseMedia();
      video.currentTime = 0;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      lastPlaybackTimeRef.current = 0;
      completionReportedRef.current = false;
      setProgress(0);
    }
  }, [isActive, pauseMedia, playMedia]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted || originalVolume === 0;
    }
    if (audioRef.current) {
      audioRef.current.muted = isMuted || soundVolume === 0;
    }
  }, [isMuted, originalVolume, soundVolume]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, volume * (originalVolume / 100)));
    }
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume * (soundVolume / 100)));
    }
  }, [volume, originalVolume, soundVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !soundSrc) return;
    audio.src = soundSrc;
    audio.currentTime = soundStartTime;
    if (isActive) {
      audio.play().catch(() => {});
    }
  }, [isActive, soundSrc, soundStartTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    const updateProgress = () => {
      if (video.duration) {
        const currentProgress = (video.currentTime / video.duration) * 100;
        setProgress(currentProgress);

        if (!completionReportedRef.current && currentProgress >= 95) {
          completionReportedRef.current = true;
          onComplete?.();
        }

        if (lastPlaybackTimeRef.current > 0 && video.currentTime < lastPlaybackTimeRef.current - 0.75) {
          completionReportedRef.current = false;
          if (audioRef.current && soundSrc) {
            audioRef.current.currentTime = soundStartTime;
            if (!video.paused) audioRef.current.play().catch(() => {});
          }
          onLoop?.();
        }

        lastPlaybackTimeRef.current = video.currentTime;
      }
    };

    video.addEventListener("timeupdate", updateProgress);
    return () => video.removeEventListener("timeupdate", updateProgress);
  }, [isActive, onComplete, onLoop, soundSrc, soundStartTime]);

  // Show paused overlay briefly when video is paused
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isPlaying && isActive && !isLoading && !hasError) {
      setShowPausedOverlay(true);
      // Clear any existing timeout
      if (pausedOverlayTimeoutRef.current) {
        clearTimeout(pausedOverlayTimeoutRef.current);
      }
      // Auto-hide after 3 seconds
      pausedOverlayTimeoutRef.current = setTimeout(() => {
        setShowPausedOverlay(false);
      }, 3000);
    } else {
      setShowPausedOverlay(false);
    }

    return () => {
      if (pausedOverlayTimeoutRef.current) {
        clearTimeout(pausedOverlayTimeoutRef.current);
      }
    };
  }, [isPlaying, isActive, isLoading, hasError]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleTap = useCallback(() => {
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
              playMedia();
            } else {
              pauseMedia();
            }
          }
        }
      }, 300);
    }

    lastTapRef.current = now;
  }, [onTap, onDoubleTap, pauseMedia, playMedia]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    videoRef.current?.load();
  }, []);

  const handleMuteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleMute?.();
    // Keep overlay visible for a bit longer after interaction
    if (pausedOverlayTimeoutRef.current) {
      clearTimeout(pausedOverlayTimeoutRef.current);
    }
    pausedOverlayTimeoutRef.current = setTimeout(() => {
      setShowPausedOverlay(false);
    }, 3000);
  }, [onToggleMute]);

  return (
    <div className="tiktok-player" onClick={handleTap}>
      <video
        ref={videoRef}
        src={src}
        className="tiktok-player-video"
        playsInline
        loop
        muted={isMuted || originalVolume === 0}
        preload={isActive ? "auto" : "metadata"}
        style={videoStyle}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onPlay={() => {
          setIsPlaying(true);
          onPlayStart?.();
        }}
        onPause={() => {
          setIsPlaying(false);
          onPauseStop?.();
        }}
        onEnded={() => {
          completionReportedRef.current = true;
          onComplete?.();
        }}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
          onPauseStop?.();
        }}
      />

      {soundSrc && (
        <audio
          ref={audioRef}
          preload={isActive ? "auto" : "metadata"}
          loop
          muted={isMuted || soundVolume === 0}
        />
      )}

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

      {/* Paused state - Play button + Mute toggle (Instagram style on mobile) */}
      {showPausedOverlay && (
        <div className="tiktok-player-overlay tiktok-paused-overlay">
          {/* Play button */}
          <div className="tiktok-play-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>

          {/* Mobile mute toggle - positioned at bottom right of overlay */}
          <button
            className="tiktok-mobile-mute-btn"
            onClick={handleMuteClick}
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
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
