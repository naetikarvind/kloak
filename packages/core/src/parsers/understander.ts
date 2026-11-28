/**
 * Kloak Core — Smart Credential Understander
 * Classifies credential roles, enforces strict cross-type combining
 * (`login` + `authenticator` / `recovery_code`), and matches similarly named
 * records across titles, URLs, notes, and username hints.
 */

import { VaultItem } from '../models/vault.js';

export type CombinableCredentialRole = 'login' | 'authenticator' | 'recovery_code' | 'other';

export interface CombineValidationResult {
  isAllowed: boolean;
  reason?: string;
  roles: CombinableCredentialRole[];
}

export interface CredentialUnderstanding {
  itemId: string;
  role: CombinableCredentialRole;
  hasAuthenticatorCapability: boolean;
  hasRecoveryCapability: boolean;
  primaryServiceKey: string;
  serviceTokens: string[];
  domains: string[];
  usernameHint?: string;
}

export interface SmartServiceMatch {
  confidence: number;
  reason: string;
  serviceKey: string;
}

export interface CrossTypeConsolidationResult {
  items: VaultItem[];
  combinedCount: number;
  combinedDescriptions: string[];
}

const BRAND_ALIASES: Record<string, string> = {
  gmail: 'google',
  googlemail: 'google',
  googledrive: 'google',
  protonmail: 'proton',
  protonme: 'proton',
  protonvpn: 'proton',
  protonpass: 'proton',
  protondrive: 'proton',
  pm: 'proton',
  outlook: 'microsoft',
  hotmail: 'microsoft',
  live: 'microsoft',
  office365: 'microsoft',
  microsoftonline: 'microsoft',
  msn: 'microsoft',
  azure: 'microsoft',
  appleid: 'apple',
  icloud: 'apple',
  amazonaws: 'aws',
  twitter: 'twitter',
  x: 'twitter',
  fb: 'facebook',
  ig: 'instagram',
  chatgpt: 'openai',
  ymail: 'yahoo',
  gh: 'github',
  '1password': 'onepassword',
  lastpass: 'lastpass',
  bitwarden: 'bitwarden',
  cloudflare: 'cloudflare',
  discord: 'discord',
  github: 'github',
  gitlab: 'gitlab',
  bitbucket: 'bitbucket',
  digitalocean: 'digitalocean',
  dropbox: 'dropbox',
  linkedin: 'linkedin',
  reddit: 'reddit',
  twitch: 'twitch',
  steam: 'steam',
  epicgames: 'epicgames',
  nintendo: 'nintendo',
  playstation: 'playstation',
  sony: 'sony',
  stripe: 'stripe',
  paypal: 'paypal',
  coinbase: 'coinbase',
  binance: 'binance',
  kraken: 'kraken',
  npm: 'npmjs',
  npmjs: 'npmjs',
  pypi: 'pypi',
  docker: 'docker',
  dockerhub: 'docker',
  vercel: 'vercel',
  netlify: 'netlify',
  heroku: 'heroku',
  supabase: 'supabase',
  firebase: 'firebase',
};

const KNOWN_TLDS = new Set([
  'com', 'org', 'net', 'io', 'dev', 'app', 'co', 'ai', 'me', 'tv',
  'gg', 'xyz', 'edu', 'gov', 'info', 'biz', 'cloud', 'tech', 'sh',
  'so', 'to', 'cc', 'us', 'uk', 'ca', 'de', 'fr', 'jp', 'in', 'au',
  'nl', 'ch', 'se', 'no', 'fi', 'it', 'es', 'br', 'ru', 'kr',
]);

const COMPOUND_SUFFIX_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'com.au', 'net.au', 'co.in', 'co.jp', 'com.br', 'co.nz',
]);

const AUTH_SUBDOMAINS = new Set([
  'www', 'login', 'signin', 'sign-in', 'auth', 'oauth', 'sso', 'id',
  'account', 'accounts', 'myaccount', 'app', 'portal', 'web', 'mail',
  'gist', 'console', 'dash', 'dashboard', 'cloud', 'api', 'secure', 'm', 'mobile',
]);

