"use client";

import { memo } from "react";
import { TrashIcon } from "@/components/ui/Icons";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModalComponent({
  isOpen,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        e.stopPropagation();
        if (!isDeleting) onCancel();
      }}
    >
      <div
        className="bg-paper rounded-xl p-6 max-w-sm mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <TrashIcon className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-ink">Delete Post?</h3>
        </div>
        <p className="text-muted mb-6">
          This action cannot be undone. Your post and all its comments will be
          permanently deleted.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-ink hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export const DeleteConfirmModal = memo(DeleteConfirmModalComponent);
export default DeleteConfirmModal;
