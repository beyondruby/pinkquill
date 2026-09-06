"use client";

import { useState } from "react";
import { DEFAULT_MODERATOR_PERMISSIONS } from "@/lib/types";
import type { ModeratorPermissions } from "@/lib/types";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { Switch } from "@/components/create/pieces";

interface ModeratorPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (permissions: ModeratorPermissions) => void;
  userName: string;
  initialPermissions?: ModeratorPermissions;
  loading?: boolean;
  isEditing?: boolean;
}

const PERMISSIONS: { key: keyof ModeratorPermissions; label: string; description: string }[] = [
  { key: "can_mute", label: "Mute members", description: "Silence someone from posting and commenting for a while." },
  { key: "can_ban", label: "Ban members", description: "Remove someone, for a while or for good." },
  { key: "can_delete_posts", label: "Delete posts", description: "Remove posts that break the rules." },
  { key: "can_delete_comments", label: "Delete comments", description: "Remove comments that break the rules." },
  { key: "can_pin_posts", label: "Pin posts", description: "Keep a post at the top of the feed." },
  { key: "can_manage_rules", label: "Edit rules", description: "Add, change and remove the community's rules." },
  { key: "can_send_community_chat_messages", label: "Post in community chat", description: "Send announcements in the community-wide thread." },
];

const ALL_ON: ModeratorPermissions = { can_mute: true, can_ban: true, can_delete_posts: true, can_delete_comments: true, can_pin_posts: true, can_manage_rules: true, can_send_community_chat_messages: true };
const ALL_OFF: ModeratorPermissions = { can_mute: false, can_ban: false, can_delete_posts: false, can_delete_comments: false, can_pin_posts: false, can_manage_rules: false, can_send_community_chat_messages: false };

/** What a moderator may do, as plain switches on the shared Sheet. Mount with a `key` per target so it starts from their permissions. */
export default function ModeratorPermissionsModal({ isOpen, onClose, onConfirm, userName, initialPermissions, loading = false, isEditing = false }: ModeratorPermissionsModalProps) {
  const [permissions, setPermissions] = useState<ModeratorPermissions>(initialPermissions || DEFAULT_MODERATOR_PERMISSIONS);

  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `What ${userName} can do` : `Make ${userName} a moderator`}
      subtitle={`${enabledCount} of ${PERMISSIONS.length} on. Admins can change this any time.`}
      busy={loading}
      size="tall"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(permissions)} disabled={enabledCount === 0} loading={loading} loadingText="Saving…">
            {isEditing ? "Save" : "Make moderator"}
          </Button>
        </>
      }
    >
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => setPermissions(ALL_ON)}>Turn all on</Button>
        <Button variant="ghost" size="sm" onClick={() => setPermissions(ALL_OFF)}>Turn all off</Button>
      </div>
      <div className="grid gap-3">
        {PERMISSIONS.map((option) => (
          <div key={option.key} className="pq-switch-row">
            <span>
              <span className="block font-medium">{option.label}</span>
              <span className="block text-sm text-subdued">{option.description}</span>
            </span>
            <Switch checked={permissions[option.key]} onChange={(next) => setPermissions((prev) => ({ ...prev, [option.key]: next }))} label={option.label} />
          </div>
        ))}
      </div>
    </Sheet>
  );
}
