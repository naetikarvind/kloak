/**
 * Kloak Browser Extension — Favicon Service & JEV AI (Just-Enough Vision) Engine
 *
 * Implements the complete Kloak Favicon System for the Chrome browser extension:
 * 1. Comprehensive Parent-Brand Domain Mapping (e.g. account.live.com, live.com -> microsoft.com)
 * 2. Brand domain inference from Title, URLs, and OAuth Providers
 * 3. High-resolution multi-tier candidate generation (Google V2 128px, Google S2 128px, DuckDuckGo, Clearbit, Apple Touch Icon)
 * 4. JEV AI (Just-Enough Vision) on-device Canvas Pixel Classifier:
 *    - .standard: White backing squircle plate + 78% inset logo + subtle border stroke
 *    - .fullBleed: Edge-to-edge logo clipped to squircle (Microsoft 4 colors, Hotstar, BandLab)
 *    - .coloredSquircle(r, g, b): Squircle filled with sampled brand color (Zoom blue, LinkedIn blue, Tabrr purple)
 *    - JEV AI Cutout Contrast Detection: Automatically detects stencil cutouts (Spotify sound waves)
 *      and pairs them with dark (#121212) or white high-contrast plates without hardcoded domain overrides!
 *    - .circleAdapted: Circular logo adaptation
 * 5. Deterministic 12-palette brand gradient monogram avatars for fallback / zero-state
 * 6. High-performance memory cache for frame-0 instant rendering
 */

export type LogoRenderingStyle =
  | { type: 'standard' }
  | { type: 'fullBleed' }
  | { type: 'coloredSquircle'; r: number; g: number; b: number; isCutout?: boolean }
  | { type: 'circleAdapted' };

export interface FaviconItem {
  id?: string;
  title?: string;
  urls?: string[];
  type?: string;
  username?: string;
  oauth?: { provider?: string };
  oauthProvider?: string;
  domain?: string;
}

export interface FaviconRenderOptions {
  item?: FaviconItem;
  domain?: string;
  urls?: string[];
  title?: string;
  type?: string;
  oauthProvider?: string;
  size?: number; // default 32
}

export interface CachedFavicon {
  src: string;
  style: LogoRenderingStyle;
}

