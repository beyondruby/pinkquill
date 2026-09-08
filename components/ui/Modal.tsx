"use client";

import { useRef } from "react";
import { useDialog } from "@/lib/hooks/useDialog";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}

export default function Modal({ isOpen, onClose, children, ariaLabel = "Modal dialog" }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useDialog(isOpen, modalRef, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="pq-modal-backdrop fixed inset-0 bg-black/90 backdrop-blur-xl z-(--z-modal) flex justify-center items-center md:items-center opacity-0 animate-fadeIn"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="pq-modal-card w-full h-full md:w-[95%] md:max-w-[1000px] md:h-[90vh] bg-elevated md:rounded-3xl shadow-2xl flex flex-col overflow-hidden scale-100 md:scale-95 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}