"use client";

import { useState, useRef } from "react";
import { useAudioPlayer } from "@/lib/hooks/useMedia";

interface VoiceNotePlayerProps {
  audioUrl: string;
  duration: number;
  waveformData: number[];
  isOwn: boolean;
  onError?: () => void;
}

const icons = {
  play: (
    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  pause: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  ),
  loading: (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Waveform for chat messages
function ChatWaveform({
  data,
  progress,
  isOwn,
  onClick,
}: {
  data: number[];
  progress: number;
  isOwn: boolean;
  onClick?: (progress: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barCount = 28;

  const normalizedData = (() => {
    if (data.length === 0) {
      return Array(barCount).fill(0.2);
    }
    if (data.length <= barCount) {
      const result = [...data];
      while (result.length < barCount) {
        result.push(0.2);
      }
      return result;
    }
    const result: number[] = [];
    const ratio = data.length / barCount;
    for (let i = 0; i < barCount; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.floor((i + 1) * ratio);
      let max = 0;
      for (let j = start; j < end && j < data.length; j++) {
        max = Math.max(max, data[j]);
      }
      result.push(max || 0.2);
    }
    return result;
  })();

  const progressIndex = Math.floor(progress * barCount);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onClick || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newProgress = x / rect.width;
    onClick(Math.max(0, Math.min(1, newProgress)));
  };

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-[2px] h-6 cursor-pointer flex-1"
      onClick={handleClick}
    >
      {normalizedData.map((amplitude, index) => {
        const height = Math.max(3, Math.min(22, amplitude * 24));
        const isPlayed = index < progressIndex;

        return (
          <div
            key={index}
            className="rounded-full transition-all duration-100"
            style={{
              width: '2.5px',
              height: `${height}px`,
              background: isPlayed ? "var(--color-action)" : "var(--color-line-strong)",
            }}
          />
        );
      })}
    </div>
  );
}

export default function VoiceNotePlayer({
  audioUrl,
  duration,
  waveformData,
  isOwn,
  onError,
}: VoiceNotePlayerProps) {
  const player = useAudioPlayer(audioUrl);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const progress = player.duration > 0 ? player.currentTime / player.duration : 0;

  const handlePlaybackSpeedChange = () => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    player.setPlaybackRate(nextSpeed);
  };

  const handleSeek = (newProgress: number) => {
    const seekTime = newProgress * (player.duration || duration);
    player.seek(seekTime);
  };

  if (player.error && onError) {
    onError();
  }

  return (
    <div className="pq-voice">
      <button type="button" className="pq-voice__play" onClick={player.toggle} disabled={player.isLoading} aria-label={player.isPlaying ? "Pause voice note" : "Play voice note"}>
        {player.isLoading ? icons.loading : player.isPlaying ? icons.pause : icons.play}
      </button>
      <div className="pq-voice__body">
        <ChatWaveform data={waveformData} progress={progress} isOwn={isOwn} onClick={handleSeek} />
        <div className="pq-voice__meta">
          <span>{player.isPlaying || player.currentTime > 0 ? formatDuration(player.currentTime) : formatDuration(duration)}</span>
          <button type="button" className="pq-voice__speed" onClick={handlePlaybackSpeedChange} aria-label={`Playback speed ${playbackSpeed}x`}>
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </div>
  );
}
