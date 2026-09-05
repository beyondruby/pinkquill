"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import AuthUnavailable from "@/components/auth/AuthUnavailable";
import {
  useCreateTake,
  useSounds,
  useTrendingSounds,
  useSound,
  TakeAspectRatio,
  TakePlaybackSpeed,
  TakeEffect,
  Sound,
} from "@/lib/hooks/useTakes";
import { useCommunities } from "@/lib/hooks.legacy";
import { PageFrame, PageHeader } from "@/components/layout/PageFrame";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { Disclosure, FieldLabel, Switch } from "@/components/create/pieces";
import {
  TakeDropzone,
  TakePreview,
  PreviewBadge,
  TakeFilterChoice,
  TakeSegmented,
  TakeRange,
  TakeCoverChoice,
  TakeSoundRow,
  TakeSoundList,
  takeMusicIcon,
  formatSeconds,
} from "@/components/takes/TakeEditorPieces";
import "@/components/create/composer.css";
import PeoplePickerModal, { CollaboratorWithRole } from "@/components/ui/PeoplePickerModal";
import type { SearchableUser } from "@/lib/hooks.legacy";
import { supabase } from "@/lib/supabase";

interface CreateTakeProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialSoundId?: string;
}

// Aspect ratio options
const ASPECT_RATIOS: { value: TakeAspectRatio; label: string; icon: string }[] = [
  { value: "9:16", label: "Vertical", icon: "9:16" },
  { value: "1:1", label: "Square", icon: "1:1" },
  { value: "4:5", label: "Portrait", icon: "4:5" },
  { value: "16:9", label: "Landscape", icon: "16:9" },
  { value: "4:3", label: "Classic", icon: "4:3" },
];

// Speed options
const SPEED_OPTIONS: { value: TakePlaybackSpeed; label: string }[] = [
  { value: 0.25, label: "0.25x" },
  { value: 0.5, label: "0.5x" },
  { value: 0.75, label: "0.75x" },
  { value: 1.0, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2.0, label: "2x" },
  { value: 3.0, label: "3x" },
];

// Filter options
const FILTER_OPTIONS = [
  { name: "none", label: "Normal", style: {} },
  { name: "grayscale", label: "B&W", style: { filter: "grayscale(100%)" } },
  { name: "sepia", label: "Sepia", style: { filter: "sepia(80%)" } },
  { name: "vintage", label: "Vintage", style: { filter: "sepia(30%) contrast(110%) saturate(80%)" } },
  { name: "warm", label: "Warm", style: { filter: "saturate(120%) hue-rotate(-10deg)" } },
  { name: "cool", label: "Cool", style: { filter: "saturate(90%) hue-rotate(20deg)" } },
  { name: "dramatic", label: "Drama", style: { filter: "contrast(130%) saturate(110%)" } },
  { name: "fade", label: "Fade", style: { filter: "contrast(90%) brightness(110%) saturate(80%)" } },
  { name: "vivid", label: "Vivid", style: { filter: "saturate(150%) contrast(110%)" } },
];

type EditorTab = "details" | "sound" | "effects" | "thumbnail" | "frame" | "people" | "audience";

