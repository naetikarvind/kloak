/**
 * Kloak Threat Detection & Masked Alias Engine
 * Detects phishing, typosquatting, high-risk TLDs, and generates custom disposable forwarding aliases.
 */

export interface ThreatAnalysis {
  isSuspicious: boolean;
  riskScore: number; // 0 - 100
  targetDomain: string;
  reasons: string[];
  suggestedAction: 'mask_email' | 'warn' | 'safe';
  suggestedAliasEmail: string;
}

const HIGH_PROFILE_DOMAINS = [
  'google.com', 'accounts.google.com', 'apple.com', 'icloud.com',
  'microsoft.com', 'live.com', 'outlook.com', 'office.com', 'login.microsoftonline.com',
  'amazon.com', 'paypal.com', 'github.com', 'netflix.com',
  'spotify.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'proton.me', 'protonmail.com', 'chase.com', 'bankofamerica.com',
  'wellsfargo.com', 'citi.com', 'coinbase.com', 'binance.com',
  'dropbox.com', 'slack.com', 'notion.so', 'figma.com',
  'openai.com', 'chatgpt.com', 'anthropic.com', 'claude.ai', 'discord.com',
  'gemini.com', 'youtube.com', 'gmail.com', 'kloak.app'
];

interface KnownBrand {
  name: string;
  legitDomains: string[];
}

const KNOWN_BRANDS: KnownBrand[] = [
  { name: 'google', legitDomains: ['google.com', 'google.co.uk', 'google.ca', 'google.co.in', 'google.co.jp', 'googleapis.com', 'gstatic.com', 'youtube.com', 'gmail.com', 'googleusercontent.com', 'deepmind.google'] },
  { name: 'gemini', legitDomains: ['gemini.com', 'google.com'] },
  { name: 'apple', legitDomains: ['apple.com', 'icloud.com', 'me.com'] },
  { name: 'microsoft', legitDomains: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'microsoftonline.com', 'azure.com', 'bing.com', 'msn.com'] },
  { name: 'paypal', legitDomains: ['paypal.com', 'paypal.me'] },
  { name: 'amazon', legitDomains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.in', 'aws.amazon.com'] },
  { name: 'netflix', legitDomains: ['netflix.com'] },
  { name: 'spotify', legitDomains: ['spotify.com'] },
  { name: 'github', legitDomains: ['github.com', 'github.io', 'githubassets.com'] },
  { name: 'openai', legitDomains: ['openai.com', 'chatgpt.com'] },
  { name: 'chatgpt', legitDomains: ['openai.com', 'chatgpt.com'] },
  { name: 'claude', legitDomains: ['anthropic.com', 'claude.ai'] },
  { name: 'anthropic', legitDomains: ['anthropic.com', 'claude.ai'] },
  { name: 'coinbase', legitDomains: ['coinbase.com'] },
  { name: 'binance', legitDomains: ['binance.com'] },
  { name: 'chase', legitDomains: ['chase.com'] },
  { name: 'facebook', legitDomains: ['facebook.com', 'fb.com', 'meta.com'] },
  { name: 'instagram', legitDomains: ['instagram.com'] },
  { name: 'discord', legitDomains: ['discord.com', 'discord.gg'] }
];

const HIGH_RISK_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'buzz', 'xyz', 'click',
  'rest', 'cam', 'sbs', 'cfd', 'fit', 'icu', 'work', 'loan', 'men',
  'stream', 'trade', 'bid', 'racing', 'date', 'faith', 'review', 'zip', 'mov'
]);

const PHISHING_KEYWORDS = [
  'login-', 'signin-', 'secure-', 'verify-', 'account-update',
  'auth-', 'wallet-connect', 'web3-', 'security-alert', 'confirm-identity',
  'support-', 'billing-update', 'recover-password', 'session-expired'
];

const MULTI_PART_TLDS = new Set([
  'co.uk', 'gov.uk', 'ac.uk', 'org.uk',
  'com.au', 'net.au', 'org.au', 'edu.au',
  'co.jp', 'ne.jp', 'ac.jp', 'go.jp',
  'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in',
  'com.br', 'net.br', 'gov.br',
  'com.sg', 'edu.sg', 'gov.sg',
  'com.mx', 'edu.mx',
  'co.nz', 'net.nz', 'org.nz',
  'co.za', 'org.za'
]);

export function getBaseDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.');
  if (parts.length <= 2) return hostname.toLowerCase();

  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

export function getSLD(baseDomain: string): string {
  const parts = baseDomain.split('.');
  return parts[0];
}

function isLegitSubdomainOrDomain(host: string, targetDomain: string): boolean {
  const cleanTarget = targetDomain.replace(/^www\./, '').toLowerCase();
  return host === cleanTarget || host.endsWith('.' + cleanTarget);
}

function levenshtein(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
}

export function generateMaskedAlias(domain: string): string {
  const clean = domain.replace(/^www\./, '').split('.')[0] || 'site';
  const safeSlug = clean.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'site';
  const randomHex = Math.random().toString(36).substring(2, 8);
  return `protect.${safeSlug}.${randomHex}@shield.kloak.app`;
}

