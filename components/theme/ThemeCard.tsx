"use client";

import { ThemePreview, SystemThemePreview } from "./ThemePreview";
import { type ConcreteThemeId } from "@/lib/theme/registry";

interface BaseProps {
  label: string;
  description: string;
  isActive: boolean;
  onSelect: () => void;
}

interface SystemCardProps extends BaseProps {
  variant: "system";
  resolvesTo?: string;
}

interface ConcreteCardProps extends BaseProps {
  variant: "concrete";
  themeId: ConcreteThemeId;
}

type ThemeCardProps = SystemCardProps | ConcreteCardProps;

export function ThemeCard(props: ThemeCardProps) {
  const { label, description, isActive, onSelect } = props;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isActive}
      className={`group text-left rounded-2xl border-2 transition-all p-3 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
        isActive
          ? "border-accent ring-4 ring-accent/15 bg-accent/5"
          : "border-border-light hover:border-border-strong bg-surface"
      }`}
    >
      <div className="mb-3">
        {props.variant === "system" ? (
          <SystemThemePreview />
        ) : (
          <ThemePreview themeId={props.themeId} />
        )}
      </div>
      <div className="px-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-ui text-base font-semibold text-ink">{label}</h3>
          {isActive ? (
            <span className="font-ui text-xs font-bold text-accent px-1.5 py-0.5 rounded-md bg-accent/10">
              Active
            </span>
          ) : null}
        </div>
        <p className="font-body text-[0.85rem] text-muted leading-snug">
          {description}
        </p>
        {props.variant === "system" && props.resolvesTo ? (
          <p className="font-body text-[0.75rem] text-muted mt-2">
            Currently <span className="text-subdued font-medium">{props.resolvesTo}</span>
          </p>
        ) : null}
      </div>
    </button>
  );
}
