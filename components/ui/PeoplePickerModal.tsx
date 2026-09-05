"use client";

import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTimes,
  faSearch,
  faUserPlus,
  faUsers,
  faCheck,
  faSpinner,
  faUserTag,
  faPen,
} from "@fortawesome/free-solid-svg-icons";
import { useUserSearch } from "@/lib/hooks.legacy";
import type { SearchableUser } from "@/lib/hooks.legacy";
import { getOptimizedAvatarUrl } from "@/lib/utils/image";
import Sheet from "./Sheet";
import Button from "./Button";

// Extended user with role for collaborators
export interface CollaboratorWithRole extends SearchableUser {
  role?: string;
}

// Preset roles for quick selection
const PRESET_ROLES = [
  "Co-writer",
  "Editor",
  "Illustrator",
  "Photographer",
  "Designer",
  "Musician",
  "Narrator",
  "Advisor",
];

interface PeoplePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedUsers: CollaboratorWithRole[]) => void;
  currentUserId: string;
  mode: "collaborators" | "mentions";
  initialSelected?: CollaboratorWithRole[];
  maxSelections?: number;
  excludeIds?: string[];
}

export default function PeoplePickerModal({
  isOpen,
  onClose,
  onConfirm,
  currentUserId,
  mode,
  initialSelected = [],
  maxSelections = mode === "collaborators" ? 10 : 50,
  excludeIds = [],
}: PeoplePickerModalProps) {
  const [selected, setSelected] = useState<CollaboratorWithRole[]>(initialSelected);
  const [query, setQuery] = useState("");
  const [editingRoleFor, setEditingRoleFor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading, search, suggestions } = useUserSearch(currentUserId);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelected(initialSelected);
      setQuery("");
      setEditingRoleFor(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialSelected]);

  // Search when query changes
  useEffect(() => {
    search(query);
  }, [query, search]);

  // Close on escape

  if (!isOpen) return null;

  const isSelected = (user: SearchableUser) =>
    selected.some((s) => s.id === user.id);

  const toggleUser = (user: SearchableUser) => {
    if (isSelected(user)) {
      setSelected(selected.filter((s) => s.id !== user.id));
      if (editingRoleFor === user.id) {
        setEditingRoleFor(null);
      }
    } else if (selected.length < maxSelections) {
      const newUser: CollaboratorWithRole = { ...user, role: undefined };
      setSelected([...selected, newUser]);
      // Auto-open role editor for collaborators mode
      if (mode === "collaborators") {
        setEditingRoleFor(user.id);
      }
    }
  };

  const removeUser = (userId: string) => {
    setSelected(selected.filter((s) => s.id !== userId));
    if (editingRoleFor === userId) {
      setEditingRoleFor(null);
    }
  };

  const setUserRole = (userId: string, role: string) => {
    setSelected(selected.map((s) =>
      s.id === userId ? { ...s, role: role || undefined } : s
    ));
  };

  const handleConfirm = () => {
    onConfirm(selected);
    onClose();
  };

  // Filter out excluded users and already selected from suggestions
  const filteredSuggestions = suggestions.filter(
    (user) => !excludeIds.includes(user.id) && !isSelected(user)
  );

  // Filter out excluded users from search results
  const filteredResults = results.filter(
    (user) => !excludeIds.includes(user.id)
  );

  const title = mode === "collaborators" ? "Add Collaborators" : "Tag People";
  const subtitle =
    mode === "collaborators"
      ? "Invite people to collaborate on this post"
      : "Tag people in this post";
  const icon = mode === "collaborators" ? faUsers : faUserTag;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="tall"
      bodyClassName="pq-dialog__body--flush"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={selected.length === 0}>
            {mode === "collaborators" ? "Add collaborators" : "Tag people"}
            {selected.length > 0 && ` (${selected.length})`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col min-h-0">
        {/* Search Input */}
        <div className="px-6 py-4">
          <div className="relative">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-subdued"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people..."
              className="pq-field pq-field--ui pl-11"
            />
            {loading && (
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className="absolute right-4 top-1/2 -translate-y-1/2 text-action-ink"
              />
            )}
          </div>
        </div>

        {/* Selected Users */}
        {selected.length > 0 && (
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-ink font-ui">
                Selected
              </span>
              <span className="text-xs px-2 py-0.5 bg-action-soft text-action-ink rounded-full font-ui">
                {selected.length}/{maxSelections}
              </span>
            </div>
            <div className="space-y-2">
              {selected.map((user) => (
                <div key={user.id} className="flex flex-col gap-2">
                  {/* User pill */}
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-line bg-surface">
                      <div className="relative">
                        {user.avatar_url ? (
                          <img
                            src={getOptimizedAvatarUrl(user.avatar_url)}
                            alt={user.display_name || user.username}
                            className="w-6 h-6 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full pq-avatar pq-avatar--sm">
                            {(user.display_name || user.username)[0].toUpperCase()}
                          </div>
                        )}
                        {user.is_verified && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-action rounded-full flex items-center justify-center">
                            <FontAwesomeIcon
                              icon={faCheck}
                              className="text-white text-[6px]"
                            />
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-ink font-ui">
                        {user.display_name || user.username}
                      </span>
                      {user.role && (
                        <span className="text-xs px-2 py-0.5 bg-action-soft text-action-ink rounded-full font-ui font-medium">
                          {user.role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {mode === "collaborators" && (
                        <button
                          onClick={() => setEditingRoleFor(editingRoleFor === user.id ? null : user.id)}
                          className="w-6 h-6 rounded-full hover:bg-tint flex items-center justify-center transition-colors"
                          title="Edit role"
                        >
                          <FontAwesomeIcon
                            icon={faPen}
                            className="text-action-ink text-[10px]"
                          />
                        </button>
                      )}
                      <button
                        onClick={() => removeUser(user.id)}
                        className="w-6 h-6 rounded-full hover:bg-red-100 flex items-center justify-center transition-colors"
                      >
                        <FontAwesomeIcon
                          icon={faTimes}
                          className="text-subdued hover:text-red-500 text-xs"
                        />
                      </button>
                    </div>
                  </div>

                  {/* Role editor (for collaborators mode) */}
                  {mode === "collaborators" && editingRoleFor === user.id && (
                    <div className="ml-8 flex flex-col gap-2 p-3 bg-subtle rounded-xl border border-line animate-fadeIn">
                      <label className="text-xs font-medium text-subdued font-ui">
                        Role (optional)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_ROLES.map((role) => (
                          <button
                            key={role}
                            onClick={() => {
                              setUserRole(user.id, role);
                              setEditingRoleFor(null);
                            }}
                            className={`px-2.5 py-1 text-xs font-medium rounded-full transition-all ${
                              user.role === role
                                ? "bg-action-soft text-action-ink"
                                : "bg-surface border border-line text-subdued hover:border-accent hover:text-accent"
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          placeholder="Or type custom role..."
                          value={user.role || ""}
                          onChange={(e) => setUserRole(user.id, e.target.value)}
                          className="flex-1 px-3 py-1.5 text-sm border border-line rounded-lg focus:outline-none focus:border-action focus:ring-[3px] focus:ring-action-soft font-ui"
                        />
                        <button
                          onClick={() => setEditingRoleFor(null)}
                          className="px-3 py-1.5 text-xs font-medium text-action-ink hover:bg-tint rounded-lg transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results / Suggestions */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 max-h-[300px]">
          {query.trim() ? (
            <>
              {filteredResults.length > 0 ? (
                <div className="space-y-1">
                  {filteredResults.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      isSelected={isSelected(user)}
                      onClick={() => toggleUser(user)}
                      disabled={
                        !isSelected(user) && selected.length >= maxSelections
                      }
                    />
                  ))}
                </div>
              ) : !loading ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-skeleton flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faSearch}
                      className="text-subdued text-xl"
                    />
                  </div>
                  <p className="text-subdued font-ui">No users found</p>
                  <p className="text-sm text-subdued font-ui">
                    Try a different search term
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {filteredSuggestions.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon
                      icon={faUserPlus}
                      className="text-action-ink text-sm"
                    />
                    <span className="text-sm font-medium text-ink font-ui">
                      Suggestions
                    </span>
                  </div>
                  <div className="space-y-1">
                    {filteredSuggestions.slice(0, 10).map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        isSelected={isSelected(user)}
                        onClick={() => toggleUser(user)}
                        disabled={
                          !isSelected(user) && selected.length >= maxSelections
                        }
                      />
                    ))}
                  </div>
                </>
              )}
              {filteredSuggestions.length === 0 && selected.length === 0 && (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-skeleton flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faSearch}
                      className="text-subdued text-xl"
                    />
                  </div>
                  <p className="text-subdued font-ui">
                    Search for people to{" "}
                    {mode === "collaborators" ? "collaborate with" : "tag"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </Sheet>
  );
}

// User Row Component
interface UserRowProps {
  user: SearchableUser;
  isSelected: boolean;
  onClick: () => void;
  disabled: boolean;
}

function UserRow({ user, isSelected, onClick, disabled }: UserRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
        isSelected
          ? "bg-action-soft"
          : disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-subtle border border-transparent"
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {user.avatar_url ? (
          <img
            src={getOptimizedAvatarUrl(user.avatar_url)}
            alt={user.display_name || user.username}
            className="w-10 h-10 rounded-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-10 h-10 rounded-full pq-avatar">
            {(user.display_name || user.username)[0].toUpperCase()}
          </div>
        )}
        {user.is_verified && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-action rounded-full flex items-center justify-center border-2 border-white">
            <FontAwesomeIcon icon={faCheck} className="text-white text-[8px]" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 text-left">
        <div className="font-medium text-ink font-ui">
          {user.display_name || user.username}
        </div>
        <div className="text-sm text-subdued font-ui">@{user.username}</div>
      </div>

      {/* Selection indicator */}
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
          isSelected
            ? "bg-action"
            : "border-2 border-gray-300"
        }`}
      >
        {isSelected && (
          <FontAwesomeIcon icon={faCheck} className="text-white text-xs" />
        )}
      </div>
    </button>
  );
}