export function analyzeUrl(urlString: string): ThreatAnalysis {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return {
      isSuspicious: false,
      riskScore: 0,
      targetDomain: '',
      reasons: [],
      suggestedAction: 'safe',
      suggestedAliasEmail: ''
    };
  }

  const host = url.hostname.toLowerCase();
  const cleanHost = host.replace(/^www\./, '');
  const baseDomain = getBaseDomain(cleanHost);
  const sld = getSLD(baseDomain);

  let riskScore = 0;
  const reasons: string[] = [];
  let targetedLegitDomain = cleanHost;

  // 1. IP Address check
  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (isIP) {
    riskScore += 45;
    reasons.push('Raw IP address used instead of verified domain');
  }

  // 2. High-Risk TLD check
  const parts = host.split('.');
  const tld = parts[parts.length - 1];
  if (HIGH_RISK_TLDS.has(tld)) {
    riskScore += 35;
    reasons.push(`High-risk top-level domain (.${tld}) frequently used in phishing campaigns`);
  }

  // 3. Phishing Keywords
  const fullPath = (host + url.pathname).toLowerCase();
  for (const kw of PHISHING_KEYWORDS) {
    if (fullPath.includes(kw)) {
      riskScore += 25;
      reasons.push(`Suspicious credential harvesting keyword detected: '${kw}'`);
      break;
    }
  }

  // 4. Official Verified Domain & Subdomain Recognition
  let isOfficialDomain = false;
  for (const highProfile of HIGH_PROFILE_DOMAINS) {
    if (isLegitSubdomainOrDomain(cleanHost, highProfile)) {
      isOfficialDomain = true;
      targetedLegitDomain = highProfile.replace(/^www\./, '');
      break;
    }
  }

  if (!isOfficialDomain) {
    for (const brand of KNOWN_BRANDS) {
      if (brand.legitDomains.some(ld => isLegitSubdomainOrDomain(cleanHost, ld))) {
        isOfficialDomain = true;
        targetedLegitDomain = brand.legitDomains[0];
        break;
      }
    }
  }

  // If host is confirmed legitimate and official, do not perform impersonation/typosquatting checks
  if (!isOfficialDomain) {
    // 5. Brand Impersonation & Subdomain Spoofing Checks
    const addedReasons = new Set<string>();

    for (const brand of KNOWN_BRANDS) {
      const isLegitForThisBrand = brand.legitDomains.some(ld => isLegitSubdomainOrDomain(cleanHost, ld));
      if (isLegitForThisBrand) continue;

      // Check A: Subdomain spoofing where brand domain is embedded in a malicious subdomain
      // e.g. google.com.phishing.xyz or login.paypal.com.attacker.top
      for (const ld of brand.legitDomains) {
        if (cleanHost.includes(ld + '.') || cleanHost.includes(ld + '-')) {
          riskScore += 65;
          targetedLegitDomain = ld;
          const msg = `Potential brand impersonation of ${ld} via deceptive subdomain`;
          if (!addedReasons.has(msg)) {
            addedReasons.add(msg);
            reasons.push(msg);
          }
          break;
        }
      }

      // Check B: Base domain (SLD) contains brand name with deceptive prefixes/suffixes
      // e.g. google-login.com, verify-paypal.com
      if (sld.includes(brand.name) && sld !== brand.name) {
        const regex = new RegExp(`(^|[-_])${brand.name}([-_]|$)`);
        if (regex.test(sld) || sld.includes(`${brand.name}-`) || sld.includes(`-${brand.name}`)) {
          riskScore += 60;
          targetedLegitDomain = brand.legitDomains[0];
          const msg = `Potential brand hijacking: domain resembles '${brand.name}' brand (${brand.legitDomains[0]})`;
          if (!addedReasons.has(msg)) {
            addedReasons.add(msg);
            reasons.push(msg);
          }
          break;
        }
      }

      // Check C: Typosquatting / Lookalike on SLD (e.g. g00gle.com, paypa1.com, micros0ft.com)
      const brandSLD = brand.name;
      if (brandSLD.length >= 4) {
        const dist = levenshtein(sld, brandSLD);
        if (dist > 0 && dist <= 2 && Math.abs(sld.length - brandSLD.length) <= 2) {
          riskScore += 65;
          targetedLegitDomain = brand.legitDomains[0];
          const msg = `Typosquatting detected: '${sld}' is a deceptive lookalike of '${brandSLD}' (${brand.legitDomains[0]})`;
          if (!addedReasons.has(msg)) {
            addedReasons.add(msg);
            reasons.push(msg);
          }
          break;
        }
      }
    }
  }

  // 6. Insecure HTTP login form
  if (url.protocol === 'http:' && (fullPath.includes('login') || fullPath.includes('auth') || fullPath.includes('signin'))) {
    riskScore += 40;
    reasons.push('Insecure unencrypted HTTP connection submitting credentials');
  }

  const isSuspicious = riskScore >= 40;
  const suggestedAction = isSuspicious ? 'mask_email' : (riskScore > 20 ? 'warn' : 'safe');
  const alias = isSuspicious ? generateMaskedAlias(cleanHost) : '';

  return {
    isSuspicious,
    riskScore: Math.min(100, riskScore),
    targetDomain: targetedLegitDomain,
    reasons,
    suggestedAction,
    suggestedAliasEmail: alias
  };
}
