// Generates Veil PWA icons as PNGs with no external deps (zlib only).
// Purple background (#a855f7) with a white "V" mark.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [0x12, 0x06, 0x1f]; // near-black backdrop
const ACCENT = [0xa8, 0x55, 0xf7]; // purple
const WHITE = [0xff, 0xff, 0xff];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size, pixels) {
  // pixels: (x,y) => [r,g,b]
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
      raw[p++] = 255;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function makeIcon(size) {
  const cx = size / 2;
  const r = size * 0.42; // accent disc radius
  // "V" geometry within the disc
  return png(size, (x, y) => {
    const dx = x - cx;
    const dy = y - cx;
    const inDisc = dx * dx + dy * dy <= r * r;
    if (!inDisc) return BG;
    // Normalize to [-1,1] within disc box
    const nx = dx / r;
    const ny = dy / r;
    // V strokes: two lines from top corners meeting at bottom center
    const t = (ny + 0.55) / 1.1; // 0 at top .. 1 at bottom
    if (t >= 0 && t <= 1) {
      const halfW = 0.55 * (1 - t); // narrows toward the point
      const leftCenter = -0.45 + t * 0.45;
      const rightCenter = 0.45 - t * 0.45;
      const sw = 0.16; // stroke width
      if (
        Math.abs(nx - leftCenter) < sw ||
        Math.abs(nx - rightCenter) < sw
      ) {
        if (Math.abs(nx) < 0.6 + halfW) return WHITE;
      }
    }
    return ACCENT;
  });
}

mkdirSync("public", { recursive: true });
writeFileSync("public/icon-192.png", makeIcon(192));
writeFileSync("public/icon-512.png", makeIcon(512));
writeFileSync("public/apple-touch-icon.png", makeIcon(180));
console.log("icons written: 192, 512, apple-touch (180)");
