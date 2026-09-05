"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { EllipsisIcon } from "@/components/ui/Icons";
import { useOverlayLayer } from "./overlay/useOverlayLayer";

export interface ActionMenuItem {
  label: string;
  onSelect?: () => void | Promise<void>;
  href?: string;
  icon?: ReactNode;
  description?: string;
  meta?: ReactNode;
  sectionLabel?: string;
  tone?: "default" | "danger" | "success" | "accent" | "warning";
  disabled?: boolean;
  hidden?: boolean;
  dividerBefore?: boolean;
  closeOnSelect?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  label?: string;
  description?: string;
  trigger?: ReactNode;
  footer?: ReactNode | ((close: () => void) => ReactNode);
  buttonClassName?: string;
  buttonIconClassName?: string;
  menuClassName?: string;
  widthClassName?: string;
  buttonAriaLabel?: string;
  buttonDisabled?: boolean;
  portal?: boolean;
  portalOffset?: number;
  align?: "start" | "end";
  placement?: "bottom" | "top" | "auto";
  onOpenChange?: (open: boolean) => void;
}

const MENU_ITEM_SELECTOR = "[role='menuitem']:not([aria-disabled='true'])";

/**
 * Anchored menu for short choices. Opens beside its trigger on the content
 * edge, flips when there is no room, dismisses on Escape or outside press,
 * supports arrow/Home/End traversal, and returns focus to the trigger.
 * Registered as an overlay layer (without scroll lock) so Escape inside a
 * menu never also closes the sheet or dialog beneath it.
 */
export default function ActionMenu({
  items,
  label,
  description,
  trigger,
  footer,
  buttonClassName,
  buttonIconClassName,
  menuClassName,
  widthClassName = "w-56",
  buttonAriaLabel = "More actions",
  buttonDisabled = false,
  portal = false,
  portalOffset = 8,
  align = "end",
  placement = "auto",
  onOpenChange,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const setOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      onOpenChange?.(open);
      if (!open) setMenuPosition(null);
    },
    [onOpenChange]
  );
  const close = useCallback(() => setOpen(false), [setOpen]);

  useOverlayLayer({
    open: isOpen,
    onClose: close,
    containerRef: menuRef,
    lockScroll: false,
    trapFocus: false,
    initialFocus: () => menuRef.current?.querySelector<HTMLElement>(MENU_ITEM_SELECTOR),
  });

  const visibleItems = useMemo(() => items.filter((item) => !item.hidden), [items]);

  const positionMenu = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const menuWidth = menuRef.current?.offsetWidth || 288;
    const menuHeight = menuRef.current?.offsetHeight || 320;
    const roomBelow = window.innerHeight - rect.bottom - viewportPadding;
    const roomAbove = rect.top - viewportPadding;
    const shouldOpenTop =
      placement === "top" ||
      (placement === "auto" && roomBelow < menuHeight && roomAbove > roomBelow);
    const desiredLeft = align === "end" ? rect.right - menuWidth : rect.left;
    const left = Math.min(
      Math.max(viewportPadding, desiredLeft),
      Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding)
    );
    const top = shouldOpenTop
      ? Math.max(viewportPadding, rect.top - menuHeight - portalOffset)
      : Math.min(
          rect.bottom + portalOffset,
          window.innerHeight - viewportPadding - Math.min(menuHeight, window.innerHeight - viewportPadding * 2)
        );

    setMenuPosition({ top, left });
  }, [align, placement, portalOffset]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedButton && !clickedMenu) setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen, setOpen]);

  useEffect(() => {
    if (!isOpen || !portal) return;

    let measureFrame: number | undefined;
    const initialFrame = window.requestAnimationFrame(() => {
      positionMenu();
      measureFrame = window.requestAnimationFrame(positionMenu);
    });

    const reposition = () => positionMenu();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      if (measureFrame !== undefined) window.cancelAnimationFrame(measureFrame);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen, portal, positionMenu]);

  if (visibleItems.length === 0) return null;

  const resolvedPlacement = placement === "top" ? "top" : "bottom";
  const defaultMenuClassName = `pq-menu ${portal ? "" : "pq-menu--local "}${widthClassName}`;
  const resolvedMenuClassName = menuClassName || defaultMenuClassName;
  const portalMenuStyle: CSSProperties | undefined =
    portal && menuPosition
      ? { position: "fixed", top: menuPosition.top, left: menuPosition.left }
      : undefined;

  const focusMenuItem = (direction: "next" | "prev" | "first" | "last") => {
    const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR) || []);
    if (menuItems.length === 0) return;

    const activeIndex = menuItems.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      direction === "first"
        ? 0
        : direction === "last"
        ? menuItems.length - 1
        : direction === "next"
        ? (activeIndex + 1) % menuItems.length
        : (activeIndex - 1 + menuItems.length) % menuItems.length;
    menuItems[nextIndex]?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem("next");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem("prev");
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem("first");
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem("last");
    } else if (event.key === "Tab") {
      // A menu is a transient list; Tab leaves it rather than cycling inside.
      setOpen(false);
    }
  };

  const footerContent = typeof footer === "function" ? footer(close) : footer;

  const menuContent = isOpen ? (
    <div
      ref={menuRef}
      className={resolvedMenuClassName}
      style={portal ? portalMenuStyle : undefined}
      data-align={align}
      data-placement={resolvedPlacement}
      role="menu"
      aria-label={label || buttonAriaLabel}
      onKeyDown={handleMenuKeyDown}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {description && <p className="pq-menu__section">{description}</p>}
      {visibleItems.map((item, index) => {
        const tone = item.tone || "default";
        const previousSectionLabel = visibleItems[index - 1]?.sectionLabel;
        const showSectionLabel = item.sectionLabel && item.sectionLabel !== previousSectionLabel;

        const itemClassName = `pq-menu__item${tone !== "default" ? ` pq-menu__item--${tone}` : ""}`;
        const content = (
          <>
            {item.icon ? <span className="pq-menu__icon">{item.icon}</span> : null}
            <span className="pq-menu__text">
              <span className="pq-menu__label">{item.label}</span>
              {item.description && <span className="pq-menu__description">{item.description}</span>}
            </span>
            {item.meta ? <span className="pq-menu__meta">{item.meta}</span> : null}
          </>
        );

        return (
          <div key={`${item.label}-${index}`}>
            {item.dividerBefore && <div className="pq-menu__divider" role="separator" />}
            {showSectionLabel && <p className="pq-menu__section">{item.sectionLabel}</p>}
            {item.href && !item.disabled ? (
              <Link
                href={item.href}
                role="menuitem"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  if (item.closeOnSelect !== false) setOpen(false);
                  void item.onSelect?.();
                }}
                className={itemClassName}
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                disabled={item.disabled}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (item.disabled) return;
                  if (item.closeOnSelect !== false) setOpen(false);
                  void item.onSelect?.();
                }}
                className={itemClassName}
              >
                {content}
              </button>
            )}
          </div>
        );
      })}
      {footerContent && (
        <>
          <div className="pq-menu__divider" role="separator" />
          {footerContent}
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={buttonAriaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={buttonDisabled}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (buttonDisabled) return;
          setOpen(!isOpen);
        }}
        className={buttonClassName || "pq-menu-trigger"}
      >
        {trigger || <EllipsisIcon className={buttonIconClassName} />}
      </button>

      {portal ? (menuContent && menuPosition ? createPortal(menuContent, document.body) : null) : menuContent}
    </div>
  );
}
