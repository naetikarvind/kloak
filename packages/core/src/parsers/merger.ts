/**
 * Kloak Core — Smart Password Deduplication, Auto-Merging & Risk Assessment Engine
 * Intelligently consolidates imported credentials across Google, Microsoft, Opera, Apple,
 * Bitwarden, etc., checks for password similarities, merges duplicates, and evaluates security risk.
 */

import * as crypto from 'node:crypto';
import { VaultItem, PasswordHistoryEntry } from '../models/vault.js';
import { evaluatePasswordStrength } from '../crypto/generator.js';

export interface ItemRiskAssessment {
  score: number; // 0 - 100 (100 is safest/lowest risk)
  riskLevel: 'low' | 'medium' | 'high';
  label: string;
  color: string; // #10B981 (low), #F59E0B (medium), #EF4444 (high)
  entropyBits: number;
  isReused: boolean;
  reusedCount: number;
  has2FA: boolean;
  reasons: string[];
}

export interface ReusedPasswordGroup {
  passwordMasked: string;
  count: number;
  items: Array<{ id: string; title: string; username?: string }>;
}

export interface MergeReport {
  totalProcessed: number;
  existingCount: number;
  importedCount: number;
  finalCount: number;
  exactDuplicatesMerged: number;
  updatedPasswordsMerged: number;
  newItemsAdded: number;
  reusedPasswordGroups: ReusedPasswordGroup[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalization Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MULTI_PART_TLDS = new Set([
  'co.uk', 'com.au', 'co.jp', 'co.nz', 'co.za', 'com.br', 'com.mx', 'com.ar',
  'com.sg', 'co.in', 'net.au', 'org.uk', 'gov.uk', 'edu.au', 'ac.uk'
]);

const BRAND_ALIASES: Record<string, string> = {
  'accounts.google.com': 'google.com',
  'mail.google.com': 'google.com',
  'myaccount.google.com': 'google.com',
  'passwords.google.com': 'google.com',
  'youtube.com': 'google.com',
  'login.live.com': 'microsoft.com',
  'account.microsoft.com': 'microsoft.com',
  'login.microsoftonline.com': 'microsoft.com',
  'outlook.com': 'microsoft.com',
  'live.com': 'microsoft.com',
  'appleid.apple.com': 'apple.com',
  'icloud.com': 'apple.com',
  'auth.opera.com': 'opera.com',
  'sync.opera.com': 'opera.com',
  'fb.com': 'facebook.com',
  'm.facebook.com': 'facebook.com',
  'x.com': 'twitter.com',
  'mobile.twitter.com': 'twitter.com'
};

export function normalizeDomain(urlOrHost: string): string {
  let str = (urlOrHost || '').trim().toLowerCase();
  if (!str) return '';

  // Extract hostname if full URL provided
  try {
    if (str.includes('://')) {
      str = new URL(str).hostname.toLowerCase();
    } else if (str.includes('/')) {
      str = new URL('https://' + str).hostname.toLowerCase();
    }
  } catch {
    str = str.split('/')[0];
  }

  // Strip port
  if (str.includes(':')) {
    str = str.split(':')[0];
  }

  // Check known brand alias map first
  if (BRAND_ALIASES[str]) {
    return BRAND_ALIASES[str];
  }

  // Strip common subdomains
  const prefixes = ['www.', 'm.', 'mobile.', 'login.', 'signin.', 'auth.', 'app.', 'sso.', 'accounts.'];
  for (const p of prefixes) {
    if (str.startsWith(p)) {
      str = str.slice(p.length);
      break;
    }
  }

  // Check alias again after prefix strip
  if (BRAND_ALIASES[str]) {
    return BRAND_ALIASES[str];
  }

  // Handle multi-part TLDs (e.g. google.co.uk -> google.co.uk)
  const parts = str.split('.');
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join('.');
    if (MULTI_PART_TLDS.has(lastTwo)) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }

  return str;
}

export function normalizeUsername(username?: string): string {
  if (!username) return '';
  return username.trim().toLowerCase();
}

export function accountKey(item: Partial<VaultItem>): string {
  let domain = '';
  if (item.urls && item.urls.length > 0) {
    domain = normalizeDomain(item.urls[0]);
  }
  if (!domain && item.title) {
    domain = normalizeDomain(item.title);
    if (!domain.includes('.')) {
      domain = item.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  }
  const user = normalizeUsername(item.username);
  return `${domain}::${user}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Similarity Calculations (Levenshtein Distance)
// ─────────────────────────────────────────────────────────────────────────────

export function calculatePasswordSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  const m = a.length;
  const n = b.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const maxLength = Math.max(m, n);
  if (maxLength === 0) return 1.0;
  return Math.max(0, 1 - d[m][n] / maxLength);
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk & Health Assessment
// ─────────────────────────────────────────────────────────────────────────────

export function calculateItemRisk(item: VaultItem, allVaultItems?: VaultItem[]): ItemRiskAssessment {
  const pwd = item.password || '';
  const reasons: string[] = [];

  if (!pwd) {
    return {
      score: 10,
      riskLevel: 'high',
      label: 'No Password Set',
      color: '#EF4444',
      entropyBits: 0,
      isReused: false,
      reusedCount: 0,
      has2FA: !!item.totpSecret,
      reasons: ['No password is stored for this account']
    };
  }

  // Base score from entropy & length
  const strength = evaluatePasswordStrength(pwd);
  let score = Math.round(Math.min(100, Math.max(10, strength.entropyBits)));

  // Length factor
  if (pwd.length < 8) {
    score = Math.min(score, 25);
    reasons.push('Password length is under 8 characters (Critical)');
  } else if (pwd.length < 12) {
    score = Math.min(score, 60);
    reasons.push('Password length is under 12 characters');
  }

  // Pattern alerts
  const commonWeak = /^(password|123456|qwerty|admin|welcome|letmein|login|test)/i;
  if (commonWeak.test(pwd)) {
    score = Math.min(score, 20);
    reasons.push('Contains predictable dictionary words or patterns');
  }

  // Reused password analysis across vault
  let isReused = false;
  let reusedCount = 0;
  if (allVaultItems && allVaultItems.length > 1) {
    const currentDomain = item.urls[0] ? normalizeDomain(item.urls[0]) : '';
    for (const other of allVaultItems) {
      if (other.id === item.id || other.trashed) continue;
      if (other.password && other.password === pwd) {
        const otherDomain = other.urls[0] ? normalizeDomain(other.urls[0]) : '';
        if (otherDomain !== currentDomain) {
          isReused = true;
          reusedCount++;
        }
      }
    }
  }

  if (isReused) {
    score = Math.max(15, score - 35);
    reasons.push(`Reused across ${reusedCount + 1} different online services`);
  }

  // 2FA Bonus
  const has2FA = !!item.totpSecret;
  if (has2FA) {
    score = Math.min(100, score + 12);
  } else {
    reasons.push('Two-factor authentication (2FA) is not configured');
  }

  // Final score clamping
  score = Math.max(10, Math.min(100, score));

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let color = '#10B981'; // Green
  let label = 'Low Risk';

  if (score < 50) {
    riskLevel = 'high';
    color = '#EF4444'; // Red
    label = 'High Risk';
  } else if (score < 80) {
    riskLevel = 'medium';
    color = '#F59E0B'; // Amber
    label = 'Medium Risk';
  }

  if (reasons.length === 0) {
    reasons.push('Strong unique password with high cryptographic entropy');
    if (has2FA) reasons.push('Hardware 2FA / TOTP protection enabled');
  }

  return {
    score,
    riskLevel,
    label: `${label} (${score}%)`,
    color,
    entropyBits: Math.round(strength.entropyBits),
    isReused,
    reusedCount,
    has2FA,
    reasons
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Smart Merge Logic
// ─────────────────────────────────────────────────────────────────────────────

export function smartMergeItems(canonical: VaultItem, incoming: VaultItem): { merged: VaultItem; wasUpdated: boolean } {
  const merged: VaultItem = { ...canonical };
  let wasUpdated = false;

  // 1. Title: pick the cleaner / more descriptive title
  if (!canonical.title || canonical.title.includes('http') || canonical.title === 'Untitled') {
    if (incoming.title && !incoming.title.includes('http') && incoming.title !== 'Untitled') {
      merged.title = incoming.title;
      wasUpdated = true;
    }
  }

  // 2. URLs: deduplicate and merge all unique URLs
  const urlSet = new Set<string>();
  (canonical.urls || []).forEach(u => urlSet.add(u));
  (incoming.urls || []).forEach(u => {
    if (u && !urlSet.has(u)) {
      urlSet.add(u);
      wasUpdated = true;
    }
  });
  merged.urls = Array.from(urlSet);

  // 3. Username: preserve non-empty username
  if (!merged.username && incoming.username) {
    merged.username = incoming.username;
    wasUpdated = true;
  }

  // 4. Password: check if same, newer, or stronger
  const pwd1 = canonical.password || '';
  const pwd2 = incoming.password || '';

  if (pwd1 !== pwd2 && pwd2) {
    if (!pwd1) {
      merged.password = pwd2;
      wasUpdated = true;
    } else {
      // Both have passwords! Compare dates or entropy
      const date1 = new Date(canonical.updatedAt || canonical.createdAt || 0).getTime();
      const date2 = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime();

      let activePassword = pwd1;
      let archivedPassword = pwd2;

      // If incoming is strictly newer, or incoming is significantly stronger with no explicit timestamp diff
      if (date2 > date1) {
        activePassword = pwd2;
        archivedPassword = pwd1;
      } else {
        const str1 = evaluatePasswordStrength(pwd1).entropyBits;
        const str2 = evaluatePasswordStrength(pwd2).entropyBits;
        if (str2 > str1 + 15) {
          activePassword = pwd2;
          archivedPassword = pwd1;
        }
      }

      merged.password = activePassword;
      wasUpdated = true;

      // Preserve previous password in history so no password is ever lost
      merged.passwordHistory = merged.passwordHistory ? [...merged.passwordHistory] : [];
      if (!merged.passwordHistory.some(h => h.password === archivedPassword)) {
        merged.passwordHistory.push({
          password: archivedPassword,
          changedAt: new Date().toISOString()
        });
      }
    }
  }

  // 5. 2FA TOTP: preserve if incoming has it
  if (!merged.totpSecret && incoming.totpSecret) {
    merged.totpSecret = incoming.totpSecret;
    wasUpdated = true;
  }

  // 6. Notes: combine notes if distinct
  if (incoming.notes && !merged.notes) {
    merged.notes = incoming.notes;
    wasUpdated = true;
  } else if (incoming.notes && merged.notes && !merged.notes.includes(incoming.notes)) {
    merged.notes = `${merged.notes}\n---\n[Imported Note]: ${incoming.notes}`.trim();
    wasUpdated = true;
  }

  // 7. Tags: merge unique tags
  const tagSet = new Set<string>(merged.tags || []);
  (incoming.tags || []).forEach(t => tagSet.add(t));
  merged.tags = Array.from(tagSet);

  // 8. Custom fields: combine unique fields
  if (incoming.customFields && incoming.customFields.length > 0) {
    const existingFieldNames = new Set((merged.customFields || []).map(f => f.name.toLowerCase()));
    merged.customFields = merged.customFields ? [...merged.customFields] : [];
    for (const f of incoming.customFields) {
      if (!existingFieldNames.has(f.name.toLowerCase())) {
        merged.customFields.push(f);
        wasUpdated = true;
      }
    }
  }

  // 9. Timestamps: earliest created, latest updated
  const c1 = new Date(canonical.createdAt || Date.now()).getTime();
  const c2 = new Date(incoming.createdAt || Date.now()).getTime();
  merged.createdAt = new Date(Math.min(c1, c2)).toISOString();
  merged.updatedAt = new Date().toISOString();

  // 10. Record import source tracking
  if (incoming.importSource && !merged.importSource?.includes(incoming.importSource)) {
    merged.importSource = merged.importSource
      ? `${merged.importSource}, ${incoming.importSource}`
      : incoming.importSource;
  }

  return { merged, wasUpdated };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Vault Auto-Merge Orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export function autoMergeVaultItems(
  existingItems: VaultItem[],
  incomingItems: VaultItem[]
): { mergedItems: VaultItem[]; report: MergeReport } {
  let exactDuplicatesMerged = 0;
  let updatedPasswordsMerged = 0;
  let newItemsAdded = 0;

  // Key -> Canonical Item mapping
  const accountMap = new Map<string, VaultItem>();
  const unkeyedItems: VaultItem[] = [];

  // Seed with existing items
  for (const item of existingItems) {
    if (item.trashed) continue;
    const key = accountKey(item);
    if (!key || key === '::' || key.startsWith('::')) {
      unkeyedItems.push({ ...item });
      continue;
    }
    if (accountMap.has(key)) {
      // Existing internal duplicate: auto-merge immediately
      const existing = accountMap.get(key)!;
      const { merged } = smartMergeItems(existing, item);
      accountMap.set(key, merged);
      exactDuplicatesMerged++;
    } else {
      accountMap.set(key, { ...item });
    }
  }

  // Merge incoming items
  for (const item of incomingItems) {
    if (item.trashed) continue;
    const key = accountKey(item);
    if (!key || key === '::' || key.startsWith('::')) {
      // Fallback check against unkeyed items by exact title and password
      const matchIdx = unkeyedItems.findIndex(u =>
        u.title.toLowerCase() === item.title.toLowerCase() &&
        (u.username || '').toLowerCase() === (item.username || '').toLowerCase()
      );
      if (matchIdx !== -1) {
        const { merged } = smartMergeItems(unkeyedItems[matchIdx], item);
        unkeyedItems[matchIdx] = merged;
        exactDuplicatesMerged++;
      } else {
        unkeyedItems.push({ ...item, id: item.id || crypto.randomUUID() });
        newItemsAdded++;
      }
      continue;
    }

    if (accountMap.has(key)) {
      const existing = accountMap.get(key)!;
      const pwdBefore = existing.password;
      const { merged, wasUpdated } = smartMergeItems(existing, item);
      accountMap.set(key, merged);

      if (pwdBefore && item.password && pwdBefore !== item.password) {
        updatedPasswordsMerged++;
      } else {
        exactDuplicatesMerged++;
      }
    } else {
      accountMap.set(key, { ...item, id: item.id || crypto.randomUUID() });
      newItemsAdded++;
    }
  }

  const mergedItems = [...Array.from(accountMap.values()), ...unkeyedItems];

  // Detect reused passwords across the merged set
  const pwdMap = new Map<string, Array<{ id: string; title: string; username?: string }>>();
  for (const item of mergedItems) {
    if (!item.password || item.password.length < 4) continue;
    const list = pwdMap.get(item.password) || [];
    list.push({ id: item.id, title: item.title, username: item.username });
    pwdMap.set(item.password, list);
  }

  const reusedPasswordGroups: ReusedPasswordGroup[] = [];
  for (const [pwd, list] of pwdMap.entries()) {
    if (list.length > 1) {
      const masked = pwd.length > 4 ? pwd.slice(0, 2) + '••••' + pwd.slice(-2) : '••••';
      reusedPasswordGroups.push({
        passwordMasked: masked,
        count: list.length,
        items: list
      });
    }
  }
  reusedPasswordGroups.sort((a, b) => b.count - a.count);

  const report: MergeReport = {
    totalProcessed: existingItems.length + incomingItems.length,
    existingCount: existingItems.length,
    importedCount: incomingItems.length,
    finalCount: mergedItems.length,
    exactDuplicatesMerged,
    updatedPasswordsMerged,
    newItemsAdded,
    reusedPasswordGroups
  };

  return { mergedItems, report };
}