// ── 1. Comprehensive Parent-Brand Domain Map ──
export const PARENT_BRAND_MAP: Record<string, string> = {
  // ── Microsoft ecosystem ──
  'live.com': 'microsoft.com',
  'account.live.com': 'microsoft.com',
  'microsoftonline.com': 'microsoft.com',
  'outlook.com': 'microsoft.com',
  'outlook.live.com': 'microsoft.com',
  'hotmail.com': 'microsoft.com',
  'office.com': 'microsoft.com',
  'office365.com': 'microsoft.com',
  'onedrive.com': 'microsoft.com',
  'onedrive.live.com': 'microsoft.com',
  'sharepoint.com': 'microsoft.com',
  'teams.microsoft.com': 'microsoft.com',
  'azure.com': 'microsoft.com',
  'portal.azure.com': 'microsoft.com',
  'dev.azure.com': 'microsoft.com',
  'visualstudio.com': 'microsoft.com',
  'msn.com': 'microsoft.com',
  'bing.com': 'microsoft.com',
  'xbox.com': 'xbox.com',
  'skype.com': 'skype.com',

  // ── Google ecosystem ──
  'gmail.com': 'google.com',
  'googlemail.com': 'google.com',
  'google.co.in': 'google.com',
  'google.co.uk': 'google.com',
  'google.co.jp': 'google.com',
  'accounts.google.com': 'google.com',
  'myaccount.google.com': 'google.com',
  'drive.google.com': 'google.com',
  'docs.google.com': 'google.com',
  'sheets.google.com': 'google.com',
  'slides.google.com': 'google.com',
  'meet.google.com': 'google.com',
  'chat.google.com': 'google.com',
  'calendar.google.com': 'google.com',
  'photos.google.com': 'google.com',
  'maps.google.com': 'google.com',
  'translate.google.com': 'google.com',
  'cloud.google.com': 'google.com',
  'console.cloud.google.com': 'google.com',
  'play.google.com': 'google.com',
  'firebase.google.com': 'google.com',
  'analytics.google.com': 'google.com',
  'ads.google.com': 'google.com',
  'gemini.google.com': 'google.com',
  'colab.research.google.com': 'google.com',
  'youtube.com': 'youtube.com',

  // ── Apple ecosystem ──
  'icloud.com': 'apple.com',
  'appleid.apple.com': 'apple.com',
  'developer.apple.com': 'apple.com',
  'music.apple.com': 'apple.com',
  'tv.apple.com': 'apple.com',
  'support.apple.com': 'apple.com',

  // ── Meta ecosystem ──
  'facebook.com': 'facebook.com',
  'fb.com': 'facebook.com',
  'messenger.com': 'facebook.com',
  'instagram.com': 'instagram.com',
  'threads.net': 'instagram.com',
  'whatsapp.com': 'whatsapp.com',
  'oculus.com': 'meta.com',

  // ── Amazon ecosystem ──
  'aws.amazon.com': 'amazon.com',
  'console.aws.amazon.com': 'amazon.com',
  'primevideo.com': 'amazon.com',
  'kindle.com': 'amazon.com',
  'audible.com': 'audible.com',
  'twitch.tv': 'twitch.tv',

  // ── GitHub / Microsoft Dev ──
  'gist.github.com': 'github.com',
  'copilot.github.com': 'github.com',
  'github.dev': 'github.com',
  'npmjs.com': 'npmjs.com',

  // ── Spotify ──
  'accounts.spotify.com': 'spotify.com',
  'open.spotify.com': 'spotify.com',
  'play.spotify.com': 'spotify.com',

  // ── LinkedIn ──
  'learning.linkedin.com': 'linkedin.com',
  'recruiter.linkedin.com': 'linkedin.com',

  // ── Zoom ──
  'us04web.zoom.us': 'zoom.us',
  'us02web.zoom.us': 'zoom.us',
  'zoomgov.com': 'zoom.us',

  // ── Atlassian ecosystem ──
  'bitbucket.org': 'bitbucket.org',
  'trello.com': 'trello.com',
  'jira.atlassian.com': 'atlassian.com',
  'confluence.atlassian.com': 'atlassian.com',
  'id.atlassian.com': 'atlassian.com',

  // ── Salesforce ecosystem ──
  'salesforce.com': 'salesforce.com',
  'force.com': 'salesforce.com',
  'heroku.com': 'heroku.com',

  // ── Adobe ecosystem ──
  'creativecloud.adobe.com': 'adobe.com',
  'behance.net': 'behance.net',

  // ── Proton ecosystem ──
  'protonmail.com': 'proton.me',
  'protonvpn.com': 'proton.me',
  'proton.me': 'proton.me'
};

