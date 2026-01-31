"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  useCreateTake,
  useSounds,
  useTrendingSounds,
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
  faChevronLeft,
} from "@fortawesome/free-solid-svg-icons";
import PeoplePickerModal, { CollaboratorWithRole } from "@/components/ui/PeoplePickerModal";
import { SearchableUser } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

interface CreateTakeProps {
  onSuccess?: () => void;
  onCancel?: () => void;
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

export default function CreateTake({ onSuccess, onCancel }: CreateTakeProps) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  // Collaborators & Tagged People
  const [collaborators, setCollaborators] = useState<CollaboratorWithRole[]>([]);
  const [taggedPeople, setTaggedPeople] = useState<SearchableUser[]>([]);
  const [showCollaboratorPicker, setShowCollaboratorPicker] = useState(false);
  const [showTagPeoplePicker, setShowTagPeoplePicker] = useState(false);

  // Editor tab
  const [activeTab, setActiveTab] = useState<EditorTab>("details");

  const { createTake, uploading, progress, error } = useCreateTake();
  const { communities } = useCommunities(user?.id, "joined");
  const { sounds: trendingSounds } = useTrendingSounds(10);
  const { sounds: searchedSounds, loading: searchingSound } = useSounds(user?.id, {
    search: soundSearch,
    limit: 20,
  });

  const displaySounds = soundSearch ? searchedSounds : trendingSounds;