export default function CreateTake({ onSuccess, onCancel, initialSoundId }: CreateTakeProps) {
  const router = useRouter();
  const { user, loading: authLoading, status: authStatus, isAnonymous } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const appliedInitialSoundRef = useRef<string | null>(null);

  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Thumbnail state
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailFromVideo, setThumbnailFromVideo] = useState<string | null>(null);

  // Form state
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [contentWarning, setContentWarning] = useState("");
  const [showContentWarning, setShowContentWarning] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);

  // New creative options
  const [aspectRatio, setAspectRatio] = useState<TakeAspectRatio>("9:16");
  const [playbackSpeed, setPlaybackSpeed] = useState<TakePlaybackSpeed>(1.0);
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [effects, setEffects] = useState<TakeEffect[]>([]);
  const [allowSoundUse, setAllowSoundUse] = useState(true);
  const [originalAudioVolume, setOriginalAudioVolume] = useState(100);
  const [addedSoundVolume, setAddedSoundVolume] = useState(100);

  // Sound state
  const [selectedSound, setSelectedSound] = useState<Sound | null>(null);
  const [soundStartTime, setSoundStartTime] = useState(0);
  const [soundSearch, setSoundSearch] = useState("");
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [playingSoundUrl, setPlayingSoundUrl] = useState<string | null>(null);

  // Collaborators & Tagged People
  const [collaborators, setCollaborators] = useState<CollaboratorWithRole[]>([]);
  const [taggedPeople, setTaggedPeople] = useState<SearchableUser[]>([]);
  const [showCollaboratorPicker, setShowCollaboratorPicker] = useState(false);
  const [showTagPeoplePicker, setShowTagPeoplePicker] = useState(false);

  // Editor tab
  const [activeTab, setActiveTab] = useState<EditorTab>("details");

  const { createTake, uploading, progress, error } = useCreateTake();
  const { communities } = useCommunities(user?.id, "joined");
  const { sound: initialSound } = useSound(initialSoundId);

  // Sounds - gracefully handle if table doesn't exist yet
  const { sounds: trendingSounds = [] } = useTrendingSounds(10) || { sounds: [] };
  const { sounds: searchedSounds = [], loading: searchingSound = false } = useSounds(user?.id, {
    search: soundSearch,
    limit: 20,
  }) || { sounds: [], loading: false };

  const displaySounds = soundSearch ? searchedSounds : trendingSounds;

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: URL sound reuse should preselect once per sound id. */
  useEffect(() => {
    if (!initialSoundId || !initialSound || appliedInitialSoundRef.current === initialSoundId) return;
    setSelectedSound(initialSound);
    setSoundStartTime(0);
    setActiveTab("sound");
    appliedInitialSoundRef.current = initialSoundId;
  }, [initialSoundId, initialSound]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Extract tags from caption (hashtags)
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: updating tags when caption changes with hashtags */
  useEffect(() => {
    const hashtags = caption.match(/#[\w]+/g);
    if (hashtags) {
      const newTags = hashtags.map((tag) => tag.slice(1).toLowerCase());
      setTags((prev) => [...new Set([...prev, ...newTags])]);
    }
  }, [caption]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      if (thumbnailFromVideo) URL.revokeObjectURL(thumbnailFromVideo);
    };
  }, [videoPreview, thumbnailPreview, thumbnailFromVideo]);

  // Update effects when filter changes
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: syncing effects state with filter selection */
  useEffect(() => {
    if (selectedFilter && selectedFilter !== "none") {
      setEffects([{ type: "filter", name: selectedFilter }]);
    } else {
      setEffects([]);
    }
  }, [selectedFilter]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Generate thumbnail from video
  const generateThumbnailFromVideo = useCallback(() => {
    if (!videoPreviewRef.current || !videoPreview) return;

    const video = videoPreviewRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      setThumbnailFromVideo(dataUrl);
    }
  }, [videoPreview]);

  const handleFileSelect = useCallback((file: File) => {
    setValidationError(null);

    if (!file.type.startsWith("video/")) {
      setValidationError("Please select a video file");
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      setValidationError("Video must be under 200MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const durationCheckUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(durationCheckUrl);
      if (video.duration > 180) {
        setValidationError("Video must be 3 minutes or less");
        URL.revokeObjectURL(previewUrl);
        return;
      }
      setVideoDuration(Math.round(video.duration));
      setVideoFile(file);
      setVideoPreview(previewUrl);
    };
    video.onerror = () => {
      URL.revokeObjectURL(durationCheckUrl);
      URL.revokeObjectURL(previewUrl);
      setValidationError("Could not load video file");
    };
    video.src = durationCheckUrl;
  }, []);

  const handleThumbnailSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      setValidationError("Thumbnail must be under 5MB");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setThumbnailFile(file);
    setThumbnailPreview(previewUrl);
    setThumbnailFromVideo(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleRemoveVideo = useCallback(() => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null);
    setVideoPreview(null);
    setVideoDuration(0);
    setThumbnailFromVideo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [videoPreview]);

  const handleTogglePreview = useCallback(() => {
    if (videoPreviewRef.current) {
      if (isPreviewPlaying) {
        videoPreviewRef.current.pause();
        if (audioRef.current) audioRef.current.pause();
      } else {
        videoPreviewRef.current.play();
        if (audioRef.current && selectedSound) {
          audioRef.current.currentTime = soundStartTime;
          audioRef.current.volume = addedSoundVolume / 100;
          audioRef.current.play();
        }
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  }, [isPreviewPlaying, selectedSound, soundStartTime, addedSoundVolume]);

  const handleAddTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setTagInput("");
  }, [tagInput, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  }, []);

  const handleSelectSound = useCallback((sound: Sound) => {
    setSelectedSound(sound);
    setSoundStartTime(0);
    setShowSoundPicker(false);
  }, []);

  const handleRemoveSound = useCallback(() => {
    setSelectedSound(null);
    setSoundStartTime(0);
    setIsSoundPlaying(false);
    setPlayingSoundUrl(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const handlePreviewSound = useCallback((sound: Sound) => {
    if (audioRef.current) {
      if (isSoundPlaying && playingSoundUrl === sound.audio_url) {
        audioRef.current.pause();
        setIsSoundPlaying(false);
        setPlayingSoundUrl(null);
      } else {
        audioRef.current.src = sound.audio_url;
        audioRef.current.volume = addedSoundVolume / 100;
        audioRef.current.play();
        setIsSoundPlaying(true);
        setPlayingSoundUrl(sound.audio_url);
      }
    }
  }, [isSoundPlaying, playingSoundUrl, addedSoundVolume]);

  useEffect(() => {
    if (videoPreviewRef.current) {
      videoPreviewRef.current.playbackRate = playbackSpeed;
      videoPreviewRef.current.volume = originalAudioVolume / 100;
      videoPreviewRef.current.muted = originalAudioVolume === 0;
    }
    if (audioRef.current) {
      audioRef.current.volume = addedSoundVolume / 100;
    }
  }, [playbackSpeed, originalAudioVolume, addedSoundVolume]);

  useEffect(() => {
    if (!audioRef.current || !selectedSound) return;
    audioRef.current.src = selectedSound.audio_url;
    audioRef.current.currentTime = soundStartTime;
  }, [selectedSound, soundStartTime]);

  const handleSubmit = useCallback(async () => {
    if (!user?.id || !videoFile || uploading) return;

    // Convert thumbnail from video to file if needed
    let finalThumbnailFile = thumbnailFile;
    if (!finalThumbnailFile && thumbnailFromVideo) {
      const response = await fetch(thumbnailFromVideo);
      const blob = await response.blob();
      finalThumbnailFile = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
    }

    const result = await createTake(user.id, {
      videoFile,
      thumbnailFile: finalThumbnailFile || undefined,
      caption: caption.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      contentWarning: showContentWarning ? contentWarning.trim() : undefined,
      communityId: selectedCommunity || undefined,
      soundId: selectedSound?.id || undefined,
      duration: videoDuration,
      aspectRatio,
      effects,
      playbackSpeed,
      allowSoundUse,
      soundStartTime,
      originalAudioVolume,
      addedSoundVolume,
    });

    if (result) {
      // Save collaborators
      if (collaborators.length > 0) {
        try {
          await supabase.from("take_collaborators").insert(
            collaborators.map((c) => ({
              take_id: result.id,
              user_id: c.id,
              role: c.role || null,
              status: "pending",
            }))
          );
        } catch (err) {
          console.warn("Could not save collaborators:", err);
        }
      }

      // Save tagged people
      if (taggedPeople.length > 0) {
        try {
          await supabase.from("take_mentions").insert(
            taggedPeople.map((t) => ({
              take_id: result.id,
              user_id: t.id,
            }))
          );
        } catch (err) {
          console.warn("Could not save mentions:", err);
        }
      }

      onSuccess?.();
      router.push("/takes");
    }
  }, [
    user?.id, videoFile, uploading, createTake, caption, tags,
    showContentWarning, contentWarning, selectedCommunity, selectedSound,
    videoDuration, aspectRatio, effects, playbackSpeed, allowSoundUse,
    soundStartTime, originalAudioVolume, addedSoundVolume, thumbnailFile,
    thumbnailFromVideo, collaborators, taggedPeople, onSuccess, router,
  ]);

  useEffect(() => {
    if (isAnonymous) {
      router.push("/login");
    }
  }, [isAnonymous, router]);

  if (authStatus === "unknown") {
    return <AuthUnavailable />;
  }

  if (authLoading) {
    return (
      <PageFrame width="reading">
        <div className="pq-feed-state" role="status" aria-label="Loading">
          <Spinner size="lg" />
        </div>
      </PageFrame>
    );
  }

  if (!user) return null;

  const currentFilter = FILTER_OPTIONS.find(f => f.name === selectedFilter);
  const toggleSection = (tab: EditorTab) => setActiveTab((current) => (current === tab ? "details" : tab));
  const cancel = onCancel || (() => router.back());
  const peopleCount = collaborators.length + taggedPeople.length;
  const communityName = selectedCommunity ? communities?.find((c) => c.id === selectedCommunity)?.name : undefined;

  return (
    <PageFrame width="reading" className="pq-composer">
      {/* Hidden audio element for sound preview */}
      <audio ref={audioRef} onEnded={() => { setIsSoundPlaying(false); setPlayingSoundUrl(null); }} />

      <PageHeader
        title="Share a Take"
        lede="A short video, up to three minutes. Add a caption, a sound and a cover, then post."
        actions={<Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>}
      />

      {uploading && (
        <div className="pq-progress mb-4" role="progressbar" aria-label="Uploading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <span style={{ inlineSize: `${progress}%` }} />
        </div>
      )}

      <div className="pq-take-editor">
        <div className="pq-take-editor__stage">
          {!videoPreview ? (
            <TakeDropzone
              active={dragActive}
              inputRef={fileInputRef}
              onFile={handleFileSelect}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            />
          ) : (
            <TakePreview
              videoRef={videoPreviewRef}
              src={videoPreview}
              aspectRatio={aspectRatio}
              filterStyle={currentFilter?.style}
              muted={originalAudioVolume === 0}
              playing={isPreviewPlaying}
              onToggle={handleTogglePreview}
              onLoadedData={generateThumbnailFromVideo}
              onRemove={handleRemoveVideo}
              badges={
                <>
                  {videoDuration > 0 && <PreviewBadge>{formatSeconds(videoDuration)}</PreviewBadge>}
                  <PreviewBadge>{aspectRatio}</PreviewBadge>
                  {selectedSound && <PreviewBadge icon={<span className="w-3 h-3 inline-flex">{takeMusicIcon}</span>}>{selectedSound.name}</PreviewBadge>}
                </>
              }
            />
          )}
          {validationError && <p className="pq-alert" role="alert">{validationError}</p>}
        </div>

        <div className="pq-take-editor__fields">
          <div>
            <FieldLabel htmlFor="take-caption" hint={`${caption.length}/500`}>Caption</FieldLabel>
            <textarea
              id="take-caption"
              className="pq-field"
              placeholder="Say something about it. #tags work here too."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div>
            <FieldLabel htmlFor="take-tags" hint="(optional)">Tags</FieldLabel>
            <div className="pq-field pq-tag-field">
              {tags.map((tag) => (
                <span key={tag} className="pq-chip">
                  #{tag}
                  <button type="button" className="pq-chip__remove" onClick={() => handleRemoveTag(tag)} aria-label={`Remove tag ${tag}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </span>
              ))}
              <input
                id="take-tags"
                type="text"
                placeholder={tags.length ? "Add another" : "Add a tag and press Enter"}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
            </div>
          </div>

          <Disclosure
            id="take-look"
            label="Look"
            state={[currentFilter && currentFilter.name !== "none" ? currentFilter.label : null, playbackSpeed !== 1 ? `${playbackSpeed}×` : null].filter(Boolean).join(" · ") || undefined}
            open={activeTab === "effects"}
            onToggle={() => toggleSection("effects")}
          >
            <div className="grid gap-4">
              <div>
                <p className="pq-label">Filter</p>
                <TakeFilterChoice options={FILTER_OPTIONS} value={selectedFilter} onChange={setSelectedFilter} />
              </div>
              <div>
                <p className="pq-label">Speed</p>
                <TakeSegmented label="Playback speed" options={SPEED_OPTIONS} value={playbackSpeed} onChange={setPlaybackSpeed} />
              </div>
            </div>
          </Disclosure>

          <Disclosure
            id="take-sound"
            label="Sound"
            state={selectedSound ? selectedSound.name : undefined}
            open={activeTab === "sound"}
            onToggle={() => toggleSection("sound")}
          >
            <div className="grid gap-4">
              {selectedSound ? (
                <>
                  <TakeSoundRow sound={selectedSound} onRemove={handleRemoveSound} />
                  {selectedSound.duration > 0 && (
                    <TakeRange
                      id="take-sound-start"
                      label="Start at"
                      min={0}
                      max={Math.max(0, selectedSound.duration - 1)}
                      value={Math.min(soundStartTime, Math.max(0, selectedSound.duration - 1))}
                      onChange={setSoundStartTime}
                      format={(v) => `${v}s`}
                    />
                  )}
                </>
              ) : !showSoundPicker ? (
                <Button variant="secondary" size="sm" onClick={() => setShowSoundPicker(true)}>Add a sound</Button>
              ) : (
                <>
                  <input
                    type="search"
                    className="pq-field pq-field--ui"
                    placeholder="Search sounds"
                    aria-label="Search sounds"
                    value={soundSearch}
                    onChange={(e) => setSoundSearch(e.target.value)}
                  />
                  <TakeSoundList
                    sounds={displaySounds}
                    loading={searchingSound}
                    onSelect={handleSelectSound}
                    onPreview={handlePreviewSound}
                    playingUrl={isSoundPlaying ? playingSoundUrl : null}
                  />
                </>
              )}

              <div className="grid gap-2">
                <TakeRange id="take-original-volume" label="Original audio" min={0} max={100} value={originalAudioVolume} onChange={setOriginalAudioVolume} format={(v) => `${v}%`} />
                {selectedSound && (
                  <TakeRange id="take-added-volume" label="Added sound" min={0} max={100} value={addedSoundVolume} onChange={setAddedSoundVolume} format={(v) => `${v}%`} />
                )}
              </div>

              <div className="pq-switch-row">
                <span>Let others use this sound in their takes</span>
                <Switch checked={allowSoundUse} onChange={setAllowSoundUse} label="Let others use this sound" />
              </div>
            </div>
          </Disclosure>

          <Disclosure
            id="take-frame"
            label="Frame"
            state={aspectRatio}
            open={activeTab === "frame"}
            onToggle={() => toggleSection("frame")}
          >
            <TakeSegmented
              label="Aspect ratio"
              options={ASPECT_RATIOS.map((ar) => ({ value: ar.value, label: `${ar.label} ${ar.value}` }))}
              value={aspectRatio}
              onChange={setAspectRatio}
            />
            <p className="mt-2 text-sm text-subdued">How the video sits in the feed.</p>
          </Disclosure>

          <Disclosure
            id="take-cover"
            label="Cover"
            state={thumbnailPreview ? "Your image" : thumbnailFromVideo ? "From the video" : undefined}
            open={activeTab === "thumbnail"}
            onToggle={() => toggleSection("thumbnail")}
          >
            <TakeCoverChoice
              fromVideo={thumbnailFromVideo}
              custom={thumbnailPreview}
              onUseFrame={() => { setThumbnailPreview(null); setThumbnailFile(null); }}
              inputRef={thumbnailInputRef}
              onCustomFile={handleThumbnailSelect}
            />
          </Disclosure>

          <Disclosure
            id="take-people"
            label="People"
            state={peopleCount > 0 ? `${peopleCount}` : undefined}
            open={activeTab === "people"}
            onToggle={() => toggleSection("people")}
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowCollaboratorPicker(true)}>
                Collaborators{collaborators.length > 0 ? ` (${collaborators.length})` : ""}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowTagPeoplePicker(true)}>
                Tag people{taggedPeople.length > 0 ? ` (${taggedPeople.length})` : ""}
              </Button>
            </div>
          </Disclosure>

          <Disclosure
            id="take-audience"
            label="Community and warning"
            state={[communityName, showContentWarning ? "Warning" : null].filter(Boolean).join(" · ") || undefined}
            open={activeTab === "audience"}
            onToggle={() => toggleSection("audience")}
          >
            <div className="grid gap-4">
              {communities && communities.length > 0 && (
                <div>
                  <FieldLabel htmlFor="take-community" hint="(optional)">Post to a community</FieldLabel>
                  <select
                    id="take-community"
                    className="pq-field pq-field--ui"
                    value={selectedCommunity ?? ""}
                    onChange={(e) => setSelectedCommunity(e.target.value || null)}
                  >
                    <option value="">Just my studio</option>
                    {communities.map((community) => (
                      <option key={community.id} value={community.id}>{community.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="pq-switch-row">
                <span>Add a content warning</span>
                <Switch checked={showContentWarning} onChange={setShowContentWarning} label="Add a content warning" />
              </div>
              {showContentWarning && (
                <input
                  type="text"
                  className="pq-field pq-field--ui"
                  placeholder="What should people know before watching?"
                  aria-label="Content warning"
                  value={contentWarning}
                  onChange={(e) => setContentWarning(e.target.value)}
                  maxLength={100}
                />
              )}
            </div>
          </Disclosure>

          {error && <p className="pq-alert" role="alert">{error}</p>}

          <div className="pq-composer-foot">
            <div className="pq-composer-foot__audience">
              <span className="text-sm text-subdued">Takes are visible to everyone.</span>
            </div>
            <div className="pq-composer-foot__actions">
              <Button variant="ghost" onClick={cancel} disabled={uploading}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!videoFile || uploading}
                loading={uploading}
                loadingText={`Posting ${Math.round(progress)}%`}
              >
                Post take
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PeoplePickerModal
        isOpen={showCollaboratorPicker}
        onClose={() => setShowCollaboratorPicker(false)}
        onConfirm={(selected) => setCollaborators(selected)}
        currentUserId={user.id}
        mode="collaborators"
        initialSelected={collaborators}
        maxSelections={10}
        excludeIds={taggedPeople.map((t) => t.id)}
      />
      <PeoplePickerModal
        isOpen={showTagPeoplePicker}
        onClose={() => setShowTagPeoplePicker(false)}
        onConfirm={(selected) => setTaggedPeople(selected)}
        currentUserId={user.id}
        mode="mentions"
        initialSelected={taggedPeople}
        maxSelections={50}
        excludeIds={collaborators.map((c) => c.id)}
      />
    </PageFrame>
  );
}
