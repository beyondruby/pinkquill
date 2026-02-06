"use client";

import { memo, useRef, useEffect } from "react";
import {
  EllipsisIcon,
  TrashIcon,
  EditIcon,
  FlagIcon,
  BlockIcon,
} from "@/components/ui/Icons";

interface PostMenuProps {
  isOpen: boolean;
  isOwner: boolean;
  isAuthenticated: boolean;
  canModerateDelete?: boolean;
  canModeratePin?: boolean;
  isPinned?: boolean;
  blockedUsername?: string;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onModerateDelete?: () => void;
  onTogglePin?: () => void;
  onReport: () => void;
  onBlock: () => void;
}

function PostMenuComponent({
  isOpen,
  isOwner,
  isAuthenticated,
  canModerateDelete = false,
  canModeratePin = false,
  isPinned = false,
  blockedUsername,
  onToggle,
  onClose,
  onEdit,
  onDelete,
  onModerateDelete,
  onTogglePin,
  onReport,
  onBlock,
}: PostMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const renderPinAction = () => {
    if (!canModeratePin || !onTogglePin) return null;

    return (
      <button
        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 ${
          isPinned ? "text-orange-600 hover:bg-orange-50" : "text-purple-primary hover:bg-purple-primary/10"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
          onClose();
        }}
        role="menuitem"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
        </svg>
        {isPinned ? "Unpin (Mod)" : "Pin (Mod)"}
      </button>
    );
  };

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        className="post-menu-btn"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label="More options"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <EllipsisIcon className="w-4 h-4 text-muted" />
      </button>

      {isOpen && (isOwner || isAuthenticated) && (
        <div
          className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-[120]"
          onClick={(e) => e.stopPropagation()}
          role="menu"
          aria-label="Post options"
        >
          {isOwner ? (
            <>
              <button
                className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-gray-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                  onClose();
                }}
                role="menuitem"
              >
                <EditIcon className="w-4 h-4" />
                Edit
              </button>
              {canModeratePin && onTogglePin && (
                <>
                  <div className="h-px bg-black/[0.06] mx-3" role="separator" aria-hidden="true" />
                  {renderPinAction()}
                </>
              )}
              <button
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  onClose();
                }}
                role="menuitem"
              >
                <TrashIcon className="w-4 h-4" />
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-gray-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onBlock();
                  onClose();
                }}
                role="menuitem"
              >
                <BlockIcon className="w-4 h-4" />
                {blockedUsername ? `Block @${blockedUsername}` : "Block user"}
              </button>

              {(canModerateDelete && onModerateDelete) || (canModeratePin && onTogglePin) ? (
                <>
                  <div className="h-px bg-black/[0.06] mx-3" role="separator" aria-hidden="true" />
                  {canModerateDelete && onModerateDelete && (
                    <button
                      className="w-full px-4 py-2.5 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onModerateDelete();
                        onClose();
                      }}
                      role="menuitem"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete (Mod)
                    </button>
                  )}
                  {renderPinAction()}
                </>
              ) : null}

              <div className="h-px bg-black/[0.06] mx-3" role="separator" aria-hidden="true" />
              <button
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onReport();
                  onClose();
                }}
                role="menuitem"
              >
                <FlagIcon className="w-4 h-4" />
                Report
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const PostMenu = memo(PostMenuComponent);
export default PostMenu;