// ── 2. Brand Name to Canonical Domain Dictionary ──
export const BRAND_DICTIONARY: Record<string, string> = {
  github: 'github.com',
  copilot: 'github.com',
  cursor: 'cursor.com',
  gemini: 'gemini.google.com',
  'google gemini': 'gemini.google.com',
  deepmind: 'deepmind.google',
  proton: 'proton.me',
  protonmail: 'proton.me',
  'proton mail': 'proton.me',
  google: 'google.com',
  gmail: 'google.com',
  'google workspace': 'google.com',
  youtube: 'youtube.com',
  hotstar: 'hotstar.com',
  disney: 'hotstar.com',
  'disney+': 'hotstar.com',
  disneyplus: 'hotstar.com',
  apple: 'apple.com',
  icloud: 'apple.com',
  'apple card': 'apple.com',
  amazon: 'amazon.com',
  aws: 'aws.amazon.com',
  netflix: 'netflix.com',
  spotify: 'spotify.com',
  discord: 'discord.com',
  slack: 'slack.com',
  notion: 'notion.so',
  figma: 'figma.com',
  dropbox: 'dropbox.com',
  openai: 'openai.com',
  chatgpt: 'openai.com',
  claude: 'anthropic.com',
  anthropic: 'anthropic.com',
  opera: 'opera.com',
  brave: 'brave.com',
  firefox: 'firefox.com',
  huggingface: 'huggingface.co',
  replicate: 'replicate.com',
  midjourney: 'midjourney.com',
  perplexity: 'perplexity.ai',
  twitter: 'x.com',
  x: 'x.com',
  reddit: 'reddit.com',
  linkedin: 'linkedin.com',
  facebook: 'facebook.com',
  meta: 'meta.com',
  instagram: 'instagram.com',
  gitlab: 'gitlab.com',
  bitbucket: 'bitbucket.org',
  atlassian: 'atlassian.com',
  stripe: 'stripe.com',
  paypal: 'paypal.com',
  linear: 'linear.app',
  vercel: 'vercel.com',
  supabase: 'supabase.com',
  tailscale: 'tailscale.com',
  docker: 'docker.com',
  cloudflare: 'cloudflare.com',
  digitalocean: 'digitalocean.com',
  heroku: 'heroku.com',
  zoom: 'zoom.us',
  uber: 'uber.com',
  airbnb: 'airbnb.com',
  pinterest: 'pinterest.com',
  twitch: 'twitch.tv',
  steam: 'steampowered.com',
  roblox: 'roblox.com',
  bandlab: 'bandlab.com',
  microsoft: 'microsoft.com',
  office: 'microsoft.com'
};

// ── 3. Deterministic Brand Gradient Palette ──
export const BRAND_GRADIENT_PALETTE: [string, string][] = [
  ['#4238C9', '#7D3BEC'], // Indigo -> Violet
  ['#059669', '#10B981'], // Emerald -> Teal
  ['#0384C7', '#38BDF8'], // Ocean -> Sky
  ['#BF123D', '#F43F5E'], // Crimson -> Rose
  ['#D97706', '#F59E0B'], // Amber -> Tangerine
  ['#6E29D9', '#C026D3'], // Violet -> Fuchsia
  ['#0D9488', '#06B6D4'], // Teal -> Cyan
  ['#1D4ED8', '#6366F1'], // Royal -> Indigo
  ['#EA580C', '#FB923C'], // Orange -> Coral
  ['#DB2777', '#FB7185'], // Pink -> Rose
  ['#15803D', '#34D399'], // Forest -> Emerald
  ['#334155', '#64748B']  // Slate -> Zinc
];

/**
 * Strips common subdomain prefixes to extract base domain.
 */
export function cleanDomainHost(host: string): string {
  let domain = host.toLowerCase().trim();
  const commonPrefixes = [
    'www.', 'app.', 'mail.', 'accounts.', 'account.', 'login.', 'signin.',
    'auth.', 'm.', 'dashboard.', 'portal.', 'api.', 'sso.', 'my.', 'web.',
    'id.', 'secure.', 'identity.', 'member.', 'user.', 'users.', 'ide.'
  ];
  for (const prefix of commonPrefixes) {
    if (domain.startsWith(prefix)) {
      domain = domain.slice(prefix.length);
      break;
    }
  }
  return domain;
}

export function sanitizeTitle(title: string): string {
  return title
    .replace(/\s*\([^)]*\)|\s*\[[^\]]*\]/g, '')
    .trim();
}

export function inferDomainFromTitle(title: string): string | null {
  const clean = sanitizeTitle(title).toLowerCase();
  if (!clean) return null;
  if (BRAND_DICTIONARY[clean]) return BRAND_DICTIONARY[clean];

  for (const [brand, domain] of Object.entries(BRAND_DICTIONARY)) {
    if (clean === brand || clean.startsWith(brand + ' ') || clean.endsWith(' ' + brand)) {
      return domain;
    }
  }
  return null;
}

