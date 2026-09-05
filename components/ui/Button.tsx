"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner } from "./Loading";

/** Pinkquill 2.0 shared control. Existing variants and native button semantics
 * remain compatible; visual roles are owned by button.css/design-tokens.css. */

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

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={style}
      className={[
        "pq-button",
        `pq-button--${size}`,
        `pq-button--${variant}`,
        fullWidth ? "pq-button--full" : "",
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
