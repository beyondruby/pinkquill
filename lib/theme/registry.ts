// Theme registry — single source of truth for which themes exist and how
// 'system' resolves. Add a new theme by: (1) writing CSS overrides under
// [data-theme="<id>"] in app/globals.css, (2) adding an entry below.

export interface ThemeMeta {
  id: string;
  label: string;
  description: string;
  appearance: 'light' | 'dark';
}

export const THEMES = {
  default: {
    id: 'default',
    label: 'Default',
    description: 'Pink & purple, light mode',
    appearance: 'light',
  },
  noir: {
    id: 'noir',
    label: 'Noir',
    description: 'Deep dark, cyan & fuchsia accents',
    appearance: 'dark',
  },
} as const satisfies Record<string, ThemeMeta>;

export type ConcreteThemeId = keyof typeof THEMES;
export type ThemeId = ConcreteThemeId | 'system';

// What's stamped on <html> server-side when no preference is known.
export const DEFAULT_THEME: ConcreteThemeId = 'default';

// What 'system' resolves to. Updates as the theme library grows.
export const SYSTEM_LIGHT: ConcreteThemeId = 'default';
export const SYSTEM_DARK: ConcreteThemeId = 'noir';

export function isThemeId(value: unknown): value is ThemeId {
  if (value === 'system') return true;
  if (typeof value !== 'string') return false;
  return value in THEMES;
}

export function isConcreteThemeId(value: unknown): value is ConcreteThemeId {
  return typeof value === 'string' && value in THEMES;
}

export function resolveTheme(id: ThemeId, prefersDark: boolean): ConcreteThemeId {
  if (id !== 'system') return id;
  return prefersDark ? SYSTEM_DARK : SYSTEM_LIGHT;
}

export function getThemeList(): ThemeMeta[] {
  return Object.values(THEMES);
}
