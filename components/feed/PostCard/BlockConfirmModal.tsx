"use client";

import { memo } from "react";
import { BlockIcon } from "@/components/ui/Icons";

interface BlockConfirmModalProps {
  isOpen: boolean;
  isLoading: boolean;
  username: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function BlockConfirmModalComponent({
  isOpen,
  isLoading,
  username,
  onConfirm,
  onCancel,
}: BlockConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        e.stopPropagation();
        if (!isLoading) onCancel();
      }}
    >
      <div
        className="bg-paper rounded-xl p-6 max-w-sm mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <BlockIcon className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-ink">Block @{username}?</h3>
        </div>
        <p className="text-muted mb-6">
          They won&apos;t be able to see your posts, follow you, or message you.
          You can unblock them anytime from Settings &gt; Privacy.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-ink hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Blocking...
              </>
            ) : (
              "Block"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export const BlockConfirmModal = memo(BlockConfirmModalComponent);
export default BlockConfirmModal;
