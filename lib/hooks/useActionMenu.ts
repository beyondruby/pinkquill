"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Shared hook for action menu state and click-outside handling.
 * Replaces the duplicate pattern found in PostCard, CommentItem, TakeCard, etc.
 *
 * Usage:
 * ```tsx
 * const { showMenu, setShowMenu, menuRef, closeMenu } = useActionMenu();
 *
 * return (
 *   <div ref={menuRef}>
 *     <button onClick={() => setShowMenu(!showMenu)}>...</button>
 *     {showMenu && <Menu onClose={closeMenu} />}
 *   </div>
 * );
 * ```
 */
export function useActionMenu() {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setShowMenu(false);
  }, []);

  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  return {
    showMenu,
    setShowMenu,
    menuRef,
    closeMenu,
  };
}

/**
 * Extended action menu hook that also manages confirmation modals.
 * Use this when you need block/report/delete confirmations.
 *
 * Usage:
 * ```tsx
 * const {
 *   showMenu, setShowMenu, menuRef,
 *   showReportModal, setShowReportModal,
 *   showBlockConfirm, setShowBlockConfirm,
 *   showDeleteConfirm, setShowDeleteConfirm,
 *   blockLoading, setBlockLoading,
 *   resetAll
 * } = useActionMenuWithModals();
 * ```
 */
export function useActionMenuWithModals() {
  const { showMenu, setShowMenu, menuRef, closeMenu } = useActionMenu();

  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const resetAll = useCallback(() => {
    setShowMenu(false);
    setShowReportModal(false);
    setShowBlockConfirm(false);
    setShowDeleteConfirm(false);
    setBlockLoading(false);
    setDeleteLoading(false);
  }, [setShowMenu]);

  return {
    // Base menu
    showMenu,
    setShowMenu,
    menuRef,
    closeMenu,

    // Report modal
    showReportModal,
    setShowReportModal,
    openReportModal: useCallback(() => {
      setShowMenu(false);
      setShowReportModal(true);
    }, [setShowMenu]),

    // Block confirmation
    showBlockConfirm,
    setShowBlockConfirm,
    blockLoading,
    setBlockLoading,
    openBlockConfirm: useCallback(() => {
      setShowMenu(false);
      setShowBlockConfirm(true);
    }, [setShowMenu]),

    // Delete confirmation
    showDeleteConfirm,
    setShowDeleteConfirm,
    deleteLoading,
    setDeleteLoading,
    openDeleteConfirm: useCallback(() => {
      setShowMenu(false);
      setShowDeleteConfirm(true);
    }, [setShowMenu]),

    // Reset all state
    resetAll,
  };
}
