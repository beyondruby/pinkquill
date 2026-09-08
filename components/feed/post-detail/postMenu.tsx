import { icons } from "@/components/ui/Icons";
import type { ActionMenuItem } from "@/components/ui/ActionMenu";

interface PostMenuHandlers {
  isOwner: boolean;
  signedIn: boolean;
  isAcceptedCollaborator: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRemoveCollab: () => void;
  onBlock: () => void;
  onReport: () => void;
}

/** The post options menu, identical on the detail modal and the post page (V-4). */
export function buildPostMenuItems(h: PostMenuHandlers): ActionMenuItem[] {
  if (h.isOwner) {
    return [
      { label: "Edit", onSelect: h.onEdit, icon: icons.edit },
      { label: "Delete", onSelect: h.onDelete, icon: icons.trash, tone: "danger" },
    ];
  }
  if (!h.signedIn) return [];
  return [
    ...(h.isAcceptedCollaborator
      ? [
          {
            label: "Remove me as collaborator",
            onSelect: h.onRemoveCollab,
            icon: (
              <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 8a4 4 0 11-8 0 4 4 0 018 0zM2 20v-1a5 5 0 015-5h2a5 5 0 015 5v1M16 11h6" />
              </svg>
            ),
            tone: "warning" as const,
          },
        ]
      : []),
    { label: "Block", onSelect: h.onBlock, icon: icons.block, dividerBefore: h.isAcceptedCollaborator },
    { label: "Report", onSelect: h.onReport, icon: icons.flag, tone: "danger" },
  ];
}
