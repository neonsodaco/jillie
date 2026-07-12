// Generates the app icons as PNGs with no image dependencies:
// a bright purple rounded square with a white tick — easy to spot
// among the other apps on the home screen.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// ---- minimal PNG encoder (RGBA, 8-bit) ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---- drawing helpers ----
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smooth = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
function sdRoundedRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const t = clamp((apx * abx + apy * aby) / (abx * abx + aby * aby), 0, 1);
  return Math.hypot(apx - abx * t, apy - aby * t);
}

function drawIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  // bright purple gradient, top to bottom
  const top = [0xa8, 0x55, 0xf7], bottom = [0x7c, 0x3a, 0xed];
  const cx = size / 2, cy = size / 2;
  const half = size / 2;
  const radius = maskable ? 0 : size * 0.225;
  // tick geometry; maskable icons keep content inside the 80% safe zone
  const s = maskable ? size * 0.62 : size * 0.82;
  const ox = cx - s / 2, oy = cy - s / 2;
  const p1 = [ox + 0.26 * s, oy + 0.55 * s];
  const p2 = [ox + 0.44 * s, oy + 0.72 * s];
  const p3 = [ox + 0.76 * s, oy + 0.33 * s];
  const strokeW = s * 0.115;

  for (let y = 0; y < size; y++) {
    const g = y / size;
    const bg = [
      Math.round(top[0] + (bottom[0] - top[0]) * g),
      Math.round(top[1] + (bottom[1] - top[1]) * g),
      Math.round(top[2] + (bottom[2] - top[2]) * g)
    ];
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let shapeA = 1;
      if (!maskable) {
        const d = sdRoundedRect(x + 0.5, y + 0.5, cx, cy, half, half, radius);
        shapeA = smooth(0.75, -0.75, d);
      }
      if (shapeA <= 0) continue;
      let r = bg[0], gc = bg[1], b = bg[2];
      const dTick = Math.min(
        sdSegment(x + 0.5, y + 0.5, p1[0], p1[1], p2[0], p2[1]),
        sdSegment(x + 0.5, y + 0.5, p2[0], p2[1], p3[0], p3[1])
      );
      const tickA = smooth(strokeW / 2 + 1, strokeW / 2 - 1, dTick);
      if (tickA > 0) {
        r = Math.round(r + (0xff - r) * tickA * 0.97);
        gc = Math.round(gc + (0xfd - gc) * tickA * 0.97);
        b = Math.round(b + (0xf9 - b) * tickA * 0.97);
      }
      rgba[i] = r;
      rgba[i + 1] = gc;
      rgba[i + 2] = b;
      rgba[i + 3] = Math.round(255 * shapeA);
    }
  }
  return encodePNG(size, size, rgba);
}

writeFileSync(join(outDir, 'icon-192-v2.png'), drawIcon(192, { maskable: false }));
writeFileSync(join(outDir, 'icon-512-v2.png'), drawIcon(512, { maskable: false }));
writeFileSync(join(outDir, 'maskable-512-v2.png'), drawIcon(512, { maskable: true }));
console.log('Icons written to', outDir);
