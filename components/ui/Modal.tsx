"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}

export default function Modal({ isOpen, onClose, children, ariaLabel = "Modal dialog" }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key and trap focus
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      // Focus the modal when it opens
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[2000] flex justify-center items-center md:items-center opacity-0 animate-fadeIn"
      onClick={onClose}
      role="presentation"
      aria-hidden="true"
    >
      <div
        ref={modalRef}
        className="w-full h-full md:w-[95%] md:max-w-[1000px] md:h-[90vh] bg-white md:rounded-3xl shadow-2xl flex flex-col overflow-hidden scale-100 md:scale-95 animate-scaleIn"
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