/**
 * Kloak Core — KeePass / KeePassXC Parser (XML & CSV)
 */

import * as crypto from 'node:crypto';
import { VaultItem } from '../models/vault.js';
import { ImportResult, parseCsv } from './types.js';

export function parseKeePassXml(xmlText: string): ImportResult {
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  // Match <Entry>...</Entry> blocks
  const entryRegex = /<Entry>([\s\S]*?)<\/Entry>/g;
  let entryMatch: RegExpExecArray | null;

  while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
    try {
      const entryContent = entryMatch[1];
      const stringRegex = /<String>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Value(?:[^>]*)>([^<]*)<\/Value>[\s\S]*?<\/String>/g;
      
      let title = '';
      let username = '';
      let password = '';
      let url = '';
      let notes = '';
      let totp = '';

      let strMatch: RegExpExecArray | null;
      while ((strMatch = stringRegex.exec(entryContent)) !== null) {
        const key = strMatch[1].trim().toLowerCase();
        const value = strMatch[2].trim();

        if (key === 'title') title = value;
        else if (key === 'username' || key === 'user name') username = value;
        else if (key === 'password') password = value;
        else if (key === 'url') url = value;
        else if (key === 'notes') notes = value;
        else if (key.includes('otp') || key.includes('totp') || key === 'timeotp-secret') totp = value;
      }

      if (!title && !username && !password && !url) continue;

      items.push({
        id: crypto.randomUUID(),
        type: 'login',
        title: title || 'Untitled',
        username: username || undefined,
        password: password || undefined,
        urls: url ? [url] : [],
        notes: notes || undefined,
        totpSecret: totp || undefined,
        tags: ['KeePass'],
        favorite: false,
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`KeePass XML error: ${e.message}`);
    }
  }

  return {
    source: 'KeePass (XML)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}

export function parseKeePassCsv(csvText: string): ImportResult {
  const rows = parseCsv(csvText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    try {
      const url = row['url'] || '';
      items.push({
        id: crypto.randomUUID(),
        type: 'login',
        title: row['title'] || row['group'] || 'Untitled',
        username: row['user name'] || row['username'] || undefined,
        password: row['password'] || undefined,
        urls: url ? [url] : [],
        notes: row['comments'] || row['notes'] || undefined,
        tags: row['group'] ? [row['group']] : ['KeePass'],
        favorite: false,
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`KeePass CSV error: ${e.message}`);
    }
  }

  return {
    source: 'KeePass (CSV)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}