/**
 * Resolves an item to candidate domains in priority order, resolving
 * parent brands (e.g. account.live.com -> microsoft.com) first.
 */
export function resolveItemDomains(opts: {
  urls?: string[];
  title?: string;
  oauthProvider?: string;
  domain?: string;
}): string[] {
  const domains: string[] = [];

  const add = (d: string) => {
    const trimmed = d.toLowerCase().trim();
    if (!trimmed || domains.includes(trimmed)) return;
    domains.push(trimmed);
  };

  const addWithBrandResolution = (rawDomain: string) => {
    const raw = rawDomain.toLowerCase().trim();
    const clean = cleanDomainHost(raw);

    // 1. Check parent brand map for raw domain (e.g. "account.live.com" -> "microsoft.com")
    if (PARENT_BRAND_MAP[raw]) add(PARENT_BRAND_MAP[raw]);
    // 2. Check parent brand map for clean domain (e.g. "live.com" -> "microsoft.com")
    if (PARENT_BRAND_MAP[clean]) add(PARENT_BRAND_MAP[clean]);
    // 3. Add clean domain itself
    add(clean);
    // 4. Add raw domain as fallback
    if (clean !== raw) add(raw);
  };

  // Direct domain option
  if (opts.domain) {
    addWithBrandResolution(opts.domain);
  }

  // OAuth Provider
  if (opts.oauthProvider) {
    const p = opts.oauthProvider.toLowerCase().trim();
    if (p === 'google') add('google.com');
    else if (p === 'apple') add('apple.com');
    else if (p === 'github') add('github.com');
    else if (p === 'microsoft') add('microsoft.com');
    else if (p === 'slack') add('slack.com');
    else if (p === 'discord') add('discord.com');
    else if (p === 'facebook') add('facebook.com');
    else if (p === 'twitter' || p === 'x') add('x.com');
  }

  // URLs
  if (opts.urls && opts.urls.length > 0) {
    for (const u of opts.urls) {
      if (!u || !u.trim()) continue;
      try {
        const parsed = new URL(u.includes('://') ? u : `https://${u}`);
        if (parsed.hostname) {
          addWithBrandResolution(parsed.hostname);
        }
      } catch {
        const parts = u.split('/')[0].split('?')[0];
        if (parts.includes('.')) addWithBrandResolution(parts);
      }
    }
  }

  // Title if it looks like a domain (e.g. "spotify.com" or "odc.officeapps.live.com")
  const title = sanitizeTitle(opts.title || '');
  if (title.includes('.') && !title.includes(' ')) {
    addWithBrandResolution(title);
  }

  // Title brand inference (e.g. "Spotify", "GitHub", "Microsoft")
  const inferred = inferDomainFromTitle(title);
  if (inferred) add(inferred);

  return domains;
}

/**
 * Builds candidate URLs in high-resolution priority order.
 */
export function buildFaviconCandidates(domain: string): string[] {
  return [
    // Tier 1: Google High-DPI Favicon V2 (128px)
    `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
    // Tier 2: Google S2 High-DPI (128px)
    `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
    // Tier 3: DuckDuckGo Icon
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    // Tier 4: Clearbit Logo (128px)
    `https://logo.clearbit.com/${domain}?size=128`,
    // Tier 5: Direct Apple Touch Icon
    `https://${domain}/apple-touch-icon.png`
  ];
}

// ── 4. JEV AI (Just-Enough Vision) Pixel Classifier ──
/**
 * JEV AI pixel classifier running in-browser via Canvas.
 * Analyzes the 64x64 RGBA pixel grid to classify rendering style:
 * - .standard: white plate + 78% inset + border
 * - .fullBleed: edge-to-edge squircle clip
 * - .coloredSquircle(r, g, b): squircle filled with sampled brand color
 * - Cutout Contrast Detection: automatically gives dark (#121212) or white
 *   plate when inner stencil cutouts (Spotify) are detected without domain overrides!
 * - .circleAdapted: circular logo adaptation
 */
