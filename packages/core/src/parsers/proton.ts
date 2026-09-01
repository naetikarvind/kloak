/**
 * Kloak Core — Proton Pass Parser (CSV & JSON)
 */

import * as crypto from 'node:crypto';
import { VaultItem } from '../models/vault.js';
import { ImportResult, parseCsv } from './types.js';

export function parseProtonPassCsv(csvText: string): ImportResult {
  const rows = parseCsv(csvText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    try {
      const typeStr = (row['type'] || 'login').toLowerCase();
      let type: VaultItem['type'] = 'login';
      if (typeStr.includes('note')) type = 'secure_note';
      else if (typeStr.includes('card')) type = 'card';
      else if (typeStr.includes('alias')) type = 'login';

      const url = row['url'] || row['urls'] || '';
      items.push({
        id: crypto.randomUUID(),
        type,
        title: row['name'] || row['title'] || 'Untitled',
        username: row['username'] || row['email'] || undefined,
        password: row['password'] || undefined,
        urls: url ? [url] : [],
        notes: row['note'] || row['notes'] || undefined,
        totpSecret: row['totp'] || row['2fa'] || undefined,
        tags: ['Proton Pass'],
        favorite: false,
        trashed: false,
        createdAt: row['create_time'] || new Date().toISOString(),
        updatedAt: row['modify_time'] || new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`Proton Pass row error: ${e.message}`);
    }
  }

  return {
    source: 'Proton Pass (CSV)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}
