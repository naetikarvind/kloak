/**
 * Kloak Core — Apple Passwords / Safari Parser (CSV)
 * Parses macOS / iOS Passwords CSV export: Title, URL, Username, Password, Notes, OTPAuth
 */

import * as crypto from 'node:crypto';
import { VaultItem } from '../models/vault.js';
import { ImportResult, parseCsv } from './types.js';
import { parseOtpAuthUri } from '../crypto/totp.js';

export function parseApplePasswordsCsv(csvText: string): ImportResult {
  const rows = parseCsv(csvText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    try {
      const title = row['title'] || row['name'] || 'Untitled';
      const url = row['url'] || '';
      const username = row['username'] || undefined;
      const password = row['password'] || undefined;
      const notes = row['notes'] || undefined;
      const otpAuth = row['otpauth'] || row['otp'] || row['verification code'];

      let totpSecret: string | undefined;
      if (otpAuth) {
        if (otpAuth.startsWith('otpauth://')) {
          try {
            const parsed = parseOtpAuthUri(otpAuth);
            totpSecret = parsed.secret;
          } catch {
            totpSecret = otpAuth;
          }
        } else {
          totpSecret = otpAuth;
        }
      }

      items.push({
        id: crypto.randomUUID(),
        type: 'login',
        title,
        username,
        password,
        urls: url ? [url] : [],
        notes,
        totpSecret,
        tags: ['Apple Passwords'],
        favorite: false,
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`Apple Passwords row error: ${e.message}`);
    }
  }

  return {
    source: 'Apple Passwords (CSV)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}