const NOISE_WORDS = new Set([
  'recovery', 'recover', 'code', 'codes', 'backup', 'backups',
  'authenticator', 'auth', '2fa', 'mfa', 'totp', 'otp', 'hotp',
  'u2f', 'fido', 'fido2', 'passkey', 'passkeys',
  'token', 'tokens', 'key', 'keys', 'kit', 'kits',
  'emergency', 'rescue', 'scratch', 'onetime', 'singleuse', 'offline',
  'security', 'verification', 'verify', 'verified',
  'secret', 'secrets', 'phrase', 'phrases', 'seed', 'mnemonic',
  'note', 'notes', 'secure', 'login', 'logins', 'account', 'accounts',
  'password', 'passwords', 'pass', 'cred', 'creds', 'credential', 'credentials',
  'vault', 'export', 'exported', 'import', 'imported',
  'txt', 'text', 'md', 'markdown', 'csv', 'json', 'xml', 'kdbx', '1pux',
  'file', 'sheet', 'list', 'copy', 'for', 'of', 'the', 'my', 'and', 'or',
  'to', 'on', 'in', 'at', 'with', 'from', 'your', 'user', 'username', 'email',
  'step', 'factor', 'app', 'portal', 'signin', 'sso', 'website', 'service',
  'generated', 'saved', 'downloaded', 'personal', 'work', 'primary', 'main', 'old', 'new',
]);

const CONCATENATED_ROLE_SUFFIXES = [
  'recoverycodes', 'recoverycode', 'recoverykeys', 'recoverykey',
  'backupcodes', 'backupcode', 'scratchcodes', 'scratchcode',
  'authenticator', 'twofactor', 'recovery', 'backup', 'codes', 'tokens', '2fa', 'mfa', 'totp', 'otp',
];

const RECOVERY_KEYWORDS = [
  'recovery code', 'recovery codes', 'recovery-code', 'recovery-codes', 'recovery_code', 'recovery_codes',
  'backup code', 'backup codes', 'backup-code', 'backup-codes', 'backup_code', 'backup_codes',
  'recovery key', 'recovery keys', 'recovery-key', 'recovery-keys',
  'emergency kit', 'emergency code', 'emergency codes',
  '2fa backup', '2fa recovery', 'mfa backup', 'mfa recovery',
  'scratch code', 'scratch codes', 'one-time code', 'one-time codes', 'onetime code', 'rescue code',
];

const FILE_EXTENSIONS = [
  '.txt', '.text', '.md', '.markdown', '.note', '.json', '.csv', '.xml', '.kdbx', '.1pux', '.key',
];

const HEADER_LINE_PREFIXES = [
  'username:', 'user:', 'account:', 'email:', 'login:',
  'url:', 'website:', 'service:', 'issuer:', 'http://', 'https://',
];

export function extractRecoveryCodesList(item: VaultItem): string[] {
  const notes = item.notes?.trim();
  if (!notes) return [];
  return notes
    .split(/\r?\n/)
    .map(raw => raw.trim().replace(/^(?:\d+[.)]\s+|[-*•]\s+)/, '').trim())
    .filter(line => {
      if (!line || line.startsWith('#') || line.startsWith('//')) return false;
      const lower = line.toLowerCase();
      return !HEADER_LINE_PREFIXES.some(prefix => lower.startsWith(prefix));
    });
}

export function isRecoveryCodeItem(item: VaultItem): boolean {
  if (item.usedRecoveryCodes && item.usedRecoveryCodes.length > 0) return true;
  if (item.tags.some(t => /^recovery(\s+codes)?$/i.test(t.trim()))) return true;

  const lowerTitle = (item.title || '').toLowerCase();
  if (RECOVERY_KEYWORDS.some(k => lowerTitle.includes(k))) return true;
  if (item.type === 'secure_note' && (lowerTitle.includes('recovery') || lowerTitle.includes('backup'))) {
    return true;
  }

  const lowerNotes = (item.notes || '').toLowerCase();
  if (lowerNotes && RECOVERY_KEYWORDS.some(k => lowerNotes.includes(k))) return true;

  const lines = extractRecoveryCodesList(item);
  if (lines.length >= 2 && lines.length <= 36) {
    const sample = lines.slice(0, 8);
    const codePattern = /^[a-zA-Z0-9]{4,}(?:[-\s][a-zA-Z0-9]{3,}){0,4}$/;
    const matches = sample.filter(line => codePattern.test(line) && !line.includes('://')).length;
    if (matches >= Math.min(2, sample.length)) {
      return true;
    }
  }

  return false;
}

