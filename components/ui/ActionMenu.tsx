"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EllipsisIcon } from "@/components/ui/Icons";

export interface ActionMenuItem {
  label: string;
  onSelect: () => void | Promise<void>;
  icon?: ReactNode;
  tone?: "default" | "danger" | "success" | "accent" | "warning";
  disabled?: boolean;
  hidden?: boolean;
  dividerBefore?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  buttonClassName?: string;
  buttonIconClassName?: string;
  menuClassName?: string;
  widthClassName?: string;
  buttonAriaLabel?: string;
  buttonDisabled?: boolean;
  portal?: boolean;
  portalOffset?: number;
}

const ITEM_STYLES: Record<NonNullable<ActionMenuItem["tone"]>, string> = {
  default: "text-ink hover:bg-skeleton/60",
  danger: "text-red-500 hover:bg-red-50",
  success: "text-emerald-600 hover:bg-emerald-50",
  accent: "text-purple-primary hover:bg-purple-50/70",
  warning: "text-orange-600 hover:bg-orange-50",
};

export default function ActionMenu({
  items,
  buttonClassName,
  buttonIconClassName,
  menuClassName,
  widthClassName = "w-44",
  buttonAriaLabel = "More actions",
  buttonDisabled = false,
  portal = false,
  portalOffset = 8,
}: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visibleItems = useMemo(
    () => items.filter((item) => !item.hidden),
    [items]
  );

  const positionMenu = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + window.scrollY + portalOffset,
      left: rect.right + window.scrollX,
    });
  }, [portalOffset]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedButton && !clickedMenu) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

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

  if (visibleItems.length === 0) return null;

  const defaultMenuClassName = `${
    portal ? "" : "absolute right-0 top-full mt-2 "
  }${widthClassName} bg-surface rounded-xl shadow-lg border border-border-light overflow-hidden z-50 animate-fadeIn`;
  const resolvedMenuClassName = menuClassName || defaultMenuClassName;
  const portalMenuStyle: CSSProperties | undefined =
    portal && menuPosition
      ? {
          position: "absolute",
          top: menuPosition.top,
          left: menuPosition.left,
          transform: "translateX(-100%)",
          zIndex: 9999,
        }
      : undefined;

  const menuContent = isOpen ? (
    <div
      ref={menuRef}
      className={resolvedMenuClassName}
      style={portal ? portalMenuStyle : undefined}
      role="menu"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {visibleItems.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          {item.dividerBefore && <div className="h-px bg-skeleton mx-3" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (item.disabled) return;
              setIsOpen(false);
              void item.onSelect();
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left font-ui text-sm transition-colors disabled:opacity-50 ${
              ITEM_STYLES[item.tone || "default"]
            }`}
          >
            {item.icon ? (
              <span className="flex items-center justify-center w-4 h-4 shrink-0">
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
          </button>
        </div>
      ))}
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
          setIsOpen((open) => {
            const nextOpen = !open;
            if (!nextOpen) {
              setMenuPosition(null);
            }
            return nextOpen;
          });
        }}
        className={
          buttonClassName
          || "w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton/60 transition-all"
        }
      >
        <EllipsisIcon className={buttonIconClassName} />
      </button>

      {portal ? (menuContent && menuPosition ? createPortal(menuContent, document.body) : null) : menuContent}
    </div>
  );
}
