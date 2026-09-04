/**
 * Kloak Core — Generic CSV Auto-Detector & Custom Column Mapper
 */

import * as crypto from 'node:crypto';
import { VaultItem } from '../models/vault.js';
import { ImportResult, parseCsv, CsvRow } from './types.js';

export interface ColumnMapping {
  titleColumn?: string;
  usernameColumn?: string;
  passwordColumn?: string;
  urlColumn?: string;
  notesColumn?: string;
  totpColumn?: string;
  tagsColumn?: string;
}

/**
 * Heuristically identifies columns in a generic CSV file.
 */
export function autoDetectColumnMapping(sampleRow: CsvRow): ColumnMapping {
  const keys = Object.keys(sampleRow);
  const findKey = (...patterns: string[]): string | undefined => {
    return keys.find(k => patterns.some(p => k.toLowerCase().includes(p.toLowerCase())));
  };

  return {
    titleColumn: findKey('title', 'name', 'account', 'service', 'site', 'label'),
    usernameColumn: findKey('username', 'user', 'email', 'login', 'id'),
    passwordColumn: findKey('password', 'pass', 'secret', 'key'),
    urlColumn: findKey('url', 'uri', 'link', 'website', 'domain', 'address', 'host'),
    notesColumn: findKey('notes', 'note', 'comment', 'extra', 'description'),
    totpColumn: findKey('totp', 'otp', '2fa', 'authenticator', 'code'),
    tagsColumn: findKey('tag', 'folder', 'group', 'category')
  };
}

export function parseGenericCsv(csvText: string, customMapping?: ColumnMapping): ImportResult {
  const rows = parseCsv(csvText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    return { source: 'Generic CSV', items: [], warnings: ['CSV file is empty.'], skippedCount: 0 };
  }

  const mapping = customMapping || autoDetectColumnMapping(rows[0]);

  for (const row of rows) {
    try {
      const title = (mapping.titleColumn ? row[mapping.titleColumn] : undefined) || 'Untitled';
      const username = mapping.usernameColumn ? row[mapping.usernameColumn] : undefined;
      const password = mapping.passwordColumn ? row[mapping.passwordColumn] : undefined;
      const url = mapping.urlColumn ? row[mapping.urlColumn] : undefined;
      const notes = mapping.notesColumn ? row[mapping.notesColumn] : undefined;
      const totp = mapping.totpColumn ? row[mapping.totpColumn] : undefined;
      const tag = mapping.tagsColumn ? row[mapping.tagsColumn] : undefined;

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
        tags: tag ? [tag] : [],
        favorite: false,
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`CSV parsing error: ${e.message}`);
    }
  }

  return {
    source: 'Generic CSV',
    items,
    warnings,
    skippedCount: warnings.length
  };
}
