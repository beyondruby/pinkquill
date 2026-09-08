"use client";

import TakePlayer from "@/components/takes/TakePlayer";
import { ContentWarningOverlay } from "@/components/feed/post-detail/ContentWarningOverlay";
import { icons } from "@/components/ui/Icons";
import { TAKE_ASPECT_CLASS, type Take } from "@/lib/hooks/useTakes";
import type { TakeDetailActions } from "./useTakeDetailActions";

interface Props {
  take: Take;
  actions: TakeDetailActions;
  isActive: boolean;
  /** Sizing of the frame inside its surface (the modal is height-bound, the page width-bound). */
  frameClassName?: string;
}

/**
 * The take inside its own aspect frame with the content-warning cover, the
 * mute button and the duration badge — the same on the modal and the page
 * (V-52; the frame follows `aspect_ratio` so nothing is cropped, V-19 page half).
 */
export function TakeVideoFrame({ take, actions, isActive, frameClassName = "" }: Props) {
  const { player, showContent, revealContent } = actions;
  const { isMuted, toggleMute, volume, videoStyle, tracking } = player;
  const hidden = !!take.content_warning && !showContent;
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
      <div className={`relative bg-black ${TAKE_ASPECT_CLASS[take.aspect_ratio] ?? "aspect-[9/16]"} ${frameClassName}`}>
        <div className={`absolute inset-0 ${hidden ? "blur-xl" : ""}`}>
          <TakePlayer
            src={take.video_url}
            isActive={isActive && showContent}
            isMuted={isMuted}
            volume={volume}
            onToggleMute={toggleMute}
            onPlayStart={tracking.startWatching}
            onPauseStop={tracking.stopWatching}
            onLoop={tracking.recordLoop}
            onComplete={tracking.recordCompletion}
            playbackRate={take.playback_speed}
            videoStyle={videoStyle}
            soundSrc={take.sound?.audio_url}
            soundStartTime={take.sound_start_time}
            soundVolume={take.added_sound_volume}
            originalVolume={take.original_audio_volume}
          />
        </div>

        {hidden && <ContentWarningOverlay variant="video" warning={take.content_warning!} onShow={revealContent} />}

        {/* The player only offers mute while paused, so the frame keeps its own button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
          }}
          aria-label={isMuted ? "Unmute" : "Mute"}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          {isMuted ? icons.volumeOff : icons.volumeOn}
        </button>

        {take.duration > 0 && (
          <div className="absolute bottom-4 right-4 z-20 px-2 py-1 rounded bg-black/60 backdrop-blur-sm pointer-events-none">
            <span className="font-ui text-xs text-white">
              {Math.floor(take.duration / 60)}:{String(Math.floor(take.duration % 60)).padStart(2, "0")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
