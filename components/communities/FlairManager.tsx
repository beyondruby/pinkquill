"use client";

import React, { useState } from "react";
import { useCommunityFlairs, useManageFlairs } from "@/lib/hooks/useFlair";
import FlairBadge from "./FlairBadge";
import type { CommunityFlair } from "@/lib/types";

interface FlairManagerProps {
  communityId: string;
}

const MAX_FLAIRS = 20;

const DEFAULT_COLORS = [
  "#8e44ad", // Purple (default)
  "#e74c3c", // Red
  "#3498db", // Blue
  "#27ae60", // Green
  "#f39c12", // Orange
  "#9b59b6", // Violet
  "#1abc9c", // Teal
  "#e91e63", // Pink
  "#00bcd4", // Cyan
  "#795548", // Brown
];

/**
 * FlairManager - Admin panel for creating, editing, and deleting flairs
 */
export default function FlairManager({ communityId }: FlairManagerProps) {
  const { flairs, loading, refetch } = useCommunityFlairs(communityId);
  const {
    createFlair,
    updateFlair,
    deleteFlair,
    reorderFlairs,
    loading: saving,
  } = useManageFlairs(communityId);

  const [showForm, setShowForm] = useState(false);
  const [editingFlair, setEditingFlair] = useState<CommunityFlair | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: DEFAULT_COLORS[0],
    emoji: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const resetForm = () => {
    setFormData({ name: "", color: DEFAULT_COLORS[0], emoji: "" });
    setEditingFlair(null);
    setShowForm(false);
  };

  const handleEdit = (flair: CommunityFlair) => {
    setEditingFlair(flair);
    setFormData({
      name: flair.name,
      color: flair.color,
      emoji: flair.emoji || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) return;

    if (editingFlair) {
      const success = await updateFlair({
        id: editingFlair.id,
        name: formData.name.trim(),
        color: formData.color,
        emoji: formData.emoji || null,
      });
      if (success) {
        refetch();
        resetForm();
      }
    } else {
      const flair = await createFlair({
        name: formData.name.trim(),
        color: formData.color,
        emoji: formData.emoji || null,
      });
      if (flair) {
        refetch();
        resetForm();
      }
    }
  };

  const handleDelete = async (flairId: string) => {
    const success = await deleteFlair(flairId);
    if (success) {
      refetch();
      setDeleteConfirm(null);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newOrder = [...flairs];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    const success = await reorderFlairs(newOrder.map((f) => f.id));
    if (success) refetch();
  };

  const handleMoveDown = async (index: number) => {
    if (index === flairs.length - 1) return;
    const newOrder = [...flairs];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    const success = await reorderFlairs(newOrder.map((f) => f.id));
    if (success) refetch();
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-muted">Loading flairs...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold font-display text-ink">
            Post Flairs
          </h3>
          <p className="text-sm text-muted">
            Create categories for posts in your community ({flairs.length}/
            {MAX_FLAIRS})
          </p>
        </div>
        {!showForm && flairs.length < MAX_FLAIRS && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-primary/90 transition-colors font-ui text-sm"
          >
            Add Flair
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-gray-50 rounded-lg p-4 space-y-4"
        >
          <div className="flex items-start gap-4">
            {/* Emoji Input */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Emoji
              </label>
              <input
                type="text"
                value={formData.emoji}
                onChange={(e) =>
                  setFormData({ ...formData, emoji: e.target.value.slice(0, 2) })
                }
                placeholder="Optional"
                className="w-16 px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-primary focus:outline-none text-center"
                maxLength={2}
              />
            </div>

            {/* Name Input */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-ink mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Discussion, Question, Announcement"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-purple-primary focus:outline-none"
                maxLength={30}
                required
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    formData.color === color
                      ? "ring-2 ring-offset-2 ring-purple-primary scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
              {/* Custom color input */}
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData({ ...formData, color: e.target.value })
                }
                className="w-8 h-8 rounded-full cursor-pointer border-0 p-0"
                title="Custom color"
              />
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-ink mb-2">
              Preview
            </label>
            <FlairBadge
              flair={{
                id: "preview",
                community_id: communityId,
                name: formData.name || "Flair Name",
                color: formData.color,
                emoji: formData.emoji || null,
                position: 0,
                created_at: "",
              }}
              size="md"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-muted hover:text-ink transition-colors font-ui text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.name.trim() || saving}
              className="px-4 py-2 bg-purple-primary text-white rounded-lg hover:bg-purple-primary/90 transition-colors font-ui text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? "Saving..."
                : editingFlair
                  ? "Update Flair"
                  : "Create Flair"}
            </button>
          </div>
        </form>
      )}

      {/* Flairs List */}
      {flairs.length > 0 ? (
        <div className="space-y-2">
          {flairs.map((flair, index) => (
            <div
              key={flair.id}
              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200"
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || saving}
                  className="p-1 text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === flairs.length - 1 || saving}
                  className="p-1 text-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              {/* Flair badge */}
              <FlairBadge flair={flair} size="md" />

              {/* Spacer */}
              <div className="flex-1" />

              {/* Edit/Delete buttons */}
              <button
                onClick={() => handleEdit(flair)}
                className="p-2 text-muted hover:text-purple-primary transition-colors"
                title="Edit flair"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>

              {deleteConfirm === flair.id ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDelete(flair.id)}
                    className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-2 py-1 text-muted text-xs hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(flair.id)}
                  className="p-2 text-muted hover:text-red-500 transition-colors"
                  title="Delete flair"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-8 text-muted">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <p>No flairs yet</p>
            <p className="text-sm mt-1">
              Create flairs to help categorize posts in your community
            </p>
          </div>
        )
      )}
    </div>
  );
}
