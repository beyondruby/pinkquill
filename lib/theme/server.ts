import { SYSTEM_LIGHT, SYSTEM_DARK, THEMES } from './registry';
import { THEME_COOKIE } from './cookie';

/**
 * Inline script body that runs synchronously in <head> before first paint.
 *
 * It reads the theme cookie itself and stamps <html data-theme>. Doing this
 * on the client (instead of reading the cookie in the root layout) is what
 * lets every route that has no server data be statically prerendered — the
 * root layout used to await cookies(), which made every page in the app
 * dynamic (docs/audit/01-findings.md H12).
 *
 * The SSR markup carries the light fallback; this re-stamps before anything
 * renders, so there is no flash for explicit themes. ThemeProvider takes
 * over after hydration.
 */
export function getInlineThemeResolveScript(): string {
  const dark = JSON.stringify(SYSTEM_DARK);
  const light = JSON.stringify(SYSTEM_LIGHT);
  const cookie = JSON.stringify(THEME_COOKIE);
  const known = JSON.stringify(Object.keys(THEMES));
  return (
    `(function(){try{` +
    `var m=document.cookie.match(new RegExp('(?:^|; )'+${cookie}+'=([^;]*)'));` +
    `var v=m?decodeURIComponent(m[1]):'system';` +
    `var known=${known};` +
    `var e=document.documentElement;` +
    `if(known.indexOf(v)!==-1){e.dataset.theme=v;e.dataset.themeMode='explicit';}` +
    `else{var d=window.matchMedia('(prefers-color-scheme: dark)').matches;e.dataset.theme=d?${dark}:${light};e.dataset.themeMode='system';}` +
    `}catch(_){}})();`
  );
}
