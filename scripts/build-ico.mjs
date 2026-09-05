import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Builds a multi-resolution ICO file from an array of PNG buffers and their sizes.
 * ICO format:
 * - ICONDIR (6 bytes): idReserved(2)=0, idType(2)=1 (ICO), idCount(2)=N
 * - Array of ICONDIRENTRY (16 bytes each):
 *   - bWidth (1 byte, 0 = 256)
 *   - bHeight (1 byte, 0 = 256)
 *   - bColorCount (1 byte, 0)
 *   - bReserved (1 byte, 0)
 *   - wPlanes (2 bytes, 1)
 *   - wBitCount (2 bytes, 32)
 *   - dwBytesInRes (4 bytes, PNG length)
 *   - dwImageOffset (4 bytes, offset in file)
 * - Raw PNG byte payloads
 */
export function createIco(images) {
  const count = images.length;
  const headerLen = 6 + count * 16;
  
  let currentOffset = headerLen;
  const entries = [];
  const imageBuffers = [];

  for (const img of images) {
    const { width, height, data } = img;
    const entry = Buffer.alloc(16);
    
    entry.writeUInt8(width >= 256 ? 0 : width, 0);
    entry.writeUInt8(height >= 256 ? 0 : height, 1);
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8); // image size in bytes
    entry.writeUInt32LE(currentOffset, 12); // file offset

    entries.push(entry);
    imageBuffers.push(data);
    currentOffset += data.length;
  }

  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0); // reserved
  iconDir.writeUInt16LE(1, 2); // type 1 = ICO
  iconDir.writeUInt16LE(count, 4); // count

  return Buffer.concat([iconDir, ...entries, ...imageBuffers]);
}

// Generate ICO from AppIcon.iconset
const iconsetDir = path.resolve('AppIcon.iconset');
if (fs.existsSync(iconsetDir)) {
  const sizesToInclude = [
    { file: 'icon_16x16.png', size: 16 },
    { file: 'icon_32x32.png', size: 32 },
    { file: 'icon_32x32@2x.png', size: 64 },
    { file: 'icon_128x128.png', size: 128 },
    { file: 'icon_256x256.png', size: 256 },
  ];

  const images = sizesToInclude.map(item => {
    const filePath = path.join(iconsetDir, item.file);
    const data = fs.readFileSync(filePath);
    return { width: item.size, height: item.size, data };
  });

  const icoBuffer = createIco(images);
  fs.writeFileSync(path.resolve('AppIcon.ico'), icoBuffer);
  
  const extIconsDir = path.resolve('packages/browser-extension/icons');
  fs.mkdirSync(extIconsDir, { recursive: true });
  fs.writeFileSync(path.join(extIconsDir, 'favicon.ico'), icoBuffer);

  console.log(`✅ Successfully generated AppIcon.ico and favicon.ico (${icoBuffer.length} bytes, ${images.length} resolutions)`);
}