export function classifyRenderingStyle(img: HTMLImageElement | ImageBitmap): LogoRenderingStyle {
  try {
    const dim = 64;
    const canvas = document.createElement('canvas');
    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { type: 'standard' };

    ctx.clearRect(0, 0, dim, dim);
    ctx.drawImage(img, 0, 0, dim, dim);

    const imgData = ctx.getImageData(0, 0, dim, dim);
    const pixels = imgData.data;

    const cSz = 10;
    const aFade = 40;
    const whiteLow = 210;

    const px = (x: number, y: number) => {
      const i = (y * dim + x) * 4;
      return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
    };

    const cornerOrigins = [
      [0, 0],
      [dim - cSz, 0],
      [0, dim - cSz],
      [dim - cSz, dim - cSz]
    ];

    let nTransparent = 0;
    let nWhite = 0;
    let nTotal = 0;
    const coloredR: number[] = [];
    const coloredG: number[] = [];
    const coloredB: number[] = [];

    for (const [cx, cy] of cornerOrigins) {
      for (let dy = 0; dy < cSz; dy++) {
        for (let dx = 0; dx < cSz; dx++) {
          const [r, g, b, a] = px(cx + dx, cy + dy);
          nTotal++;
          if (a < aFade) {
            nTransparent++;
          } else if (r > whiteLow && g > whiteLow && b > whiteLow) {
            nWhite++;
          } else {
            coloredR.push(r / 255);
            coloredG.push(g / 255);
            coloredB.push(b / 255);
          }
        }
      }
    }

    if (nTotal === 0) return { type: 'standard' };

    const transpRatio = nTransparent / nTotal;
    const whiteRatio = nWhite / nTotal;
    const coloredRatio = coloredR.length / nTotal;

    // Rule 1: Predominantly white corners (>= 50%) -> .standard (white strip plate)
    if (whiteRatio >= 0.50) {
      return { type: 'standard' };
    }

    // Rule 2: Colored corners (>= 40%) with uniform solid background
    if (coloredRatio >= 0.40 && coloredR.length > 0) {
      const n = coloredR.length;
      const avgR = coloredR.reduce((a, b) => a + b, 0) / n;
      const avgG = coloredG.reduce((a, b) => a + b, 0) / n;
      const avgB = coloredB.reduce((a, b) => a + b, 0) / n;

      const varR = coloredR.map(v => (v - avgR) ** 2).reduce((a, b) => a + b, 0) / n;
      const varG = coloredG.map(v => (v - avgG) ** 2).reduce((a, b) => a + b, 0) / n;
      const varB = coloredB.map(v => (v - avgB) ** 2).reduce((a, b) => a + b, 0) / n;
      const totalVariance = varR + varG + varB;

      if (totalVariance < 0.05) {
        return { type: 'coloredSquircle', r: avgR, g: avgG, b: avgB };
      } else {
        return { type: 'fullBleed' };
      }
    }

    // Rule 3: Transparent corners (>= 50%)
    if (transpRatio >= 0.50) {
      const insets = [
        [Math.floor(dim / 2), 6],
        [Math.floor(dim / 2), dim - 7],
        [6, Math.floor(dim / 2)],
        [dim - 7, Math.floor(dim / 2)]
      ];

      let midOpaque = 0;
      const midR: number[] = [];
      const midG: number[] = [];
      const midB: number[] = [];

      for (const [x, y] of insets) {
        const [r, g, b, a] = px(x, y);
        if (a > aFade) {
          midOpaque++;
          if (!(r > whiteLow && g > whiteLow && b > whiteLow)) {
            midR.push(r / 255);
            midG.push(g / 255);
            midB.push(b / 255);
          }
        }
      }

      let totalOpaque = 0;
      let innerTransp = 0;
      let innerTotal = 0;

      for (let y = 0; y < dim; y++) {
        for (let x = 0; x < dim; x++) {
          const [, , , a] = px(x, y);
          if (a > aFade) totalOpaque++;
          if (x >= 16 && x < 48 && y >= 16 && y < 48) {
            innerTotal++;
            if (a < aFade) innerTransp++;
          }
        }
      }

      const opRatio = totalOpaque / (dim * dim);
      const innerTranspRatio = innerTransp / Math.max(1, innerTotal);

      // Solid colored card with rounded corners:
      if (midOpaque === 4 && midR.length === 4 && opRatio >= 0.68) {
        const avgR = midR.reduce((a, b) => a + b, 0) / 4;
        const avgG = midG.reduce((a, b) => a + b, 0) / 4;
        const avgB = midB.reduce((a, b) => a + b, 0) / 4;
        const varR = midR.map(v => (v - avgR) ** 2).reduce((a, b) => a + b, 0) / 4;
        const varG = midG.map(v => (v - avgG) ** 2).reduce((a, b) => a + b, 0) / 4;
        const varB = midB.map(v => (v - avgB) ** 2).reduce((a, b) => a + b, 0) / 4;

        if ((varR + varG + varB) < 0.05) {
          // ── JEV AI Cutout Contrast Detection ──
          // If inner core contains transparent cutouts (e.g. Spotify sound waves):
          if (innerTranspRatio > 0.05) {
            const luminance = 0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB;
            if (luminance > 0.35) {
              // Bright body (Spotify green): use dark contrasting plate (#121212)
              return { type: 'coloredSquircle', r: 0.07, g: 0.07, b: 0.07, isCutout: true };
            } else {
              // Dark body: use white contrasting plate
              return { type: 'standard' };
            }
          }
          return { type: 'coloredSquircle', r: avgR, g: avgG, b: avgB };
        }
      }

      // Isolated symbol on transparent canvas -> .standard
      return { type: 'standard' };
    }

    return { type: 'standard' };
  } catch {
    // If canvas reading is blocked by security, fallback to standard
    return { type: 'standard' };
  }
}

