import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const EXT_DIR = path.join(REPO_ROOT, 'packages/browser-extension');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const STAGING_DIR = path.join(DIST_DIR, 'kloak-browser-extension');

console.log('==============================================');
console.log('  Packaging Kloak Browser Extension (MV3)');
console.log('==============================================\n');

// 1. Read manifest for version
const manifestPath = path.join(EXT_DIR, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '1.0.0';
console.log(`→ Packing version ${version}...`);

// 2. Run TypeScript build
console.log('→ Building extension JavaScript bundles via esbuild...');
execSync('npm run build --workspace=@kloak/browser-extension', {
  cwd: REPO_ROOT,
  stdio: 'inherit',
});

// 3. Prepare clean staging directory
fs.rmSync(STAGING_DIR, { recursive: true, force: true });
fs.mkdirSync(STAGING_DIR, { recursive: true });

// 4. Copy required production runtime files
const filesToCopy = [
  'manifest.json',
  'dist',
  'icons',
  'popup',
  'sidepanel',
  'options',
];

for (const item of filesToCopy) {
  const src = path.join(EXT_DIR, item);
  const dest = path.join(STAGING_DIR, item);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`  ✓ Copied ${item}`);
  }
}

// 5. Sanitize manifest for Chrome Web Store compliance (strip 'key' field if present)
const stagedManifestPath = path.join(STAGING_DIR, 'manifest.json');
if (fs.existsSync(stagedManifestPath)) {
  const stagedManifest = JSON.parse(fs.readFileSync(stagedManifestPath, 'utf8'));
  if (stagedManifest.key) {
    delete stagedManifest.key;
    fs.writeFileSync(stagedManifestPath, JSON.stringify(stagedManifest, null, 2));
    console.log('  ✓ Stripped development "key" field from production manifest');
  }
}

// 6. Remove any unwanted OS files (.DS_Store)
execSync(`find "${STAGING_DIR}" -name ".DS_Store" -delete 2>/dev/null || true`);

// 6. Create production ZIP archives
const zipVersionName = `kloak-browser-extension-v${version}.zip`;
const zipLatestName = `kloak-browser-extension.zip`;
const zipVersionPath = path.join(DIST_DIR, zipVersionName);
const zipLatestPath = path.join(DIST_DIR, zipLatestName);

fs.rmSync(zipVersionPath, { force: true });
fs.rmSync(zipLatestPath, { force: true });

console.log(`\n→ Compressing production zip package: ${zipVersionName}...`);
execSync(`cd "${STAGING_DIR}" && zip -r -9 "${zipVersionPath}" ./*`, {
  stdio: 'pipe',
});

// Duplicate as latest
fs.copyFileSync(zipVersionPath, zipLatestPath);

const zipStats = fs.statSync(zipVersionPath);
const sizeKb = (zipStats.size / 1024).toFixed(1);

console.log('\n==============================================');
console.log(`  ✅ Package created successfully!`);
console.log(`     ZIP: ${zipVersionPath} (${sizeKb} KB)`);
console.log(`     ZIP (latest): ${zipLatestPath}`);
console.log(`     Unpacked folder: ${STAGING_DIR}`);
console.log('==============================================\n');
