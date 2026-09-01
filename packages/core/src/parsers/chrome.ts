/**
 * Kloak Core — Chrome / Chromium / Edge / Brave / Opera Parser (CSV)
 * Format: name, url, username, password, note
 */

import * as crypto from 'node:crypto';
import { VaultItem } from '../models/vault.js';
import { ImportResult, parseCsv } from './types.js';

export function parseChromeCsv(csvText: string): ImportResult {
  const rows = parseCsv(csvText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    try {
      const url = row['url'] || '';
      let title = row['name'] || '';
      if (!title && url) {
        try {
          title = new URL(url).hostname;
        } catch {
          title = url;
        }
      }

      items.push({
        id: crypto.randomUUID(),
        type: 'login',
        title: title || 'Untitled',
        username: row['username'] || undefined,
        password: row['password'] || undefined,
        urls: url ? [url] : [],
        notes: row['note'] || row['notes'] || undefined,
        tags: ['Chrome'],
        favorite: false,
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`Chrome row error: ${e.message}`);
    }
  }

  return {
    source: 'Chrome / Chromium (CSV)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}
