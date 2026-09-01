"use client";

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { Spinner } from "./Loading";

/**
 * Shared Button primitive — Sep 2026 polish pass, Wave B.
 *
 * Built to close the audit's single biggest "states" gap: 69% of the app's
 * 724 raw <button> elements had no hover/focus/active class, and `active:`
 * (pressed) feedback was used only 18 times codebase-wide. Every variant
 * here bakes in hover, focus-visible, active, disabled, and loading once —
 * consumers only choose which of the app's existing visual treatments they
 * want, they don't re-derive the states.
 *
 * Variants map to conventions already in use (no new colors/shapes):
 *   primary          — tri-gradient pill fill (the CTA style used ~80x already)
 *   secondary        — bg-subtle pill (e.g. ConfirmationModal's Cancel)
 *   outline          — bordered, transparent (e.g. ReportModal's Back)
 *   outline-gradient — white fill + gradient border-box (composer/wizard "Next")
 *   ghost            — text-only, subtle hover bg (nav-style)
 *   danger           — solid red fill (destructive confirm)
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "outline-gradient"
  | "ghost"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: ReactNode;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm gap-1.5",
  md: "px-5 py-2.5 text-sm gap-2",
  lg: "px-6 py-3.5 text-[0.95rem] gap-2",
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-purple-primary to-pink-vivid text-on-accent shadow-sm hover:shadow-lg hover:shadow-pink-vivid/25 hover:scale-[1.02]",
  secondary: "bg-subtle text-ink hover:bg-skeleton/80",
  outline:
    "bg-transparent text-muted border border-border-light hover:border-border-strong hover:text-ink",
  "outline-gradient": "text-orange-warm border-2 border-transparent hover:opacity-90",
  ghost: "bg-transparent text-muted hover:text-accent hover:bg-purple-50",
  danger:
    "bg-red-500 text-white shadow-sm hover:bg-red-600 hover:shadow-md hover:shadow-red-500/20",
};

const OUTLINE_GRADIENT_BG =
  "linear-gradient(white, white) padding-box, linear-gradient(to right, #ff9f43, #ff007f) border-box";

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingText,
    fullWidth = false,
    disabled,
    className = "",
    children,
    style,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  const mergedStyle: CSSProperties | undefined =
    variant === "outline-gradient" ? { background: OUTLINE_GRADIENT_BG, ...style } : style;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={mergedStyle}
      className={[
        "inline-flex items-center justify-center rounded-full font-ui font-semibold",
        "transition-all duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "active:scale-[0.97]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none disabled:active:scale-100",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner size={size === "lg" ? "sm" : "xs"} />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
});

export default Button;
