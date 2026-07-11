/**
 * The storage optimiser. Screenshots arrive at 1–4MB; we resize to a
 * 1600px long edge and re-encode (WebP, JPEG fallback) at ~0.75 quality,
 * landing around 150–300KB — a 10x saving, invisible to Jillian.
 * Lists only ever load 300px thumbnails, so every screen stays instant.
 */

const FULL_EDGE = 1600;
const THUMB_EDGE = 300;

async function decode(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(source);
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function scaleTo(source: ImageBitmap | HTMLImageElement, maxEdge: number, quality: number): Promise<Blob> {
  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(source, 0, 0, cw, ch);
  const webp = await toBlob(canvas, 'image/webp', quality);
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', Math.min(quality + 0.05, 0.85));
  if (jpeg) return jpeg;
  throw new Error('Could not encode image');
}

export async function compressPhoto(file: Blob): Promise<{ blob: Blob; thumb: Blob }> {
  const src = await decode(file);
  try {
    const blob = await scaleTo(src, FULL_EDGE, 0.75);
    const thumb = await scaleTo(src, THUMB_EDGE, 0.6);
    return { blob, thumb };
  } finally {
    if ('close' in src) src.close();
  }
}

/** Rebuild just a thumbnail (used when restoring a backup). */
export async function makeThumb(blob: Blob): Promise<Blob> {
  const src = await decode(blob);
  try {
    return await scaleTo(src, THUMB_EDGE, 0.6);
  } finally {
    if ('close' in src) src.close();
  }
}

/** Quiet quota check — returns true when storage is getting tight (>80%). */
export async function storageTight(): Promise<boolean> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.quota || !est.usage) return false;
    return est.usage / est.quota > 0.8;
  } catch {
    return false;
  }
}
