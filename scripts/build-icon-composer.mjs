import * as fs from 'node:fs';
import * as path from 'node:path';

const iconDir = path.resolve('AppIcon.icon');
const assetsDir = path.join(iconDir, 'Assets');

if (!fs.existsSync(iconDir)) {
  console.log('No AppIcon.icon directory found.');
  process.exit(0);
}

const iconJson = JSON.parse(fs.readFileSync(path.join(iconDir, 'icon.json'), 'utf8'));

// Convert srgb floats to hex/rgb
function parseSrgb(str) {
  // format: srgb:r,g,b,a
  const parts = str.replace('srgb:', '').split(',').map(Number);
  const r = Math.round(parts[0] * 255);
  const g = Math.round(parts[1] * 255);
  const b = Math.round(parts[2] * 255);
  return `rgb(${r},${g},${b})`;
}

const gradStart = parseSrgb(iconJson['fill-specializations'][0].value['linear-gradient'][0]);
const gradStop = parseSrgb(iconJson['fill-specializations'][0].value['linear-gradient'][1]);

const svg1 = fs.readFileSync(path.join(assetsDir, 'gemini-svg (1).svg'), 'utf8');
const svg2 = fs.readFileSync(path.join(assetsDir, 'gemini-svg (2).svg'), 'utf8');
const svg3 = fs.readFileSync(path.join(assetsDir, 'gemini-svg (3).svg'), 'utf8');
const svg4 = fs.readFileSync(path.join(assetsDir, 'gemini-svg (4).svg'), 'utf8');
const svgK = fs.readFileSync(path.join(assetsDir, 'gemini-svg.svg'), 'utf8');

function extractInnerSvg(svgContent) {
  return svgContent
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '');
}

const masterSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg-grad" x1="50%" y1="0%" x2="50%" y2="70%">
      <stop offset="0%" stop-color="${gradStart}"/>
      <stop offset="100%" stop-color="${gradStop}"/>
    </linearGradient>
    <filter id="tile-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity="0.4"/>
    </filter>
    <filter id="layer-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.35"/>
    </filter>
    <clipPath id="squircle-clip">
      <rect x="100" y="100" width="824" height="824" rx="185"/>
    </clipPath>
  </defs>

  <!-- Background squircle -->
  <g filter="url(#tile-shadow)">
    <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg-grad)"/>
  </g>

  <g clip-path="url(#squircle-clip)">
    <!-- Inner subtle border highlight -->
    <rect x="100" y="100" width="824" height="824" rx="185" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="4"/>

    <!-- Lock Shackle layer -->
    <g filter="url(#layer-shadow)" transform="translate(-0.64, -50.06)">
      ${extractInnerSvg(svg3)}
    </g>

    <!-- Shield Left & Right -->
    <g filter="url(#layer-shadow)" transform="translate(0, -15.88) scale(1.06)" transform-origin="512 512">
      ${extractInnerSvg(svg2)}
      ${extractInnerSvg(svg1)}
    </g>

    <!-- Shield Border -->
    <g transform="translate(0, -17.84) scale(1.08)" transform-origin="512 512">
      ${extractInnerSvg(svg4)}
    </g>

    <!-- Glowing K -->
    <g filter="url(#layer-shadow)">
      ${extractInnerSvg(svgK)}
    </g>
  </g>
</svg>
`;

fs.writeFileSync(path.resolve('packages/macos-app/Sources/KloakApp/Resources/KloakIcon.svg'), masterSvg.trim());
console.log('✅ Generated master SVG from AppIcon.icon layers');
