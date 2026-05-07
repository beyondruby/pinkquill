"use client";

import React, { useState } from "react";
import { ModeratorPermissions, DEFAULT_MODERATOR_PERMISSIONS } from "@/lib/hooks";

interface ModeratorPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (permissions: ModeratorPermissions) => void;
  userName: string;
  initialPermissions?: ModeratorPermissions;
  loading?: boolean;
  isEditing?: boolean;
}

interface PermissionOption {
  key: keyof ModeratorPermissions;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const permissionOptions: PermissionOption[] = [
  {
    key: "can_mute",
    label: "Mute Members",
    description: "Temporarily silence members from posting or commenting",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
      </svg>
    ),
    color: "yellow",
  },
  {
    key: "can_ban",
    label: "Ban Members",
    description: "Remove members from the community permanently or temporarily",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    color: "red",
  },
  {
    key: "can_delete_posts",
    label: "Delete Posts",
    description: "Remove posts that violate community guidelines",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    color: "orange",
  },
  {
    key: "can_delete_comments",
    label: "Delete Comments",
    description: "Remove comments that violate community guidelines",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
    color: "orange",
  },
  {
    key: "can_pin_posts",
    label: "Pin Posts",
    description: "Pin important posts to the top of the community feed",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
      </svg>
    ),
    color: "purple",
  },
  {
    key: "can_manage_rules",
    label: "Manage Rules",
    description: "Create, edit, and delete community rules",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: "blue",
  },
  {
    key: "can_send_community_chat_messages",
    label: "Community Chat Broadcasts",
    description: "Send announcements in the community-wide chat thread",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-3 3v-3z" />
      </svg>
    ),
    color: "purple",
  },
];

const colorClasses: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  yellow: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-600", ring: "ring-yellow-400" },
  red: { bg: "bg-red-50", border: "border-red-200", text: "text-red-500", ring: "ring-red-400" },
  orange: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-500", ring: "ring-orange-400" },
  purple: { bg: "bg-accent/10", border: "border-purple-200", text: "text-purple-600", ring: "ring-purple-400" },
  blue: { bg: "bg-purple-primary/[0.04]", border: "border-purple-primary/15", text: "text-purple-primary", ring: "ring-purple-primary" },
};

export default function ModeratorPermissionsModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  initialPermissions,
  loading = false,
  isEditing = false,
}: ModeratorPermissionsModalProps) {
  const [permissions, setPermissions] = useState<ModeratorPermissions>(
    initialPermissions || DEFAULT_MODERATOR_PERMISSIONS
  );

  if (!isOpen) return null;

  const togglePermission = (key: keyof ModeratorPermissions) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selectAll = () => {
    setPermissions({
      can_mute: true,
      can_ban: true,
      can_delete_posts: true,
      can_delete_comments: true,
      can_pin_posts: true,
      can_manage_rules: true,
      can_send_community_chat_messages: true,
    });
  };

  const selectNone = () => {
    setPermissions({
      can_mute: false,
      can_ban: false,
      can_delete_posts: false,
      can_delete_comments: false,
      can_pin_posts: false,
      can_manage_rules: false,
      can_send_community_chat_messages: false,
    });
  };

  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border-light bg-gradient-to-r from-purple-primary/5 to-pink-vivid/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-primary to-purple-primary/90 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">
                {isEditing ? 'Edit Permissions' : 'Moderator Permissions'}
              </h3>
              <p className="font-body text-sm text-muted">
                {isEditing ? 'Update' : 'Set'} permissions for <span className="font-medium text-ink">{userName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-3 border-b border-border-light flex items-center justify-between">
          <span className="font-ui text-sm text-muted">
            {enabledCount} of {permissionOptions.length} enabled
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 rounded-lg text-xs font-ui font-medium text-purple-primary hover:bg-accent/10 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="px-3 py-1.5 rounded-lg text-xs font-ui font-medium text-muted hover:bg-skeleton transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Permissions Grid */}
        <div className="p-6 max-h-[400px] overflow-y-auto">
          <div className="space-y-3">
            {permissionOptions.map((option) => {
              const isEnabled = permissions[option.key];
              const colors = colorClasses[option.color];

              return (
                <button
                  key={option.key}
                  onClick={() => togglePermission(option.key)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    isEnabled
                      ? `${colors.bg} ${colors.border} ring-2 ${colors.ring}/20`
                      : "bg-surface border-border-light hover:border-border-light"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      isEnabled ? colors.bg : "bg-skeleton"
                    }`}
                  >
                    <span className={isEnabled ? colors.text : "text-muted"}>
                      {option.icon}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-ui font-medium ${isEnabled ? "text-ink" : "text-ink/70"}`}>
                        {option.label}
                      </p>
                      {isEnabled && (
                        <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-semibold uppercase ${colors.bg} ${colors.text}`}>
                          Enabled
                        </span>
                      )}
                    </div>
                    <p className="font-body text-sm text-muted mt-0.5">
                      {option.description}
                    </p>
                  </div>

                  {/* Toggle indicator */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-10 h-6 rounded-full transition-colors ${
                        isEnabled ? "bg-gradient-to-r from-purple-primary to-pink-vivid" : "bg-black/10"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-surface shadow-md transform transition-transform mt-0.5 ${
                          isEnabled ? "translate-x-4.5 ml-0.5" : "translate-x-0.5"
                        }`}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light flex gap-3 bg-subtle">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border-light font-ui text-sm font-medium text-ink hover:bg-surface transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(permissions)}
            disabled={loading || enabledCount === 0}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:shadow-lg hover:shadow-pink-vivid/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isEditing ? 'Update Permissions' : 'Make Moderator'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
