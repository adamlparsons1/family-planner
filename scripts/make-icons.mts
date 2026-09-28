/**
 * Generates the PWA icons with no image dependencies: raw RGBA pixels encoded
 * as PNG via zlib. A house in ink on warm ground, with three windows in the
 * children's colours.
 *
 * Run with: npx tsx scripts/make-icons.mts
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const GROUND: RGB = [0xfa, 0xf6, 0xf0];
const INK: RGB = [0x2b, 0x26, 0x20];
const CHILD: RGB[] = [
  [0x00, 0x72, 0xb2],
  [0xcc, 0x79, 0xa7],
  [0xe6, 0x9f, 0x00],
];

type RGB = [number, number, number];

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgb: (x: number, y: number) => RGB): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgb(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Draws the icon in a 0..1 unit square so it scales to any size. */
function paint(u: number, v: number, maskable: boolean): RGB {
  // Maskable icons need their content inside the safe zone (central 80%).
  const inset = maskable ? 0.1 : 0.0;
  const s = (n: number) => inset + n * (1 - inset * 2);

  const roofPeak = s(0.16);
  const roofBase = s(0.44);
  const bodyBottom = s(0.86);
  const bodyLeft = s(0.24);
  const bodyRight = s(0.76);

  // Roof: a triangle spanning the full width at roofBase, meeting at the peak.
  if (v >= roofPeak && v <= roofBase) {
    const t = (v - roofPeak) / (roofBase - roofPeak);
    const halfWidth = t * (s(0.86) - s(0.5));
    if (Math.abs(u - s(0.5)) <= halfWidth) return INK;
  }

  // Body
  if (v > roofBase && v <= bodyBottom && u >= bodyLeft && u <= bodyRight) {
    // Three windows, one per child, in a row.
    const wy = s(0.58);
    const wh = s(0.16) - s(0.0);
    if (v >= wy && v <= wy + wh * 1.2) {
      for (let i = 0; i < 3; i++) {
        const cx = bodyLeft + ((i + 1) * (bodyRight - bodyLeft)) / 4;
        const halfW = (bodyRight - bodyLeft) * 0.1;
        if (Math.abs(u - cx) <= halfW) return CHILD[i];
      }
    }
    return INK;
  }

  return GROUND;
}

function render(size: number, maskable: boolean): Buffer {
  // 3x supersampling so the diagonal roof edge is not jagged.
  const SS = 3;
  return encodePng(size, size, (x, y) => {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const [pr, pg, pb] = paint((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, maskable);
        r += pr; g += pg; b += pb;
      }
    }
    const n = SS * SS;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

for (const [file, size, maskable] of [
  ['public/icon-192.png', 192, false],
  ['public/icon-512.png', 512, false],
  ['public/icon-512-maskable.png', 512, true],
] as const) {
  writeFileSync(file, render(size, maskable));
  console.log(`wrote ${file} (${size}px${maskable ? ', maskable' : ''})`);
}