export function hasAuthenticatorCapability(item: VaultItem): boolean {
  return Boolean(item.totpSecret && item.totpSecret.trim().length > 0);
}

export function hasRecoveryCapability(item: VaultItem): boolean {
  if (item.type === 'secure_note' && isRecoveryCodeItem(item)) return true;
  if ((item.usedRecoveryCodes?.length ?? 0) > 0) return true;
  if (item.tags.some(t => /^recovery(\s+codes)?$/i.test(t.trim()))) return true;
  return extractRecoveryCodesList(item).length > 0 && isRecoveryCodeItem(item);
}

export function classifyCredentialRole(item: VaultItem): CombinableCredentialRole {
  const hasPassword = Boolean(item.password && item.password.trim().length > 0);
  const hasTotp = hasAuthenticatorCapability(item);
  const hasRecovery = isRecoveryCodeItem(item);

  if (item.type === 'oauth') {
    return 'login';
  }

  if (item.type === 'secure_note') {
    if (hasRecovery) return 'recovery_code';
    if (hasTotp) return 'authenticator';
    return 'other';
  }

  if (item.type === 'login') {
    if (!hasPassword && !hasTotp && hasRecovery) return 'recovery_code';
    if (!hasPassword && hasTotp && !hasRecovery) return 'authenticator';
    return 'login';
  }

  return 'other';
}

function roleDisplayName(role: CombinableCredentialRole): string {
  switch (role) {
    case 'login': return 'Login';
    case 'authenticator': return 'Authenticator (2FA)';
    case 'recovery_code': return 'Recovery Codes';
    default: return 'Other';
  }
}

export function validateCredentialCombination(items: VaultItem[]): CombineValidationResult {
  const roles = items.map(classifyCredentialRole);
  if (items.length < 2) {
    return {
      isAllowed: false,
      reason: 'Select at least 2 credentials of different types (login + authenticator / recovery code).',
      roles,
    };
  }

  const invalidIdx = roles.indexOf('other');
  if (invalidIdx !== -1) {
    return {
      isAllowed: false,
      reason: `"${items[invalidIdx].title || 'Item'}" cannot be combined — only Logins, Authenticators & Recovery Codes are combinable.`,
      roles,
    };
  }

  const seen = new Set<CombinableCredentialRole>();
  for (const role of roles) {
    if (seen.has(role)) {
      return {
        isAllowed: false,
        reason: `Cannot combine multiple ${roleDisplayName(role)} credentials — only different types can be combined.`,
        roles,
      };
    }
    seen.add(role);
  }

  if (items.filter(hasAuthenticatorCapability).length > 1) {
    return {
      isAllowed: false,
      reason: 'More than one selected credential already contains an Authenticator (2FA) secret.',
      roles,
    };
  }

  if (items.filter(hasRecoveryCapability).length > 1) {
    return {
      isAllowed: false,
      reason: 'More than one selected credential already contains Recovery Codes.',
      roles,
    };
  }

  return { isAllowed: true, roles };
}

export function canonicalBrand(token: string): string {
  const lower = token.trim().toLowerCase();
  return BRAND_ALIASES[lower] ?? lower;
}

export function normalizeDomainHost(raw: string): string | undefined {
  const trimmed = (raw || '').trim().toLowerCase();
  if (!trimmed) return undefined;
  try {
    const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
    const url = new URL(withScheme);
    let host = url.hostname.toLowerCase();
    if (!host) return undefined;
    if (host.startsWith('www.')) host = host.slice(4);
    const parts = host.split('.').filter(Boolean);
    if (parts.length < 2) return undefined;
    if (parts.length >= 3) {
      const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      if (COMPOUND_SUFFIX_TLDS.has(lastTwo)) {
        return `${parts[parts.length - 3]}.${lastTwo}`;
      }
    }
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  } catch {
    return undefined;
  }
}

