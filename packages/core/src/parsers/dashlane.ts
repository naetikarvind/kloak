/**
 * Kloak Core — Dashlane Parser (CSV & JSON)
 */

import * as crypto from 'node:crypto';
import { VaultItem } from '../models/vault.js';
import { ImportResult, parseCsv } from './types.js';

export function parseDashlaneCsv(csvText: string): ImportResult {
  const rows = parseCsv(csvText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    try {
      const url = row['url'] || row['domain'] || '';
      items.push({
        id: crypto.randomUUID(),
        type: 'login',
        title: row['title'] || row['name'] || 'Untitled',
        username: row['username'] || row['login'] || row['email'] || undefined,
        password: row['password'] || undefined,
        urls: url ? [url] : [],
        notes: row['notes'] || row['note'] || undefined,
        totpSecret: row['otp'] || row['otpsecret'] || undefined,
        tags: row['category'] ? [row['category']] : ['Dashlane'],
        favorite: false,
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`Dashlane row error: ${e.message}`);
    }
  }

  return {
    source: 'Dashlane (CSV)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}
