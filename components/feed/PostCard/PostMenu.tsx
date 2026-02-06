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
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onBlock: () => void;
}

function PostMenuComponent({
  isOpen,
  isOwner,
  onToggle,
  onClose,
  onEdit,
  onDelete,
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="action-btn p-1.5 rounded-full hover:bg-gray-100 transition-colors"
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

      {isOpen && (
        <div className="absolute right-0 top-8 bg-paper rounded-lg shadow-lg border border-gray-100 py-1 min-w-[160px] z-50">
          {isOwner ? (
            <>
              <button
                className="w-full px-4 py-2 text-left text-sm text-ink hover:bg-gray-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                  onClose();
                }}
              >
                <EditIcon className="w-4 h-4" />
                Edit post
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  onClose();
                }}
              >
                <TrashIcon className="w-4 h-4" />
                Delete post
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full px-4 py-2 text-left text-sm text-ink hover:bg-gray-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onReport();
                  onClose();
                }}
              >
                <FlagIcon className="w-4 h-4" />
                Report post
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onBlock();
                  onClose();
                }}
              >
                <BlockIcon className="w-4 h-4" />
                Block user
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