export function brandFromDomain(domain: string): string | undefined {
  const parts = domain.toLowerCase().split('.').filter(Boolean);
  if (parts.length < 2) return undefined;
  const meaningful = [...parts];
  if (meaningful.length >= 3) {
    const lastTwo = `${meaningful[meaningful.length - 2]}.${meaningful[meaningful.length - 1]}`;
    if (COMPOUND_SUFFIX_TLDS.has(lastTwo)) {
      meaningful.splice(-2, 2);
    } else {
      meaningful.pop();
    }
  } else {
    meaningful.pop();
  }
  while (meaningful.length > 1 && AUTH_SUBDOMAINS.has(meaningful[0])) {
    meaningful.shift();
  }
  const label = meaningful[meaningful.length - 1];
  if (!label) return undefined;
  const aliased = canonicalBrand(label);
  return NOISE_WORDS.has(aliased) ? undefined : aliased;
}

function stripConcatenatedRoleSuffix(token: string): string {
  for (const suffix of CONCATENATED_ROLE_SUFFIXES) {
    if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  return token;
}

export function extractServiceTokens(rawText: string, excludingEmail?: string): string[] {
  let text = (rawText || '').trim().toLowerCase();
  if (!text) return [];

  for (const ext of FILE_EXTENSIONS) {
    if (text.endsWith(ext)) {
      text = text.slice(0, -ext.length);
      break;
    }
  }

  if (excludingEmail) {
    text = text.split(excludingEmail.toLowerCase()).join(' ');
  }

  text = text.replace(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi, ' ');

  const multiWordNoise = [
    'two-factor', 'two factor', 'two-step', 'two step',
    'one-time', 'one time', 'single-use', 'single use',
    'recovery codes', 'recovery code', 'recovery keys', 'recovery key',
    'backup codes', 'backup code', 'emergency kit', 'emergency codes',
    'scratch codes', 'scratch code',
  ];
  for (const phrase of multiWordNoise) {
    text = text.split(phrase).join(' ');
  }

  const rawChunks = text.split(/[\s_\-/:()\[\]{},|"'<>!?#]+/).filter(Boolean);
  const result: string[] = [];

  for (const chunk of rawChunks) {
    const cleaned = chunk.replace(/^[.:/]+|[.:/]+$/g, '');
    if (cleaned.includes('.')) {
      const parts = cleaned.split('.').filter(Boolean);
      const last = parts[parts.length - 1];
      if (parts.length >= 2 && last && KNOWN_TLDS.has(last)) {
        const domainBrand = brandFromDomain(cleaned);
        if (domainBrand) {
          const canonical = canonicalBrand(domainBrand);
          if (canonical && !NOISE_WORDS.has(canonical) && !result.includes(canonical)) {
            result.push(canonical);
          }
          continue;
        }
      }
    }

    const dotParts = chunk.split('.').filter(Boolean);
    for (const part of dotParts) {
      let token = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!token) continue;
      token = stripConcatenatedRoleSuffix(token);
      if (!token || NOISE_WORDS.has(token)) continue;
      if (token.length === 1 && token !== 'x') continue;
      if (/^\d+$/.test(token)) continue;
      const canonical = canonicalBrand(token);
      if (!NOISE_WORDS.has(canonical) && !result.includes(canonical)) {
        result.push(canonical);
      }
    }
  }

  return result;
}

function extractUrls(text: string): string[] {
  return text.match(/https?:\/\/[^\s)\]>'"]+/gi) ?? [];
}

function looksLikeHeaderLine(line: string): boolean {
  if (line.startsWith('#') || line.startsWith('//')) return true;
  const lower = line.toLowerCase();
  if (
    lower.includes('://') ||
    lower.includes('recovery') ||
    lower.includes('backup') ||
    lower.includes('account') ||
    lower.includes('user') ||
    lower.includes('service') ||
    lower.includes('issuer')
  ) {
    return true;
  }
  return line.includes(' ') && /[a-z]/i.test(line);
}

function extractUsernameHint(item: VaultItem, noteLines: string[]): string | undefined {
  const direct = item.username?.trim().toLowerCase();
  if (direct) return direct;

  const titleEmail = item.title?.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (titleEmail) return titleEmail[0].toLowerCase();

  for (const line of noteLines.slice(0, 10)) {
    const lower = line.toLowerCase();
    for (const prefix of ['username:', 'user:', 'account:', 'email:', 'login:', '# username:', '# account:', '# email:']) {
      const idx = lower.indexOf(prefix);
      if (idx !== -1) {
        const val = line.slice(idx + prefix.length).trim();
        if (val) return val.toLowerCase();
      }
    }
    const lineEmail = line.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if (lineEmail) return lineEmail[0].toLowerCase();
  }

  return undefined;
}

export function understandCredential(item: VaultItem): CredentialUnderstanding {
  const role = classifyCredentialRole(item);
  const domainsSet = new Set<string>();

  for (const url of item.urls || []) {
    const d = normalizeDomainHost(url);
    if (d) domainsSet.add(d);
  }

  const noteLines = (item.notes || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const noteHeaderLines: string[] = [];
  for (const line of noteLines.slice(0, 10)) {
    for (const u of extractUrls(line)) {
      const d = normalizeDomainHost(u);
      if (d) domainsSet.add(d);
    }
    if (looksLikeHeaderLine(line)) {
      noteHeaderLines.push(line);
    }
  }

  for (const u of extractUrls(item.title || '')) {
    const d = normalizeDomainHost(u);
    if (d) domainsSet.add(d);
  }

  const usernameHint = extractUsernameHint(item, noteLines);
  const tokens: string[] = extractServiceTokens(item.title || '', usernameHint);

  const domains = Array.from(domainsSet).sort();
  const domainBrands = domains.map(brandFromDomain).filter((b): b is string => Boolean(b));
  for (const b of domainBrands) {
    if (!tokens.includes(b)) tokens.push(b);
  }

  const headerSlice = tokens.length === 0 ? noteHeaderLines : noteHeaderLines.slice(0, 4);
  for (const line of headerSlice) {
    for (const tok of extractServiceTokens(line, usernameHint)) {
      if (!tokens.includes(tok)) tokens.push(tok);
    }
  }

  const primaryServiceKey = tokens[0] ? canonicalBrand(tokens[0]) : (domainBrands[0] ?? '');

  return {
    itemId: item.id,
    role,
    hasAuthenticatorCapability: hasAuthenticatorCapability(item),
    hasRecoveryCapability: hasRecoveryCapability(item),
    primaryServiceKey,
    serviceTokens: tokens,
    domains,
    usernameHint,
  };
}

export function extractSmartServiceKey(item: VaultItem): string {
  return understandCredential(item).primaryServiceKey;
}

function areUsernamesCompatible(u1?: string, u2?: string): boolean {
  const a = (u1 || '').trim().toLowerCase();
  const b = (u2 || '').trim().toLowerCase();
  if (!a || !b) return true;
  if (a === b) return true;
  if (!a.includes('@') || !b.includes('@')) {
    const localA = a.split('@')[0];
    const localB = b.split('@')[0];
    return Boolean(localA && localA === localB);
  }
  return false;
}

function levenshteinSimilarity(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0 && n === 0) return 1;
  if (m === 0 || n === 0) return 0;

  let dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

export function matchCrossTypeCredentials(
  a: VaultItem,
  b: VaultItem,
  requireCompatibleUsernames: boolean = true
): SmartServiceMatch | null {
  if (a.id && b.id && a.id === b.id) return null;
  if (!validateCredentialCombination([a, b]).isAllowed) return null;

  const uA = understandCredential(a);
  const uB = understandCredential(b);

  if (requireCompatibleUsernames && !areUsernamesCompatible(uA.usernameHint, uB.usernameHint)) {
    return null;
  }

  const sameUser = Boolean(uA.usernameHint && uB.usernameHint && uA.usernameHint === uB.usernameHint);

  const sharedDomains = uA.domains.filter(d => uB.domains.includes(d));
  if (sharedDomains.length > 0) {
    const domain = sharedDomains[0];
    return {
      confidence: Math.min(1.0, 0.98 + (sameUser ? 0.01 : 0)),
      reason: `Same domain (${domain})`,
      serviceKey: uA.primaryServiceKey || brandFromDomain(domain) || domain,
    };
  }

  const keyA = uA.primaryServiceKey;
  const keyB = uB.primaryServiceKey;
  if ((!keyA && uA.serviceTokens.length === 0) || (!keyB && uB.serviceTokens.length === 0)) {
    return null;
  }

  const setA = new Set([keyA, ...uA.serviceTokens].filter(Boolean).map(canonicalBrand));
  const setB = new Set([keyB, ...uB.serviceTokens].filter(Boolean).map(canonicalBrand));
  const overlap = Array.from(setA).filter(t => setB.has(t));

  if ((keyA && keyA === keyB) || overlap.length > 0) {
    const exact = Boolean(keyA && keyA === keyB);
    const sharedKey = exact ? keyA : overlap[0];
    const display = sharedKey.charAt(0).toUpperCase() + sharedKey.slice(1);
    return {
      confidence: Math.min(0.99, (exact ? 0.95 : 0.9) + (sameUser ? 0.03 : 0)),
      reason: sameUser ? `Matched ${display} + account` : `Smart match: ${display}`,
      serviceKey: sharedKey,
    };
  }

  let bestScore = 0;
  let bestKey = keyA || keyB;
  for (const tA of setA) {
    for (const tB of setB) {
      if (tA.length >= 4 && tB.length >= 4) {
        if (tA.includes(tB) || tB.includes(tA)) {
          const ratio = Math.min(tA.length, tB.length) / Math.max(tA.length, tB.length);
          if (ratio >= 0.6) {
            const score = 0.84 + 0.1 * ratio;
            if (score > bestScore) {
              bestScore = score;
              bestKey = tA.length <= tB.length ? tA : tB;
            }
          }
        }
        if (Math.min(tA.length, tB.length) >= 5) {
          const sim = levenshteinSimilarity(tA, tB);
          if (sim >= 0.8 && 0.78 + 0.15 * sim > bestScore) {
            bestScore = 0.78 + 0.15 * sim;
            bestKey = tA.length >= tB.length ? tA : tB;
          }
        }
      }
    }
  }

  if (bestScore >= 0.8) {
    const display = bestKey.charAt(0).toUpperCase() + bestKey.slice(1);
    return {
      confidence: Math.min(0.95, bestScore),
      reason: `Similar service name (${display})`,
      serviceKey: bestKey,
    };
  }

  return null;
}

function rolePriority(role: CombinableCredentialRole): number {
  switch (role) {
    case 'login': return 0;
    case 'authenticator': return 1;
    case 'recovery_code': return 2;
    default: return 3;
  }
}

export function pickPrimaryCombinableItem(items: VaultItem[]): VaultItem {
  return [...items].sort((a, b) => {
    const pA = rolePriority(classifyCredentialRole(a));
    const pB = rolePriority(classifyCredentialRole(b));
    if (pA !== pB) return pA - pB;
    return (a.title || '').length - (b.title || '').length;
  })[0];
}

export function combineCrossTypeItems(primary: VaultItem, items: VaultItem[]): VaultItem {
  const merged: VaultItem = {
    ...primary,
    urls: [...(primary.urls || [])],
    tags: [...(primary.tags || [])],
    usedRecoveryCodes: primary.usedRecoveryCodes ? [...primary.usedRecoveryCodes] : undefined,
    customFields: primary.customFields ? [...primary.customFields] : undefined,
  };

  if (items.some(i => classifyCredentialRole(i) === 'login')) {
    merged.type = primary.type === 'oauth' ? 'oauth' : 'login';
  }

  for (const item of items) {
    if (item === primary || (item.id && item.id === primary.id)) continue;

    if (!merged.username && item.username) {
      merged.username = item.username;
    }
    if (!merged.password && item.password) {
      merged.password = item.password;
    }
    if (!merged.totpSecret && item.totpSecret) {
      merged.totpSecret = item.totpSecret;
      if (!merged.tags.includes('2FA')) merged.tags.push('2FA');
    }

    const isRec = classifyCredentialRole(item) === 'recovery_code' || isRecoveryCodeItem(item);
    if (isRec) {
      if (item.notes?.trim()) {
        const codes = extractRecoveryCodesList(item);
        const sentinel = codes[0] ?? '---';
        if (!merged.notes?.trim()) {
          merged.notes = item.notes.trim();
        } else if (!merged.notes.includes(sentinel)) {
          merged.notes = `${merged.notes}\n\n${item.notes.trim()}`;
        }
      }
      if (item.usedRecoveryCodes?.length || merged.usedRecoveryCodes?.length) {
        const combinedUsed = new Set<number>([
          ...(merged.usedRecoveryCodes || []),
          ...(item.usedRecoveryCodes || []),
        ]);
        merged.usedRecoveryCodes = Array.from(combinedUsed).sort((x, y) => x - y);
      }
      if (!merged.tags.includes('Recovery Codes')) merged.tags.push('Recovery Codes');
      if (!merged.tags.includes('2FA')) merged.tags.push('2FA');
    } else if (item.notes?.trim()) {
      if (!merged.notes?.trim()) {
        merged.notes = item.notes.trim();
      } else if (!merged.notes.includes(item.notes.trim())) {
        merged.notes = `${merged.notes}\n\n${item.notes.trim()}`;
      }
    }

    for (const u of item.urls || []) {
      if (u && !merged.urls.includes(u)) merged.urls.push(u);
    }
    for (const t of item.tags || []) {
      if (t && !merged.tags.includes(t)) merged.tags.push(t);
    }
    if (item.customFields?.length) {
      const existing = merged.customFields || [];
      for (const cf of item.customFields) {
        if (!existing.some(e => e.name.toLowerCase() === cf.name.toLowerCase())) {
          existing.push(cf);
        }
      }
      merged.customFields = existing;
    }
    if (item.favorite) merged.favorite = true;
  }

  merged.updatedAt = new Date().toISOString();
  return merged;
}

export function consolidateCrossTypeBatch(items: VaultItem[]): CrossTypeConsolidationResult {
  if (items.length < 2) {
    return { items, combinedCount: 0, combinedDescriptions: [] };
  }

  const orderedIndices = items
    .map((_, idx) => idx)
    .sort((i, j) => rolePriority(classifyCredentialRole(items[i])) - rolePriority(classifyCredentialRole(items[j])));

  const consumedIndices = new Set<number>();
  const output: VaultItem[] = [];
  let combinedCount = 0;
  const combinedDescriptions: string[] = [];

  for (const anchorIdx of orderedIndices) {
    if (consumedIndices.has(anchorIdx)) continue;
    const anchor = items[anchorIdx];
    const anchorRole = classifyCredentialRole(anchor);
    if (anchorRole === 'other') continue;

    const clusterIndices = [anchorIdx];
    const cluster: VaultItem[] = [anchor];

    for (const candIdx of orderedIndices) {
      if (candIdx === anchorIdx || consumedIndices.has(candIdx)) continue;
      const cand = items[candIdx];
      const next = [...cluster, cand];
      if (!validateCredentialCombination(next).isAllowed) continue;

      const m = matchCrossTypeCredentials(anchor, cand, true);
      if (m && m.confidence >= 0.82) {
        cluster.push(cand);
        clusterIndices.push(candIdx);
      }
    }

    if (cluster.length >= 2) {
      const primary = pickPrimaryCombinableItem(cluster);
      const merged = combineCrossTypeItems(primary, cluster);
      output.push(merged);
      for (const idx of clusterIndices) consumedIndices.add(idx);
      combinedCount += cluster.length - 1;
      combinedDescriptions.push(merged.title);
    }
  }

  for (let i = 0; i < items.length; i++) {
    if (!consumedIndices.has(i)) {
      output.push(items[i]);
    }
  }

  return { items: output, combinedCount, combinedDescriptions };
}