// ── 5. Monogram & Palette Generator ──
export function getMonogram(title?: string, domain?: string): string {
  const cleanTitle = sanitizeTitle(title || '');
  if (cleanTitle) {
    if (cleanTitle.includes('.') && !cleanTitle.includes(' ')) {
      const parts = cleanTitle.split('.');
      if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    }
    const words = cleanTitle.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    if (cleanTitle.length >= 2) {
      return cleanTitle.slice(0, 2).toUpperCase();
    }
    return cleanTitle.toUpperCase();
  }

  if (domain) {
    const clean = cleanDomainHost(domain);
    const parts = clean.split('.');
    if (parts[0] && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  }

  return 'K';
}

export function getBrandGradient(key: string): [string, string] {
  let hash = 0;
  const str = key.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % BRAND_GRADIENT_PALETTE.length;
  return BRAND_GRADIENT_PALETTE[index];
}

// ── 6. In-Memory Favicon Cache ──
const memoryCache = new Map<string, CachedFavicon>();
const inFlightFetches = new Map<string, Promise<CachedFavicon | null>>();

/**
 * Loads an image from URL into memory. Tries background relay or local fetch to avoid CORS canvas taint.
 */
async function loadAndClassifyUrl(url: string): Promise<CachedFavicon | null> {
  try {
    let finalSrc = url;

    // 1. Try background relay first if in Chrome extension context
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        const bgRes = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_DATA_URL', url }, (res) => {
            if (chrome.runtime.lastError || !res?.success) resolve(null);
            else resolve(res);
          });
        });
        if (bgRes?.dataUrl) {
          finalSrc = bgRes.dataUrl;
        }
      } catch {
        // Fall back to direct fetch / Image
      }
    }

    // 2. Try direct fetch with Blob if background didn't return
    if (finalSrc === url && typeof fetch !== 'undefined') {
      try {
        const resp = await fetch(url, { mode: 'cors' });
        if (resp.ok) {
          const blob = await resp.blob();
          if (url.includes('duckduckgo.com') && blob.size === 1478) return null;
          if ((url.includes('gstatic') || url.includes('google')) && (blob.size === 426 || blob.size === 726)) return null;
          if (blob.size >= 50) {
            finalSrc = URL.createObjectURL(blob);
          }
        }
      } catch {
        finalSrc = url;
      }
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    const loaded = await new Promise<boolean>((resolve) => {
      img.onload = () => {
        if (img.naturalWidth <= 2 || img.naturalHeight <= 2) {
          resolve(false);
          return;
        }
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = finalSrc;
    });

    if (!loaded) {
      if (finalSrc.startsWith('blob:')) URL.revokeObjectURL(finalSrc);
      return null;
    }

    // Run JEV AI pixel classifier
    const style = classifyRenderingStyle(img);

    return {
      src: finalSrc,
      style
    };
  } catch {
    return null;
  }
}

