import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

/**
 * Generates a valid uncompressed PNG image buffer with an electric blue / indigo shield.
 */
function generatePng(size) {
  const width = size;
  const height = size;

  // RGBA buffer: 4 bytes per pixel + 1 filter byte per scanline
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Distance from center (0 to 1)
      const nx = (x / (width - 1)) * 2 - 1;
      const ny = (y / (height - 1)) * 2 - 1;
      const dist = Math.sqrt(nx * nx + ny * ny);

      // Shield shape or rounded badge
      if (dist <= 0.88) {
        // Gradient from vibrant cyan to electric blue
        const r = Math.floor(60 + 30 * nx);
        const g = Math.floor(130 + 50 * ny);
        const b = 255;
        const a = 255;

        // Inner icon highlight / lock dot
        const innerDist = Math.sqrt(nx * nx + (ny + 0.1) * (ny + 0.1));
        if (innerDist < 0.25) {
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = a;
        }
      } else {
        // Transparent outside
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  // PNG Signature
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // Bit depth: 8
  ihdrData.writeUInt8(6, 9); // Color type: 6 (RGBA)
  ihdrData.writeUInt8(0, 10); // Compression method: 0
  ihdrData.writeUInt8(0, 11); // Filter method: 0
  ihdrData.writeUInt8(0, 12); // Interlace method: 0
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT Chunk (zlib compressed scanlines)
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Generate icon-16, icon-48, icon-128
const iconsDir = path.resolve('/Users/naetikarvind/.gemini/antigravity/scratch/kloak/packages/browser-extension/icons');
fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, 'icon-16.png'), generatePng(16));
fs.writeFileSync(path.join(iconsDir, 'icon-48.png'), generatePng(48));
fs.writeFileSync(path.join(iconsDir, 'icon-128.png'), generatePng(128));

console.log('✅ Generated Kloak Extension PNG icons (16, 48, 128)');
