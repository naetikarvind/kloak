/**
 * Kloak Core — LastPass Parser (CSV)
 */

import * as crypto from 'node:crypto';
import { VaultItem } from '../models/vault.js';
import { ImportResult, parseCsv } from './types.js';

export function parseLastPassCsv(csvText: string): ImportResult {
  const rows = parseCsv(csvText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    try {
      const url = row['url'] || '';
      const isNote = url === 'http://sn' || url === 'https://sn' || !url;
      const type: VaultItem['type'] = isNote ? 'secure_note' : 'login';

      const urls = isNote ? [] : [url];
      const totp = row['totp'] || row['otp'] || undefined;

      items.push({
        id: crypto.randomUUID(),
        type,
        title: row['name'] || 'Untitled',
        username: row['username'] || undefined,
        password: row['password'] || undefined,
        urls,
        notes: row['extra'] || row['notes'] || undefined,
        totpSecret: totp,
        tags: row['grouping'] ? [row['grouping']] : ['LastPass'],
        favorite: row['fav'] === '1',
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`LastPass row error: ${e.message}`);
    }
  }

  return {
    source: 'LastPass (CSV)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}