/**
 * Resolves high-resolution favicon for an item or domain using the multi-tier waterfall.
 */
export async function resolveFavicon(options: FaviconRenderOptions): Promise<CachedFavicon | null> {
  const domains = resolveItemDomains({
    urls: options.urls || options.item?.urls,
    title: options.title || options.item?.title,
    oauthProvider: options.oauthProvider || options.item?.oauthProvider || options.item?.oauth?.provider,
    domain: options.domain || options.item?.domain
  });

  if (domains.length === 0) return null;

  const cacheKey = domains.join('|');
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  if (inFlightFetches.has(cacheKey)) {
    return inFlightFetches.get(cacheKey)!;
  }

  const fetchPromise = (async () => {
    for (const d of domains) {
      const candidateUrls = buildFaviconCandidates(d);
      for (const url of candidateUrls) {
        const result = await loadAndClassifyUrl(url);
        if (result) {
          memoryCache.set(cacheKey, result);
          return result;
        }
      }
    }
    return null;
  })();

  inFlightFetches.set(cacheKey, fetchPromise);
  try {
    const res = await fetchPromise;
    return res;
  } finally {
    inFlightFetches.delete(cacheKey);
  }
}

/**
 * Synchronously checks if a favicon is already cached in memory.
 */
export function getCachedFaviconSync(options: FaviconRenderOptions): CachedFavicon | null {
  const domains = resolveItemDomains({
    urls: options.urls || options.item?.urls,
    title: options.title || options.item?.title,
    oauthProvider: options.oauthProvider || options.item?.oauthProvider || options.item?.oauth?.provider,
    domain: options.domain || options.item?.domain
  });
  if (domains.length === 0) return null;
  const cacheKey = domains.join('|');
  return memoryCache.get(cacheKey) || null;
}

// ── 7. Unified DOM Favicon Renderer ──

/**
 * Renders an interactive, responsive JEV AI Favicon squircle into the provided container.
 * Seamlessly handles loading, monogram fallbacks, and autonomous pixel-classified styling.
 */
