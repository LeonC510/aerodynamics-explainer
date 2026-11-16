/** Colours for canvas drawing, read from the CSS custom properties in style.css. */
export interface Theme {
  bg: string; surface: string; ink: string; muted: string; line: string; grid: string;
  path: string; forecast: string; accent: string; warn: string; ground: string;
  trace: string; reference: string; marker: string;
}

let cached: Theme | null = null;

export function theme(): Theme {
  if (cached) return cached;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string): string => css.getPropertyValue(name).trim();
  cached = {
    bg: v('--bg'), surface: v('--surface'), ink: v('--ink'), muted: v('--muted'), line: v('--line'),
    grid: v('--grid'), path: v('--path'), forecast: v('--forecast'), accent: v('--accent'),
    warn: v('--warn'), ground: v('--ground'), trace: v('--trace'), reference: v('--reference'),
    marker: v('--marker'),
  };
  return cached;
}

// Re-read the colours when the system switches between light and dark.
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  cached = null;
});

export const FONT = '11px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_BOLD = '600 12px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
