import { cookies } from 'next/headers';
import {
  isThemeId,
  SYSTEM_LIGHT,
  SYSTEM_DARK,
  type ConcreteThemeId,
  type ThemeId,
} from './registry';
import { THEME_COOKIE } from './cookie';

// Read the theme cookie at request time and decide what to stamp on
// <html data-theme="..."> for the initial paint.
//
// If the user has stored a concrete theme, we stamp it directly — no
// client-side resolution, no FOUC. If they have 'system' (or no cookie),
// we stamp the light fallback and signal the layout to inject a tiny
// inline script that re-stamps to the OS-preferred variant before paint.
export async function getServerTheme(): Promise<{
  storedId: ThemeId;
  resolvedId: ConcreteThemeId;
  needsClientResolve: boolean;
}> {
  const store = await cookies();
  const raw = store.get(THEME_COOKIE)?.value;
  const storedId: ThemeId = isThemeId(raw) ? raw : 'system';
  const resolvedId: ConcreteThemeId =
    storedId === 'system' ? SYSTEM_LIGHT : storedId;
  return { storedId, resolvedId, needsClientResolve: storedId === 'system' };
}

// Inline script body that runs synchronously in <head> before paint.
// Only emitted when the stored preference is 'system' — for explicit
// themes the SSR data-theme attribute is already correct.
export function getInlineThemeResolveScript(): string {
  const dark = JSON.stringify(SYSTEM_DARK);
  const light = JSON.stringify(SYSTEM_LIGHT);
  return `(function(){try{var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=d?${dark}:${light};var e=document.documentElement;e.dataset.theme=t;e.dataset.themeMode='system';}catch(_){}})();`;
}