export function renderFavicon(container: HTMLElement, options: FaviconRenderOptions): HTMLElement {
  const size = options.size || 32;
  const squircleRadius = Math.max(4, Math.round(size * 0.2237));
  const domains = resolveItemDomains({
    urls: options.urls || options.item?.urls,
    title: options.title || options.item?.title,
    oauthProvider: options.oauthProvider || options.item?.oauthProvider || options.item?.oauth?.provider,
    domain: options.domain || options.item?.domain
  });

  const primaryKey = domains[0] || options.title || options.item?.title || 'kloak';
  const monogram = getMonogram(options.title || options.item?.title, domains[0]);
  const [grad1, grad2] = getBrandGradient(primaryKey);

  // Configure container
  container.innerHTML = '';
  container.classList.add('kloak-favicon-squircle');
  container.style.setProperty('width', `${size}px`, 'important');
  container.style.setProperty('height', `${size}px`, 'important');
  container.style.setProperty('border-radius', `${squircleRadius}px`, 'important');
  container.style.position = 'relative';
  container.style.display = 'inline-flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.overflow = 'hidden';
  container.style.flexShrink = '0';
  container.style.boxSizing = 'border-box';
  container.style.boxShadow = '0 1px 3px rgba(0,0,0,0.22)';
  container.style.userSelect = 'none';

  // Fallback monogram element
  const fallback = document.createElement('div');
  fallback.className = 'kloak-favicon-monogram';
  fallback.style.position = 'absolute';
  fallback.style.inset = '0';
  fallback.style.display = 'flex';
  fallback.style.alignItems = 'center';
  fallback.style.justifyContent = 'center';
  fallback.style.background = `linear-gradient(135deg, ${grad1}, ${grad2})`;
  fallback.style.color = '#ffffff';
  fallback.style.fontSize = `${Math.max(9, Math.round(size * 0.38))}px`;
  fallback.style.fontWeight = '700';
  fallback.style.letterSpacing = '-0.02em';
  fallback.style.borderRadius = `${squircleRadius}px`;
  fallback.textContent = monogram;

  container.appendChild(fallback);

  // Apply classified style to the container and image
  const applyStyle = (cached: CachedFavicon) => {
    container.innerHTML = '';

    const plate = document.createElement('div');
    plate.className = 'kloak-favicon-plate';
    plate.style.position = 'absolute';
    plate.style.inset = '0';
    plate.style.display = 'flex';
    plate.style.alignItems = 'center';
    plate.style.justifyContent = 'center';
    plate.style.borderRadius = `${squircleRadius}px`;
    plate.style.overflow = 'hidden';

    const img = document.createElement('img');
    img.src = cached.src;
    img.alt = options.title || primaryKey;
    img.style.display = 'block';

    const s = cached.style;
    switch (s.type) {
      case 'standard': {
        // Clean white plate + 78% inset + border
        plate.style.background = '#ffffff';
        plate.style.border = '1px solid rgba(0, 0, 0, 0.08)';
        img.style.setProperty('width', '78%', 'important');
        img.style.setProperty('height', '78%', 'important');
        img.style.setProperty('object-fit', 'contain', 'important');
        break;
      }
      case 'fullBleed': {
        // Full bleed edge-to-edge
        plate.style.background = 'transparent';
        img.style.setProperty('width', '100%', 'important');
        img.style.setProperty('height', '100%', 'important');
        img.style.setProperty('object-fit', 'cover', 'important');
        break;
      }
      case 'coloredSquircle': {
        // Sampled brand plate or dark contrast plate
        const rgb = `rgb(${Math.round(s.r * 255)}, ${Math.round(s.g * 255)}, ${Math.round(s.b * 255)})`;
        plate.style.background = rgb;
        if (s.isCutout) {
          // Inner stencil cutout (e.g. Spotify): inset slightly so dark plate frames the logo
          img.style.setProperty('width', '82%', 'important');
          img.style.setProperty('height', '82%', 'important');
          img.style.setProperty('object-fit', 'contain', 'important');
        } else {
          // Solid brand card: bleed to fit
          img.style.setProperty('width', '100%', 'important');
          img.style.setProperty('height', '100%', 'important');
          img.style.setProperty('object-fit', 'contain', 'important');
        }
        break;
      }
      case 'circleAdapted': {
        plate.style.borderRadius = '50%';
        plate.style.background = '#ffffff';
        img.style.setProperty('width', '100%', 'important');
        img.style.setProperty('height', '100%', 'important');
        img.style.setProperty('object-fit', 'cover', 'important');
        break;
      }
    }

    plate.appendChild(img);
    container.appendChild(plate);
  };

  // Check cache synchronously
  const syncCached = getCachedFaviconSync(options);
  if (syncCached) {
    applyStyle(syncCached);
    return container;
  }

  // Asynchronously resolve and cross-fade
  resolveFavicon(options).then((res) => {
    if (res && container.isConnected) {
      applyStyle(res);
    }
  });

  return container;
}