  // Extract tags from caption (hashtags)
  useEffect(() => {
    const hashtags = caption.match(/#[\w]+/g);
    if (hashtags) {
      const newTags = hashtags.map((tag) => tag.slice(1).toLowerCase());
      setTags((prev) => [...new Set([...prev, ...newTags])]);
    }
  }, [caption]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      if (videoPreview) URL.revokeObjectURL(videoPreview);
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      if (thumbnailFromVideo) URL.revokeObjectURL(thumbnailFromVideo);
    };
  }, [videoPreview, thumbnailPreview, thumbnailFromVideo]);

  // Update effects when filter changes
  useEffect(() => {
    if (selectedFilter && selectedFilter !== "none") {
      setEffects([{ type: "filter", name: selectedFilter }]);
    } else {
      setEffects([]);
    }
  }, [selectedFilter]);

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

    if (file.size > 100 * 1024 * 1024) {
      setValidationError("Video must be under 100MB");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    const durationCheckUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(durationCheckUrl);
      if (video.duration > 90) {
        setValidationError("Video must be 90 seconds or less");
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
          audioRef.current.play();
        }
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  }, [isPreviewPlaying, selectedSound, soundStartTime]);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const handlePreviewSound = useCallback((sound: Sound) => {
    if (audioRef.current) {
      if (isSoundPlaying && audioRef.current.src === sound.audio_url) {
        audioRef.current.pause();
        setIsSoundPlaying(false);
      } else {
        audioRef.current.src = sound.audio_url;
        audioRef.current.play();
        setIsSoundPlaying(true);
      }
    }
  }, [isSoundPlaying]);

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
      <audio ref={audioRef} onEnded={() => setIsSoundPlaying(false)} />

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

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Video Preview Section */}
          <div className="space-y-4">
            {!videoPreview ? (
              <div
                className={`aspect-[9/16] max-h-[70vh] rounded-2xl border-2 border-dashed transition-colors cursor-pointer flex flex-col items-center justify-center ${
                  dragActive ? "border-purple-500 bg-purple-500/10" : "border-white/20 hover:border-white/40"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <FontAwesomeIcon icon={faCloudUploadAlt} className="w-12 h-12 text-white/40 mb-4" />
                <p className="text-white/60 text-center px-4">
                  Drag and drop a video or click to browse
                </p>
                <p className="text-white/40 text-sm mt-2">MP4 or MOV, max 90s, max 100MB</p>
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

          {/* Editor Panel */}
          <div className="space-y-6">
            {/* Tab navigation */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
              {[
                { tab: "details" as EditorTab, label: "Details" },
                { tab: "effects" as EditorTab, label: "Effects" },
                { tab: "sound" as EditorTab, label: "Sound" },
                { tab: "thumbnail" as EditorTab, label: "Cover" },
              ].map(({ tab, label }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/70"
                  }`}
                >
                  {label}
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
                <div>
                  <label className="block text-sm font-medium mb-2 text-white/70">Aspect Ratio</label>
                  <div className="flex gap-2 flex-wrap">
                    {ASPECT_RATIOS.map((ar) => (
                      <button
                        key={ar.value}
                        onClick={() => setAspectRatio(ar.value)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                          aspectRatio === ar.value
                            ? "bg-purple-500 text-white"
                            : "bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {ar.label}
                      </button>
                    ))}
                  </div>
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
              </div>
            )}

            {/* Effects Tab */}
            {activeTab === "effects" && (
              <div className="space-y-6">
                {/* Filters */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-white/70">Filters</label>
                  <div className="grid grid-cols-3 gap-3">
                    {FILTER_OPTIONS.map((filter) => (
                      <button
                        key={filter.name}
                        onClick={() => setSelectedFilter(filter.name)}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
                          selectedFilter === filter.name
                            ? "border-purple-500"
                            : "border-transparent hover:border-white/20"
                        }`}
                      >
                        <div
                          className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500"
                          style={filter.style}
                        />
                        <span className="absolute bottom-1 left-1 right-1 text-[10px] font-medium text-white text-center bg-black/50 rounded px-1 py-0.5">
                          {filter.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Speed */}
                <div>
                  <label className="block text-sm font-medium mb-3 text-white/70">Playback Speed</label>
                  <div className="flex gap-2 flex-wrap">
                    {SPEED_OPTIONS.map((speed) => (
                      <button
                        key={speed.value}
                        onClick={() => setPlaybackSpeed(speed.value)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                          playbackSpeed === speed.value
                            ? "bg-purple-500 text-white"
                            : "bg-white/5 text-white/60 hover:bg-white/10"
                        }`}
                      >
                        {speed.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Sound Tab */}
            {activeTab === "sound" && (
              <div className="space-y-5">
                {/* Current Sound */}
                {selectedSound ? (
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                    {selectedSound.cover_url && (
                      <img src={selectedSound.cover_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedSound.name}</p>
                      <p className="text-sm text-white/50 truncate">{selectedSound.artist || "Original Sound"}</p>
                    </div>
                    <button
                      onClick={handleRemoveSound}
                      className="p-2 hover:bg-white/10 rounded-full"
                    >
                      <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSoundPicker(true)}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-white/5 border border-white/10 border-dashed rounded-xl text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors"
                  >
                    <FontAwesomeIcon icon={faMusic} className="w-5 h-5" />
                    Add Sound
                  </button>
                )}

                {/* Volume Controls */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-white/70">Original Audio</label>
                      <span className="text-sm text-white/50">{originalAudioVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={originalAudioVolume}
                      onChange={(e) => setOriginalAudioVolume(Number(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500"
                    />
                  </div>
                  {selectedSound && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-white/70">Added Sound</label>
                        <span className="text-sm text-white/50">{addedSoundVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={addedSoundVolume}
                        onChange={(e) => setAddedSoundVolume(Number(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-pink-500"
                      />
                    </div>
                  )}
                </div>

                {/* Allow Sound Use */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowSoundUse}
                    onChange={(e) => setAllowSoundUse(e.target.checked)}
                    className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-white/70">Allow others to use this sound</span>
                </label>

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
                                icon={isSoundPlaying && audioRef.current?.src === sound.audio_url ? faPause : faPlay}
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
                <p className="text-sm text-white/50">Choose a cover image for your take</p>

                {/* Thumbnail options */}
                <div className="grid grid-cols-2 gap-4">
                  {/* From video */}
                  {thumbnailFromVideo && (
                    <button
                      onClick={() => {
                        setThumbnailPreview(null);
                        setThumbnailFile(null);
                      }}
                      className={`relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-colors ${
                        !thumbnailPreview ? "border-purple-500" : "border-transparent hover:border-white/20"
                      }`}
                    >
                      <img src={thumbnailFromVideo} alt="" className="w-full h-full object-cover" />
                      <span className="absolute bottom-2 left-2 right-2 text-xs font-medium text-white text-center bg-black/50 rounded px-2 py-1">
                        From Video
                      </span>
                      {!thumbnailPreview && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                          <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  )}

                  {/* Custom upload */}
                  <button
                    onClick={() => thumbnailInputRef.current?.click()}
                    className={`relative aspect-[9/16] rounded-xl overflow-hidden border-2 transition-colors ${
                      thumbnailPreview ? "border-purple-500" : "border-dashed border-white/20 hover:border-white/40"
                    }`}
                  >
                    {thumbnailPreview ? (
                      <>
                        <img src={thumbnailPreview} alt="" className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                          <FontAwesomeIcon icon={faCheck} className="w-3 h-3" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-white/5">
                        <FontAwesomeIcon icon={faImage} className="w-8 h-8 text-white/30 mb-2" />
                        <span className="text-xs text-white/40">Upload Custom</span>
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
