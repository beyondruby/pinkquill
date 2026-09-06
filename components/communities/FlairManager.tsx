"use client";

import React, { useState } from "react";
import { useCommunityFlairs, useManageFlairs } from "@/lib/hooks/useFlair";
import FlairBadge from "./FlairBadge";
import type { CommunityFlair } from "@/lib/types";
import Button from "@/components/ui/Button";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { FieldLabel } from "@/components/create/pieces";
import { Spinner } from "@/components/ui/Loading";

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
    return <div className="pq-feed-state" role="status" aria-label="Loading flairs"><Spinner size="lg" /></div>;
  }

  const pendingDelete = flairs.find((f) => f.id === deleteConfirm) || null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-subdued">{flairs.length} of {MAX_FLAIRS} flairs.</p>
        {!showForm && flairs.length < MAX_FLAIRS && (
          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>Add a flair</Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="pq-panel grid gap-4">
          <p className="pq-panel__title">{editingFlair ? "Edit flair" : "New flair"}</p>
          <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
            <div>
              <FieldLabel htmlFor="flair-emoji" hint="(optional)">Emoji</FieldLabel>
              <input id="flair-emoji" type="text" className="pq-field pq-field--ui text-center" value={formData.emoji} onChange={(e) => setFormData({ ...formData, emoji: e.target.value.slice(0, 2) })} maxLength={2} />
            </div>
            <div>
              <FieldLabel htmlFor="flair-name">Name</FieldLabel>
              <input id="flair-name" type="text" className="pq-field pq-field--ui" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Question, Work in progress, Finished piece" maxLength={30} required />
            </div>
          </div>
          <div>
            <p className="pq-label">Colour</p>
            <div className="pq-swatches" role="radiogroup" aria-label="Colour">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={formData.color === color}
                  aria-label={color}
                  className="pq-swatch"
                  style={{ background: color, outline: formData.color === color ? "3px solid var(--color-action)" : undefined, outlineOffset: 2 }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
              <input type="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="pq-swatch p-0" aria-label="Custom colour" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="pq-label m-0">Preview</span>
            <FlairBadge flair={{ id: "preview", community_id: communityId, name: formData.name || "Flair", color: formData.color, emoji: formData.emoji || null, position: 0, created_at: "" }} size="md" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={!formData.name.trim()} loading={saving} loadingText="Saving…">
              {editingFlair ? "Save" : "Create flair"}
            </Button>
          </div>
        </form>
      )}

      {flairs.length > 0 ? (
        <ol className="pq-list list-none m-0 p-0" aria-label="Flairs">
          {flairs.map((flair, index) => (
            <li key={flair.id} className="pq-person">
              <div className="pq-person__row">
                <div className="flex flex-col">
                  <button type="button" className="pq-icon-button" style={{ inlineSize: "2rem", blockSize: "1.5rem" }} onClick={() => handleMoveUp(index)} disabled={index === 0 || saving} aria-label={`Move ${flair.name} up`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-3.5 h-3.5"><path d="M6 15l6-6 6 6" /></svg>
                  </button>
                  <button type="button" className="pq-icon-button" style={{ inlineSize: "2rem", blockSize: "1.5rem" }} onClick={() => handleMoveDown(index)} disabled={index === flairs.length - 1 || saving} aria-label={`Move ${flair.name} down`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-3.5 h-3.5"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                </div>
                <div className="pq-person__text"><FlairBadge flair={flair} size="md" /></div>
                <div className="pq-person__trailing">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(flair)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(flair.id)}>Delete</Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        !showForm && (
          <div className="pq-feed-state pq-feed-state--card">
            <p className="pq-feed-state__title">No flairs yet</p>
            <p className="pq-feed-state__text">Flairs are optional labels members choose when they post here.</p>
          </div>
        )
      )}

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => { if (pendingDelete) void handleDelete(pendingDelete.id); }}
        title={`Delete the ${pendingDelete?.name || ""} flair?`}
        description="Posts that carry it lose the label. Nothing else changes."
        confirmText="Delete"
        isDanger
        loading={saving}
      />
    </div>
  );
}
