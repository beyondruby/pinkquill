"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import {
  THEMES,
  type ConcreteThemeId,
  type ThemeId,
} from "@/lib/theme/registry";
import { ThemeCard } from "./ThemeCard";

export function ThemePicker() {
  const { themeId, resolvedId, setTheme } = useTheme();
  const themeList = Object.values(THEMES);

  const isSystemActive = themeId === "system";
  const resolvedLabel = THEMES[resolvedId]?.label ?? resolvedId;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <ThemeCard
        variant="system"
        label="Match system"
        description="Auto-switch between light and dark to follow your operating system."
        isActive={isSystemActive}
        resolvesTo={isSystemActive ? `→ ${resolvedLabel}` : undefined}
        onSelect={() => setTheme("system")}
      />
      {themeList.map((theme) => (
        <ThemeCard
          key={theme.id}
          variant="concrete"
          themeId={theme.id as ConcreteThemeId}
          label={theme.label}
          description={theme.description}
          isActive={themeId === theme.id}
          onSelect={() => setTheme(theme.id as ThemeId)}
        />
      ))}
    </div>
  );
}
