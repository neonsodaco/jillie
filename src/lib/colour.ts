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
