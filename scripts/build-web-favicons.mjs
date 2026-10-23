import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { createIco } from './build-ico.mjs';

const ROOT = path.resolve('.');
const MASTER_PNG = path.join(ROOT, 'packages/website/public/kloak-logo.png');

console.log('Generating official web favicons from:', MASTER_PNG);

if (!fs.existsSync(MASTER_PNG)) {
  console.error('Error: Master logo not found at', MASTER_PNG);
  process.exit(1);
}

// 1. Generate resized PNGs using macOS sips
const tmpDir = path.join(ROOT, '.tmp-favicons');
fs.mkdirSync(tmpDir, { recursive: true });

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'kloak-logo-64.png', size: 64 },
  { name: 'kloak-logo-128.png', size: 128 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'kloak-logo-256.png', size: 256 },
];

for (const { name, size } of sizes) {
  const outPath = path.join(tmpDir, name);
  execSync(`sips -z ${size} ${size} "${MASTER_PNG}" --out "${outPath}"`, { stdio: 'ignore' });
  console.log(`  ✓ Generated ${name} (${size}x${size})`);
}

// 2. Generate multi-resolution favicon.ico containing 16, 32, 48, 64, 128, 256
const icoSizes = [16, 32, 48, 64, 128, 256];
const icoImages = icoSizes.map(size => {
  const fileName = sizes.find(s => s.size === size).name;
  const data = fs.readFileSync(path.join(tmpDir, fileName));
  return { width: size, height: size, data };
});

const icoBuffer = createIco(icoImages);
const icoPath = path.join(tmpDir, 'favicon.ico');
fs.writeFileSync(icoPath, icoBuffer);
console.log(`  ✓ Generated multi-resolution favicon.ico (${icoBuffer.length} bytes, ${icoImages.length} frames)`);

// 3. Target directories to distribute the official favicons
const targetDirs = [
  path.join(ROOT, 'packages/website/public'),
  path.join(ROOT, 'packages/website/public/privacy'),
  path.join(ROOT, 'docs'),
  path.join(ROOT, 'docs/privacy'),
];

const filesToCopy = [
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'kloak-logo-64.png',
  'apple-touch-icon.png',
  'kloak-logo-256.png',
];

for (const dir of targetDirs) {
  fs.mkdirSync(dir, { recursive: true });
  for (const file of filesToCopy) {
    const src = path.join(tmpDir, file);
    const dest = path.join(dir, file);
    // If dest is a symlink, remove it first
    if (fs.existsSync(dest) || fs.lstatSync(dest, { throwIfNoEntry: false })) {
      try { fs.unlinkSync(dest); } catch {}
    }
    fs.copyFileSync(src, dest);
  }
  // Also copy SVG to subdirectories if not present
  const svgSrc = path.join(ROOT, 'packages/website/public/kloak-logo.svg');
  const svgDest = path.join(dir, 'kloak-logo.svg');
  if (svgSrc !== svgDest && fs.existsSync(svgSrc)) {
    if (fs.existsSync(svgDest) || fs.lstatSync(svgDest, { throwIfNoEntry: false })) {
      try { fs.unlinkSync(svgDest); } catch {}
    }
    fs.copyFileSync(svgSrc, svgDest);
  }
  console.log(`  ✓ Synced official favicon suite to: ${path.relative(ROOT, dir)}`);
}

// Clean up tmpDir
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('🎉 Web favicon suite successfully generated and distributed!');
