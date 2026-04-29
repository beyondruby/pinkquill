"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
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
import { useCommunities } from "@/lib/hooks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudUploadAlt,
  faTimes,
  faUsers,
  faExclamationTriangle,
  faSpinner,
  faPlay,
  faPause,
  faCheck,
  faImage,
  faMusic,
  faCrop,
  faMagic,
  faFont,
  faTachometerAlt,
  faVolumeUp,
  faVolumeMute,
  faSearch,
  faHeart,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import PeoplePickerModal, { CollaboratorWithRole } from "@/components/ui/PeoplePickerModal";
import { SearchableUser } from "@/lib/hooks";
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

type EditorTab = "details" | "sound" | "effects" | "thumbnail";

export default function CreateTake({ onSuccess, onCancel, initialSoundId }: CreateTakeProps) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
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
  const [showCommunityPicker, setShowCommunityPicker] = useState(false);

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

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- Complex async handler with many dependencies
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
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const currentFilter = FILTER_OPTIONS.find(f => f.name === selectedFilter);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Hidden audio element for sound preview */}
      <audio ref={audioRef} onEnded={() => { setIsSoundPlaying(false); setPlayingSoundUrl(null); }} />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={onCancel || (() => router.back())}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg font-semibold">Create Take</h1>
          <button
            onClick={handleSubmit}
            disabled={!videoFile || uploading}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {uploading ? `${Math.round(progress)}%` : "Post"}
          </button>
        </div>
        {uploading && (
          <div className="h-1 bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Feature Pills - Always visible at top */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-purple-500/30">
            <FontAwesomeIcon icon={faMagic} className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white/80">9 Filters</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500/20 to-orange-500/20 rounded-full border border-pink-500/30">
            <FontAwesomeIcon icon={faMusic} className="w-4 h-4 text-pink-400" />
            <span className="text-sm text-white/80">Add Sounds</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-full border border-blue-500/30">
            <FontAwesomeIcon icon={faCrop} className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-white/80">5 Aspect Ratios</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-teal-500/20 rounded-full border border-green-500/30">
            <FontAwesomeIcon icon={faImage} className="w-4 h-4 text-green-400" />
            <span className="text-sm text-white/80">Custom Covers</span>
          </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-full border border-orange-500/30">
            <FontAwesomeIcon icon={faTachometerAlt} className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-white/80">Speed Control</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Video Preview Section - Takes 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            {!videoPreview ? (
              <div
                className={`aspect-[9/16] max-h-[70vh] rounded-2xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center bg-gradient-to-b from-white/5 to-transparent ${
                  dragActive ? "border-purple-500 bg-purple-500/10" : "border-white/20 hover:border-white/40"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                  <FontAwesomeIcon icon={faCloudUploadAlt} className="w-8 h-8 text-white" />
                </div>
                <p className="text-white/80 text-center px-4 font-medium">
                  Upload your video
                </p>
                <p className="text-white/40 text-sm mt-2 text-center px-4">
                  Drag & drop or click to browse<br/>
                  MP4/MOV · Max 3 min · Max 200MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/mov"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative">
                <div
                  className="relative rounded-2xl overflow-hidden bg-black"
                  style={{
                    aspectRatio: aspectRatio.replace(":", "/"),
                    maxHeight: "70vh",
                    margin: "0 auto",
                  }}
                >
                  <video
                    ref={videoPreviewRef}
                    src={videoPreview}
                    className="w-full h-full object-contain"
                    style={currentFilter?.style}
                    loop
                    playsInline
                    muted={originalAudioVolume === 0}
                    onClick={handleTogglePreview}
                    onLoadedData={generateThumbnailFromVideo}
                  />

                  {/* Play/Pause overlay */}
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={handleTogglePreview}
                  >
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <FontAwesomeIcon icon={isPreviewPlaying ? faPause : faPlay} className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Duration badge */}
                  <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 rounded-lg text-xs font-medium">
                    {videoDuration}s
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={handleRemoveVideo}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                  </button>

                  {/* Sound indicator */}
                  {selectedSound && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-full">
                      <FontAwesomeIcon icon={faMusic} className="w-3 h-3 text-pink-400" />
                      <span className="text-xs truncate max-w-[120px]">{selectedSound.name}</span>
                    </div>
                  )}
                </div>

                {/* Quick actions under video */}
                <div className="flex items-center justify-center gap-2 mt-4">
                  {[
                    { tab: "effects" as EditorTab, icon: faMagic, label: "Filters" },
                    { tab: "sound" as EditorTab, icon: faMusic, label: "Sound" },
                    { tab: "thumbnail" as EditorTab, icon: faImage, label: "Cover" },
                  ].map(({ tab, icon, label }) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
                        activeTab === tab
                          ? "bg-purple-500 text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      <FontAwesomeIcon icon={icon} className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {validationError && (
              <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                {validationError}
              </div>
            )}
          </div>

          {/* Editor Panel - Takes 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            {/* Tab navigation with icons */}
            <div className="flex gap-1 p-1.5 bg-white/5 rounded-2xl border border-white/10">
              {[
                { tab: "details" as EditorTab, label: "Details", icon: faFont },
                { tab: "effects" as EditorTab, label: "Effects", icon: faMagic },
                { tab: "sound" as EditorTab, label: "Sound", icon: faMusic },
                { tab: "thumbnail" as EditorTab, label: "Cover", icon: faImage },
              ].map(({ tab, label, icon }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                      : "text-white/50 hover:text-white/70 hover:bg-white/5"
                  }`}
                >
                  <FontAwesomeIcon icon={icon} className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* Details Tab */}
            {activeTab === "details" && (
              <div className="space-y-5">
                {/* Caption */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white/70">Caption</label>
                  <textarea
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500 resize-none"
                    placeholder="Write a caption... Use #hashtags"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={500}
                    rows={3}
                  />
                  <span className="text-xs text-white/40 mt-1 block text-right">{caption.length}/500</span>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-white/70">Tags</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                      placeholder="Add a tag..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                    />
                    <button
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                      className="px-4 py-2 bg-purple-500 rounded-xl font-medium text-sm disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm"
                        >
                          #{tag}
                          <button onClick={() => handleRemoveTag(tag)} className="hover:text-white">
                            <FontAwesomeIcon icon={faTimes} className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aspect Ratio */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faCrop} className="w-4 h-4 text-blue-400" />
                    <label className="text-sm font-semibold text-white">Aspect Ratio</label>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {ASPECT_RATIOS.map((ar) => (
                      <button
                        key={ar.value}
                        onClick={() => setAspectRatio(ar.value)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                          aspectRatio === ar.value
                            ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg"
                            : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                        }`}
                      >
                        <div
                          className={`border-2 ${aspectRatio === ar.value ? 'border-white' : 'border-white/30'} rounded`}
                          style={{
                            width: ar.value === '16:9' ? '32px' : ar.value === '9:16' ? '18px' : ar.value === '1:1' ? '24px' : ar.value === '4:5' ? '20px' : '26px',
                            height: ar.value === '16:9' ? '18px' : ar.value === '9:16' ? '32px' : ar.value === '1:1' ? '24px' : ar.value === '4:5' ? '25px' : '20px',
                          }}
                        />
                        <span className="text-xs font-medium">{ar.icon}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/40 mt-3">
                    Choose how your video will be displayed in the feed
                  </p>
                </div>

                {/* Community */}
                {communities && communities.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white/70">Post to Community</label>
                    <button
                      onClick={() => setShowCommunityPicker(!showCommunityPicker)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left hover:bg-white/10 transition-colors"
                    >
                      <span className={selectedCommunity ? "text-white" : "text-white/40"}>
                        {selectedCommunity
                          ? communities.find((c) => c.id === selectedCommunity)?.name
                          : "Select a community (optional)"}
                      </span>
                      <FontAwesomeIcon icon={faChevronRight} className="w-4 h-4 text-white/40" />
                    </button>
                    {showCommunityPicker && (
                      <div className="mt-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        {communities.map((community) => (
                          <button
                            key={community.id}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/10 transition-colors ${
                              selectedCommunity === community.id ? "bg-purple-500/20" : ""
                            }`}
                            onClick={() => {
                              setSelectedCommunity(community.id === selectedCommunity ? null : community.id);
                              setShowCommunityPicker(false);
                            }}
                          >
                            {community.avatar_url && (
                              <img src={community.avatar_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                            )}
                            <span className="flex-1">{community.name}</span>
                            {selectedCommunity === community.id && (
                              <FontAwesomeIcon icon={faCheck} className="text-purple-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Content Warning */}
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showContentWarning}
                      onChange={(e) => setShowContentWarning(e.target.checked)}
                      className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-white/70">Add content warning</span>
                  </label>
                  {showContentWarning && (
                    <input
                      type="text"
                      className="w-full mt-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                      placeholder="Describe the warning..."
                      value={contentWarning}
                      onChange={(e) => setContentWarning(e.target.value)}
                      maxLength={100}
                    />
                  )}
                </div>

                {/* Collaborators and Tags */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faUsers} className="w-4 h-4 text-purple-400" />
                    <label className="text-sm font-semibold text-white">People</label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCollaboratorPicker(true)}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm text-white/80">
                        <FontAwesomeIcon icon={faUsers} className="w-4 h-4 text-purple-300" />
                        Collaborators
                      </span>
                      <span className="text-xs text-white/40">{collaborators.length}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTagPeoplePicker(true)}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm text-white/80">
                        <FontAwesomeIcon icon={faHeart} className="w-4 h-4 text-pink-300" />
                        Tag people
                      </span>
                      <span className="text-xs text-white/40">{taggedPeople.length}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Effects Tab */}
            {activeTab === "effects" && (
              <div className="space-y-6">
                {/* Filters */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faMagic} className="w-4 h-4 text-purple-400" />
                    <label className="text-sm font-semibold text-white">Video Filters</label>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {FILTER_OPTIONS.map((filter) => (
                      <button
                        key={filter.name}
                        onClick={() => setSelectedFilter(filter.name)}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          selectedFilter === filter.name
                            ? "border-purple-500 scale-105 shadow-lg shadow-purple-500/30"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <div
                          className="w-full h-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500"
                          style={filter.style}
                        />
                        <span className="absolute bottom-1 left-1 right-1 text-[10px] font-semibold text-white text-center bg-black/60 backdrop-blur-sm rounded px-1 py-0.5">
                          {filter.label}
                        </span>
                        {selectedFilter === filter.name && (
                          <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speed */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faTachometerAlt} className="w-4 h-4 text-orange-400" />
                    <label className="text-sm font-semibold text-white">Playback Speed</label>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {SPEED_OPTIONS.map((speed) => (
                      <button
                        key={speed.value}
                        onClick={() => setPlaybackSpeed(speed.value)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          playbackSpeed === speed.value
                            ? "bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg"
                            : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                        }`}
                      >
                        {speed.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-white/40 mt-3">
                    Slow motion (0.25x-0.75x) or speed up (1.5x-3x) your video
                  </p>
                </div>
              </div>
            )}

            {/* Sound Tab */}
            {activeTab === "sound" && (
              <div className="space-y-5">
                {/* Current Sound */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faMusic} className="w-4 h-4 text-pink-400" />
                    <label className="text-sm font-semibold text-white">Add Music or Sound</label>
                  </div>

                  {selectedSound ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {selectedSound.cover_url ? (
                            <img src={selectedSound.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <FontAwesomeIcon icon={faMusic} className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{selectedSound.name}</p>
                          <p className="text-sm text-white/50 truncate">{selectedSound.artist || "Original Sound"}</p>
                          <p className="text-xs text-pink-400 mt-1">{selectedSound.use_count} uses</p>
                        </div>
                        <button
                          onClick={handleRemoveSound}
                          className="p-2 hover:bg-white/10 rounded-full"
                        >
                          <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                        </button>
                      </div>
                      {selectedSound.duration > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-white/70">Sound start</span>
                            <span className="text-sm font-medium text-pink-400">{soundStartTime}s</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(0, selectedSound.duration - 1)}
                            value={Math.min(soundStartTime, Math.max(0, selectedSound.duration - 1))}
                            onChange={(e) => setSoundStartTime(Number(e.target.value))}
                            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-pink-500 [&::-webkit-slider-thumb]:to-orange-500 [&::-webkit-slider-thumb]:shadow-lg"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSoundPicker(true)}
                      className="w-full flex items-center justify-center gap-3 p-6 bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-500/20 border-dashed rounded-xl text-white/70 hover:bg-pink-500/20 hover:text-white hover:border-pink-500/40 transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                        <FontAwesomeIcon icon={faMusic} className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">Add a Sound</p>
                        <p className="text-sm text-white/50">Browse trending sounds or search</p>
                      </div>
                    </button>
                  )}
                </div>

                {/* Volume Controls */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-4">
                    <FontAwesomeIcon icon={faVolumeUp} className="w-4 h-4 text-cyan-400" />
                    <label className="text-sm font-semibold text-white">Volume Mixer</label>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white/70">Original Audio</span>
                          {originalAudioVolume === 0 && (
                            <FontAwesomeIcon icon={faVolumeMute} className="w-3 h-3 text-white/40" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-purple-400">{originalAudioVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={originalAudioVolume}
                        onChange={(e) => setOriginalAudioVolume(Number(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-pink-500 [&::-webkit-slider-thumb]:shadow-lg"
                      />
                    </div>
                    {selectedSound && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white/70">Added Sound</span>
                            {addedSoundVolume === 0 && (
                              <FontAwesomeIcon icon={faVolumeMute} className="w-3 h-3 text-white/40" />
                            )}
                          </div>
                          <span className="text-sm font-medium text-pink-400">{addedSoundVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={addedSoundVolume}
                          onChange={(e) => setAddedSoundVolume(Number(e.target.value))}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-pink-500 [&::-webkit-slider-thumb]:to-orange-500 [&::-webkit-slider-thumb]:shadow-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Allow Sound Use */}
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowSoundUse}
                      onChange={(e) => setAllowSoundUse(e.target.checked)}
                      className="w-5 h-5 rounded-lg border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-white">Allow others to use this sound</span>
                      <p className="text-xs text-white/50 mt-0.5">Let other creators use your original audio in their takes</p>
                    </div>
                  </label>
                </div>

                {/* Sound Picker */}
                {showSoundPicker && (
                  <div className="space-y-4">
                    <div className="relative">
                      <FontAwesomeIcon
                        icon={faSearch}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
                      />
                      <input
                        type="text"
                        placeholder="Search sounds..."
                        value={soundSearch}
                        onChange={(e) => setSoundSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {searchingSound ? (
                        <div className="flex items-center justify-center py-8">
                          <FontAwesomeIcon icon={faSpinner} spin className="w-6 h-6 text-white/40" />
                        </div>
                      ) : displaySounds.length === 0 ? (
                        <p className="text-center py-8 text-white/40">No sounds found</p>
                      ) : (
                        displaySounds.map((sound) => (
                          <button
                            key={sound.id}
                            onClick={() => handleSelectSound(sound)}
                            className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                          >
                            <div
                              className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden"
                            >
                              {sound.cover_url ? (
                                <img src={sound.cover_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <FontAwesomeIcon icon={faMusic} className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="font-medium truncate">{sound.name}</p>
                              <p className="text-xs text-white/50 truncate">
                                {sound.artist || "Original"} · {sound.use_count} uses
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewSound(sound);
                              }}
                              className="p-2 hover:bg-white/10 rounded-full"
                            >
                              <FontAwesomeIcon
                                icon={isSoundPlaying && playingSoundUrl === sound.audio_url ? faPause : faPlay}
                                className="w-3 h-3"
                              />
                            </button>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Thumbnail Tab */}
            {activeTab === "thumbnail" && (
              <div className="space-y-5">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={faImage} className="w-4 h-4 text-green-400" />
                    <label className="text-sm font-semibold text-white">Cover Image</label>
                  </div>
                  <p className="text-sm text-white/50 mb-4">Choose a cover image that will be shown before your video plays</p>

                  {/* Thumbnail options */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* From video */}
                    {thumbnailFromVideo ? (
                      <button
                        onClick={() => {
                          setThumbnailPreview(null);
                          setThumbnailFile(null);
                        }}
                        className={`relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all ${
                          !thumbnailPreview ? "border-green-500 shadow-lg shadow-green-500/20" : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <img src={thumbnailFromVideo} alt="" className="w-full h-full object-cover" />
                        <span className="absolute bottom-2 left-2 right-2 text-xs font-semibold text-white text-center bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1.5">
                          From Video
                        </span>
                        {!thumbnailPreview && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ) : (
                      <div className="aspect-[9/16] rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center bg-white/5 text-white/30">
                        <FontAwesomeIcon icon={faPlay} className="w-8 h-8 mb-2" />
                        <span className="text-xs text-center px-4">Upload a video first to capture a frame</span>
                      </div>
                    )}

                    {/* Custom upload */}
                    <button
                      onClick={() => thumbnailInputRef.current?.click()}
                      className={`relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-all ${
                        thumbnailPreview ? "border-green-500 shadow-lg shadow-green-500/20" : "border-dashed border-white/20 hover:border-green-500/50 hover:bg-green-500/5"
                      }`}
                    >
                      {thumbnailPreview ? (
                        <>
                          <img src={thumbnailPreview} alt="" className="w-full h-full object-cover" />
                          <span className="absolute bottom-2 left-2 right-2 text-xs font-semibold text-white text-center bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1.5">
                            Custom Cover
                          </span>
                          <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faCheck} className="w-3 h-3 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-white/5">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/20 to-teal-500/20 flex items-center justify-center mb-3">
                            <FontAwesomeIcon icon={faCloudUploadAlt} className="w-5 h-5 text-green-400" />
                          </div>
                          <span className="text-sm text-white/60 font-medium">Upload Custom</span>
                          <span className="text-xs text-white/40 mt-1">JPG, PNG up to 5MB</span>
                        </div>
                      )}
                      <input
                        ref={thumbnailInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleThumbnailSelect(e.target.files[0])}
                        className="hidden"
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {user && (
        <>
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
        </>
      )}
    </div>
  );
}
