"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateTake } from "@/lib/hooks/useTakes";
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
  faUserTag,
} from "@fortawesome/free-solid-svg-icons";
import PeoplePickerModal, { CollaboratorWithRole } from "@/components/ui/PeoplePickerModal";
import { SearchableUser } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

interface CreateTakeProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CreateTake({ onSuccess, onCancel }: CreateTakeProps) {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [contentWarning, setContentWarning] = useState("");
  const [showContentWarning, setShowContentWarning] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null);
  const [showCommunityPicker, setShowCommunityPicker] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Collaborators & Tagged People
  const [collaborators, setCollaborators] = useState<CollaboratorWithRole[]>([]);
  const [taggedPeople, setTaggedPeople] = useState<SearchableUser[]>([]);
  const [showCollaboratorPicker, setShowCollaboratorPicker] = useState(false);
  const [showTagPeoplePicker, setShowTagPeoplePicker] = useState(false);

  const { createTake, uploading, progress, error } = useCreateTake();
  const { communities } = useCommunities(user?.id, "joined");

  // Extract tags from caption (hashtags)
  useEffect(() => {
    const hashtags = caption.match(/#[\w]+/g);
    if (hashtags) {
      const newTags = hashtags.map((tag) => tag.slice(1).toLowerCase());
      setTags((prev) => [...new Set([...prev, ...newTags])]);
    }
  }, [caption]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (videoPreview) {
        URL.revokeObjectURL(videoPreview);
      }
    };
  }, [videoPreview]);

  const handleFileSelect = useCallback((file: File) => {
    setValidationError(null);

    // Validate file type
    if (!file.type.startsWith("video/")) {
      setValidationError("Please select a video file");
      return;
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      setValidationError("Video must be under 100MB");
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);

    // Get duration first using a separate URL
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleRemoveVideo = useCallback(() => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoFile(null);
    setVideoPreview(null);
    setVideoDuration(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [videoPreview]);

  const handleTogglePreview = useCallback(() => {
    if (videoPreviewRef.current) {
      if (isPreviewPlaying) {
        videoPreviewRef.current.pause();
      } else {
        videoPreviewRef.current.play();
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  }, [isPreviewPlaying]);

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

  const handleSubmit = useCallback(async () => {
    if (!user?.id || !videoFile || uploading) return;

    const result = await createTake(user.id, {
      videoFile,
      caption: caption.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      contentWarning: showContentWarning ? contentWarning.trim() : undefined,
      communityId: selectedCommunity || undefined,
      duration: videoDuration,
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

      // Save tagged people (mentions)
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
    user?.id,
    videoFile,
    uploading,
    createTake,
    caption,
    tags,
    showContentWarning,
    contentWarning,
    selectedCommunity,
    videoDuration,
    collaborators,
    taggedPeople,
    onSuccess,
    router,
  ]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="create-take flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="create-take">
      <div className="create-take-container">
        {/* Header */}
        <div className="create-take-header">
          <h1 className="create-take-title">Create Take</h1>
          {onCancel && (
            <button className="create-take-close" onClick={onCancel}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>

        <div className="create-take-content">
          {/* Video upload/preview */}
          <div className="create-take-video-section">
            {!videoPreview ? (
              <div
                className={`create-take-dropzone ${dragActive ? "active" : ""}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <FontAwesomeIcon icon={faCloudUploadAlt} className="create-take-upload-icon" />
                <p className="create-take-upload-text">
                  Drag and drop a video or click to browse
                </p>
                <p className="create-take-upload-info">
                  MP4 or MOV, max 90 seconds, max 100MB
                </p>
                <p className="create-take-upload-aspect">
                  9:16 aspect ratio recommended (1080x1920)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/mov"
                  onChange={handleInputChange}
                  className="create-take-file-input"
                />
              </div>
            ) : (
              <div className="create-take-preview">
                <div className="create-take-preview-video-wrapper">
                  <video
                    ref={videoPreviewRef}
                    src={videoPreview}
                    className="create-take-preview-video"
                    loop
                    playsInline
                    muted
                    onClick={handleTogglePreview}
                  />
                  <div className="create-take-preview-overlay" onClick={handleTogglePreview}>
                    <FontAwesomeIcon
                      icon={isPreviewPlaying ? faPause : faPlay}
                      className="create-take-preview-play"
                    />
                  </div>
                  <button
                    className="create-take-preview-remove"
                    onClick={handleRemoveVideo}
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                  <div className="create-take-preview-duration">
                    {videoDuration}s
                  </div>
                </div>
              </div>
            )}

            {validationError && (
              <div className="create-take-error">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                {validationError}
              </div>
            )}
          </div>

          {/* Form */}
          <div className="create-take-form">
            {/* Caption */}
            <div className="create-take-field">
              <label className="create-take-label">Caption</label>
              <textarea
                className="create-take-textarea"
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <span className="create-take-char-count">
                {caption.length}/500
              </span>
            </div>

            {/* Tags */}
            <div className="create-take-field">
              <label className="create-take-label">Tags</label>
              <div className="create-take-tags-input">
                <input
                  type="text"
                  className="create-take-tag-input"
                  placeholder="Add a tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button
                  type="button"
                  className="create-take-tag-add"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="create-take-tags">
                  {tags.map((tag) => (
                    <span key={tag} className="create-take-tag">
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Collaborators */}
            <div className="create-take-field">
              <div className="flex items-center justify-between mb-2">
                <label className="create-take-label" style={{ marginBottom: 0 }}>
                  Collaborators
                  <span className="text-muted text-xs ml-2">({collaborators.length}/10)</span>
                </label>
                <button
                  type="button"
                  className="create-take-tag-add"
                  onClick={() => setShowCollaboratorPicker(true)}
                >
                  + Add
                </button>
              </div>
              {collaborators.length > 0 ? (
                <div className="create-take-tags">
                  {collaborators.map((user) => (
                    <span key={user.id} className="create-take-tag" style={{ gap: '6px' }}>
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-medium">
                          {(user.display_name || user.username)[0].toUpperCase()}
                        </span>
                      )}
                      <span>{user.display_name || user.username}</span>
                      {user.role && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                          {user.role}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setCollaborators(collaborators.filter((c) => c.id !== user.id))}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted italic">No collaborators added yet</p>
              )}
            </div>

            {/* Tagged People */}
            <div className="create-take-field">
              <div className="flex items-center justify-between mb-2">
                <label className="create-take-label" style={{ marginBottom: 0 }}>
                  Tag People
                  <span className="text-muted text-xs ml-2">({taggedPeople.length}/50)</span>
                </label>
                <button
                  type="button"
                  className="create-take-tag-add"
                  onClick={() => setShowTagPeoplePicker(true)}
                >
                  + Add
                </button>
              </div>
              {taggedPeople.length > 0 ? (
                <div className="create-take-tags">
                  {taggedPeople.map((user) => (
                    <span key={user.id} className="create-take-tag" style={{ gap: '6px' }}>
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-medium">
                          {(user.display_name || user.username)[0].toUpperCase()}
                        </span>
                      )}
                      <span>@{user.username}</span>
                      <button
                        type="button"
                        onClick={() => setTaggedPeople(taggedPeople.filter((t) => t.id !== user.id))}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted italic">No people tagged yet</p>
              )}
            </div>

            {/* Community */}
            {communities && communities.length > 0 && (
              <div className="create-take-field">
                <label className="create-take-label">Post to Community</label>
                <button
                  type="button"
                  className="create-take-option-btn"
                  onClick={() => setShowCommunityPicker(!showCommunityPicker)}
                >
                  <FontAwesomeIcon icon={faUsers} />
                  {selectedCommunity
                    ? communities.find((c) => c.id === selectedCommunity)?.name
                    : "Select a community (optional)"}
                  {selectedCommunity && (
                    <button
                      className="create-take-option-clear"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCommunity(null);
                      }}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  )}
                </button>
                {showCommunityPicker && (
                  <div className="create-take-community-list">
                    {communities.map((community) => (
                      <button
                        key={community.id}
                        className={`create-take-community-item ${
                          selectedCommunity === community.id ? "selected" : ""
                        }`}
                        onClick={() => {
                          setSelectedCommunity(community.id);
                          setShowCommunityPicker(false);
                        }}
                      >
                        {community.avatar_url && (
                          <img
                            src={community.avatar_url}
                            alt={community.name}
                            className="create-take-community-avatar"
                          />
                        )}
                        <span>{community.name}</span>
                        {selectedCommunity === community.id && (
                          <FontAwesomeIcon icon={faCheck} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content Warning */}
            <div className="create-take-field">
              <label className="create-take-checkbox-label">
                <input
                  type="checkbox"
                  checked={showContentWarning}
                  onChange={(e) => setShowContentWarning(e.target.checked)}
                />
                <span>Add content warning</span>
              </label>
              {showContentWarning && (
                <input
                  type="text"
                  className="create-take-input"
                  placeholder="Describe the warning..."
                  value={contentWarning}
                  onChange={(e) => setContentWarning(e.target.value)}
                  maxLength={100}
                />
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="create-take-error">
                <FontAwesomeIcon icon={faExclamationTriangle} />
                {error}
              </div>
            )}

            {/* Submit */}
            <div className="create-take-actions">
              {onCancel && (
                <button
                  type="button"
                  className="create-take-cancel-btn"
                  onClick={onCancel}
                  disabled={uploading}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="create-take-submit-btn"
                onClick={handleSubmit}
                disabled={!videoFile || uploading}
              >
                {uploading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    Uploading... {Math.round(progress)}%
                  </>
                ) : (
                  "Post Take"
                )}
              </button>
            </div>

            {/* Upload progress bar */}
            {uploading && (
              <div className="create-take-progress">
                <div
                  className="create-take-progress-bar"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Collaborators Picker Modal */}
      {user && (
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
      )}

      {/* Tag People Picker Modal */}
      {user && (
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
      )}
    </div>
  );
}
