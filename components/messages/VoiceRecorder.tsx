"use client";

import { useState, useRef, useEffect } from "react";
import { useVoiceRecorder, useAudioPlayer } from "@/lib/hooks";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, duration: number, waveformData: number[]) => void;
  onCancel: () => void;
  maxDuration?: number;
  disabled?: boolean;
}

const icons = {
  mic: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  ),
  stop: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  send: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  play: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  pause: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  close: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Live animated waveform for recording - full width
function LiveWaveform({ data }: { data: number[] }) {
  const barCount = 50;

  // Get the last N samples for display
  const getDisplayData = () => {
    if (data.length === 0) {
      return Array(barCount).fill(0.1);
    }
    const recentData = data.slice(-barCount);
    if (recentData.length < barCount) {
      const padding = Array(barCount - recentData.length).fill(0.1);
      return [...padding, ...recentData];
    }
    return recentData;
  };

  const displayData = getDisplayData();

  return (
    <div className="flex items-center justify-between h-8 flex-1 px-1">
      {displayData.map((amplitude, index) => {
        const height = Math.max(4, Math.min(28, (amplitude + 0.05) * 35));
        const hue = 280 + (index / barCount) * 40;
        const saturation = 70 + amplitude * 30;
        const lightness = 50 + amplitude * 10;

        return (
          <div
            key={index}
            className="rounded-full transition-all duration-75"
            style={{
              width: '3px',
              height: `${height}px`,
              backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
            }}
          />
        );
      })}
    </div>
  );
}

// Playback waveform with progress - full width
function PlaybackWaveform({
  data,
  progress = 0,
  onClick,
}: {
  data: number[];
  progress?: number;
  onClick?: (progress: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const barCount = 50;

  const getNormalizedData = () => {
    if (data.length === 0) {
      return Array(barCount).fill(0.15);
    }
    if (data.length <= barCount) {
      const result = [...data];
      while (result.length < barCount) {
        result.push(0.15);
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
      result.push(max || 0.15);
    }
    return result;
  };

  const normalizedData = getNormalizedData();
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
      className="flex items-center justify-between h-8 flex-1 cursor-pointer px-1"
      onClick={handleClick}
    >
      {normalizedData.map((amplitude, index) => {
        const height = Math.max(4, Math.min(28, amplitude * 30));
        const isPlayed = index < progressIndex;

        return (
          <div
            key={index}
            className="rounded-full"
            style={{
              width: '3px',
              height: `${height}px`,
              backgroundColor: isPlayed ? '#8e44ad' : 'rgba(142, 68, 173, 0.3)',
            }}
          />
        );
      })}
    </div>
  );
}

export default function VoiceRecorder({
  onSend,
  onCancel,
  maxDuration = 300,
  disabled = false,
}: VoiceRecorderProps) {
  const [mode, setMode] = useState<"idle" | "recording" | "preview">("idle");
  const recorder = useVoiceRecorder(maxDuration);
  const player = useAudioPlayer(recorder.audioUrl);

  // Auto-start recording when component mounts
  useEffect(() => {
    if (mode === "idle") {
      recorder.startRecording();
      setMode("recording");
    }
  }, []);

  // Handle mode transitions
  useEffect(() => {
    if (!recorder.isRecording && recorder.audioBlob && mode === "recording") {
      setMode("preview");
    }
  }, [recorder.isRecording, recorder.audioBlob, mode]);

  const handleStopRecording = () => {
    recorder.stopRecording();
  };

  const handleSend = () => {
    if (recorder.audioBlob && recorder.duration > 0) {
      onSend(recorder.audioBlob, recorder.duration, recorder.waveformData);
      recorder.reset();
      setMode("idle");
    }
  };

  const handleCancel = () => {
    recorder.cancelRecording();
    setMode("idle");
    onCancel();
  };

  const handleSeek = (progress: number) => {
    if (player.duration > 0) {
      player.seek(progress * player.duration);
    }
  };

  const timeRemaining = maxDuration - recorder.duration;
  const isNearLimit = timeRemaining <= 10;
  const progress = player.duration > 0 ? player.currentTime / player.duration : 0;

  // Recording state
  if (mode === "recording") {
    return (
      <div className="flex items-center gap-3 py-2 w-full">
        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-purple-primary hover:bg-purple-primary/10 transition-all"
          title="Cancel"
        >
          {icons.close}
        </button>

        {/* Recording indicator - pulsing gradient dot */}
        <div className="relative">
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid animate-pulse" />
          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid animate-ping opacity-50" />
        </div>

        {/* Live Waveform - moves with voice */}
        <LiveWaveform data={recorder.waveformData} />

        {/* Duration */}
        <span className={`font-ui text-sm min-w-[40px] text-right ${
          isNearLimit ? 'text-pink-vivid font-semibold' : 'text-muted'
        }`}>
          {formatDuration(recorder.duration)}
        </span>

        {/* Stop button - purple gradient */}
        <button
          onClick={handleStopRecording}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center hover:opacity-90 hover:scale-105 transition-all shadow-md"
          title="Stop recording"
        >
          {icons.stop}
        </button>
      </div>
    );
  }

  // Preview state
  if (mode === "preview") {
    return (
      <div className="flex items-center gap-3 py-2 w-full">
        {/* Delete button */}
        <button
          onClick={handleCancel}
          className="w-8 h-8 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 transition-all"
          title="Delete"
        >
          {icons.trash}
        </button>

        {/* Play/Pause button */}
        <button
          onClick={player.toggle}
          className="w-8 h-8 rounded-full bg-purple-primary text-white flex items-center justify-center hover:bg-purple-primary/90 transition-all"
          title={player.isPlaying ? "Pause" : "Play"}
        >
          {player.isPlaying ? icons.pause : icons.play}
        </button>

        {/* Waveform with progress */}
        <PlaybackWaveform
          data={recorder.waveformData}
          progress={progress}
          onClick={handleSeek}
        />

        {/* Duration */}
        <span className="font-ui text-sm text-muted min-w-[40px] text-right">
          {player.isPlaying || player.currentTime > 0
            ? formatDuration(Math.floor(player.currentTime))
            : formatDuration(recorder.duration)}
        </span>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={disabled}
          className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50"
          title="Send voice note"
        >
          {icons.send}
        </button>
      </div>
    );
  }

  // Loading/starting state
  return (
    <div className="flex items-center gap-3 py-2 w-full">
      <div className="w-5 h-5 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
      <span className="font-ui text-sm text-muted">Starting...</span>
    </div>
  );
}
