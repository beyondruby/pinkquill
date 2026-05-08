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

const ITEM_STYLES: Record<NonNullable<ActionMenuItem["tone"]>, string> = {
  default: "text-ink hover:bg-skeleton/60 focus-visible:bg-skeleton/60",
  danger: "text-red-600 hover:bg-red-50 focus-visible:bg-red-50",
  success: "text-emerald-700 hover:bg-emerald-50 focus-visible:bg-emerald-50",
  accent: "text-purple-primary hover:bg-purple-50/70 focus-visible:bg-purple-50/70",
  warning: "text-orange-600 hover:bg-orange-50 focus-visible:bg-orange-50",
};

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

  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items]
  );

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
      : Math.min(rect.bottom + portalOffset, window.innerHeight - viewportPadding - Math.min(menuHeight, window.innerHeight - viewportPadding * 2));

    setMenuPosition({
      top,
      left,
    });
  }, [align, placement, portalOffset]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedButton && !clickedMenu) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
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

  useEffect(() => {
    if (!isOpen) return;

    const firstItem = menuRef.current?.querySelector<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])");
    window.setTimeout(() => firstItem?.focus(), 0);
  }, [isOpen]);

  if (visibleItems.length === 0) return null;

  const localPlacementClass =
    placement === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";
  const defaultMenuClassName = `${
    portal ? "" : `absolute ${align === "end" ? "right-0" : "left-0"} ${localPlacementClass} `
  }${widthClassName} max-w-[calc(100vw-1.5rem)] max-h-[min(72vh,34rem)] overflow-y-auto bg-surface rounded-xl shadow-lg border border-border-light z-50 animate-fadeIn p-1`;
  const resolvedMenuClassName = menuClassName || defaultMenuClassName;
  const portalMenuStyle: CSSProperties | undefined =
    portal && menuPosition
      ? {
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          zIndex: 9999,
        }
      : undefined;

  const focusMenuItem = (direction: "next" | "prev" | "first" | "last") => {
    const menuItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']:not([aria-disabled='true'])") || []
    );
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
    }
  };

  const footerContent = typeof footer === "function" ? footer(() => setOpen(false)) : footer;

  const menuContent = isOpen ? (
    <div
      ref={menuRef}
      className={resolvedMenuClassName}
      style={portal ? portalMenuStyle : undefined}
      role="menu"
      aria-label={label || buttonAriaLabel}
      onKeyDown={handleMenuKeyDown}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {(label || description) && (
        <div className="px-3 pt-2.5 pb-2 border-b border-border-light/70">
          {label && <p className="font-display text-sm font-semibold text-ink leading-tight">{label}</p>}
          {description && <p className="mt-0.5 font-body text-xs text-muted leading-snug">{description}</p>}
        </div>
      )}

      {visibleItems.map((item, index) => {
        const tone = item.tone || "default";
        const previousSectionLabel = visibleItems[index - 1]?.sectionLabel;
        const showSectionLabel = item.sectionLabel && item.sectionLabel !== previousSectionLabel;

        const itemClassName = `w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left font-ui text-sm transition-colors outline-none disabled:opacity-45 disabled:cursor-not-allowed ${ITEM_STYLES[tone]}`;
        const content = (
          <>
            {item.icon ? (
              <span className="flex items-center justify-center w-5 h-5 shrink-0 opacity-85">
                {item.icon}
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.label}</span>
              {item.description && (
                <span className="block truncate font-body text-xs text-muted leading-snug mt-0.5">
                  {item.description}
                </span>
              )}
            </span>
            {item.meta ? <span className="shrink-0 text-xs text-muted">{item.meta}</span> : null}
          </>
        );

        return (
          <div key={`${item.label}-${index}`}>
            {item.dividerBefore && <div className="h-px bg-border-light mx-2 my-1" />}
            {showSectionLabel && (
              <p className="px-3 pb-1 pt-2 font-ui text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
                {item.sectionLabel}
              </p>
            )}
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
          <div className="h-px bg-border-light mx-2 my-1.5" />
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
        className={
          buttonClassName
          || "w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 transition-all"
        }
      >
        {trigger || <EllipsisIcon className={buttonIconClassName} />}
      </button>

      {portal ? (menuContent && menuPosition ? createPortal(menuContent, document.body) : null) : menuContent}
    </div>
  );
}
