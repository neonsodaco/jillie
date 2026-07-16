import type { CSSProperties } from 'react';

/**
 * Custom project colours. Jillian can pick any colour she likes; we keep
 * the hue and character of her pick but pull it into the app's pastel
 * range, so dark ink text on cards stays readable and the app keeps its
 * look. The three CSS variables mirror the palette classes in styles.css:
 * --c the bloom, --c-tint the pale wash, --c-deep the readable dark shade.
 */

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/* The mixer slider works in pastels directly: every stop already sits in
   the bloom band (85% saturation, 74% lightness), so what Jillian sees on
   the slider is exactly what her project wears — no conversion surprise. */
export const MIX_S = 85;
export const MIX_L = 74;

/** The stored hex for a mixer hue (0-359). */
export function pastelHex(hue: number): string {
  const h = ((Math.round(hue) % 360) + 360) % 360;
  const l = MIX_L / 100;
  const a = (MIX_S / 100) * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** The hue of a stored custom colour, for setting the slider back where she left it. */
export function hueOf(hex: string): number | null {
  const hsl = hexToHsl(hex);
  return hsl ? Math.round(hsl.h) : null;
}

/** The three colour variables for a custom pick, or undefined if the hex is bad. */
export function customColourVars(hex: string): CSSProperties | undefined {
  const hsl = hexToHsl(hex);
  if (!hsl) return undefined;
  const h = Math.round(hsl.h);
  // a truly grey pick stays grey; anything with colour gets pastel strength
  const s = hsl.s < 0.2 ? Math.round(hsl.s * 100) : Math.round(clamp(hsl.s * 100, 45, 90));
  const bloomL = Math.round(clamp(hsl.l * 100, 68, 80));
  return {
    '--c': `hsl(${h}, ${s}%, ${bloomL}%)`,
    '--c-tint': `hsl(${h}, ${Math.min(s, 75)}%, 94%)`,
    '--c-deep': `hsl(${h}, ${Math.min(s, 80)}%, 34%)`
  } as CSSProperties;
}
