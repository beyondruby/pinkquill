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
  onOpenChange?: (open: boolean) => void;
}

const ITEM_STYLES: Record<NonNullable<ActionMenuItem["tone"]>, string> = {
  default: "text-ink hover:bg-ink/[0.04] focus-visible:bg-ink/[0.04]",
  danger: "text-red-600 hover:bg-red-50 focus-visible:bg-red-50",
  success: "text-emerald-700 hover:bg-emerald-50 focus-visible:bg-emerald-50",
  accent: "text-purple-primary hover:bg-purple-50/80 focus-visible:bg-purple-50/80",
  warning: "text-orange-600 hover:bg-orange-50 focus-visible:bg-orange-50",
};

const ICON_STYLES: Record<NonNullable<ActionMenuItem["tone"]>, string> = {
  default: "bg-skeleton/70 text-muted",
  danger: "bg-red-50 text-red-500",
  success: "bg-emerald-50 text-emerald-600",
  accent: "bg-purple-50 text-purple-primary",
  warning: "bg-orange-50 text-orange-600",
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
  onOpenChange,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);
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
    setMenuPosition({
      top: Math.min(rect.bottom + portalOffset, window.innerHeight - viewportPadding),
      ...(align === "end"
        ? { right: Math.max(viewportPadding, window.innerWidth - rect.right) }
        : { left: Math.max(viewportPadding, rect.left) }),
    });
  }, [align, portalOffset]);

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

    positionMenu();

    const reposition = () => positionMenu();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
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

  const defaultMenuClassName = `${
    portal ? "" : `absolute ${align === "end" ? "right-0" : "left-0"} top-full mt-2 `
  }${widthClassName} max-w-[calc(100vw-1.5rem)] max-h-[min(72vh,34rem)] overflow-y-auto bg-surface/98 backdrop-blur-xl rounded-lg shadow-[0_18px_45px_rgba(30,30,30,0.14)] border border-border-light z-50 animate-scaleIn origin-top-right p-1.5`;
  const resolvedMenuClassName = menuClassName || defaultMenuClassName;
  const portalMenuStyle: CSSProperties | undefined =
    portal && menuPosition
      ? {
          position: "fixed",
          top: menuPosition.top,
          left: menuPosition.left,
          right: menuPosition.right,
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
        <div className="px-3 pt-2.5 pb-2">
          {label && <p className="font-display text-sm font-semibold text-ink leading-tight">{label}</p>}
          {description && <p className="mt-0.5 font-body text-xs text-muted leading-snug">{description}</p>}
        </div>
      )}

      <div className="h-0.5 rounded-full bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm opacity-80 mb-1" />

      {visibleItems.map((item, index) => {
        const tone = item.tone || "default";
        const previousSectionLabel = visibleItems[index - 1]?.sectionLabel;
        const showSectionLabel = item.sectionLabel && item.sectionLabel !== previousSectionLabel;

        const itemClassName = `w-full flex items-center gap-3 rounded-md px-2.5 py-2.5 text-left font-ui text-sm transition-colors outline-none disabled:opacity-45 disabled:cursor-not-allowed ${ITEM_STYLES[tone]}`;
        const content = (
          <>
            {item.icon ? (
              <span className={`flex items-center justify-center w-7 h-7 rounded-md shrink-0 ${ICON_STYLES[tone]}`}>
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
            {item.dividerBefore && <div className="h-px bg-border-light mx-2 my-1.5" />}
            {showSectionLabel && (
              <p className="px-2.5 pb-1 pt-2 font-ui text-[0.68rem] font-semibold uppercase tracking-wider text-muted">
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
