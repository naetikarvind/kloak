/**
 * Kloak Core — Bitwarden Parser (JSON & CSV)
 */

import * as crypto from 'node:crypto';
import { VaultItem } from '../models/vault.js';
import { ImportResult, parseCsv } from './types.js';

export function parseBitwardenJson(jsonText: string): ImportResult {
  const data = JSON.parse(jsonText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  const rawItems = Array.isArray(data) ? data : data.items || [];

  for (const raw of rawItems) {
    try {
      const id = raw.id || crypto.randomUUID();
      const title = raw.name || 'Untitled';
      const notes = raw.notes || undefined;
      const favorite = Boolean(raw.favorite);
      const createdAt = raw.creationDate || new Date().toISOString();
      const updatedAt = raw.revisionDate || new Date().toISOString();

      let type: VaultItem['type'] = 'login';
      let username = '';
      let password = '';
      let urls: string[] = [];
      let totpSecret: string | undefined;
      let card: VaultItem['card'];
      let identity: VaultItem['identity'];

      if (raw.type === 1 || raw.login) {
        // Login
        type = 'login';
        const login = raw.login || {};
        username = login.username || '';
        password = login.password || '';
        totpSecret = login.totp || undefined;
        if (Array.isArray(login.uris)) {
          urls = login.uris.map((u: any) => (typeof u === 'string' ? u : u.uri)).filter(Boolean);
        }
      } else if (raw.type === 2 || raw.secureNote) {
        // Secure Note
        type = 'secure_note';
      } else if (raw.type === 3 || raw.card) {
        // Card
        type = 'card';
        const c = raw.card || {};
        card = {
          cardholderName: c.cardholderName,
          number: c.number,
          brand: c.brand?.toLowerCase(),
          expMonth: c.expMonth,
          expYear: c.expYear,
          cvv: c.code
        };
      } else if (raw.type === 4 || raw.identity) {
        // Identity
        type = 'identity';
        const iden = raw.identity || {};
        identity = {
          firstName: iden.firstName,
          lastName: iden.lastName,
          email: iden.email,
          phone: iden.phone,
          address1: iden.address1,
          address2: iden.address2,
          city: iden.city,
          state: iden.state,
          zip: iden.postalCode,
          country: iden.country,
          passportNumber: iden.passportNumber,
          ssn: iden.ssn
        };
      }

      const customFields = Array.isArray(raw.fields)
        ? raw.fields.map((f: any) => ({
            id: crypto.randomUUID(),
            name: f.name || 'Field',
            value: f.value || '',
            type: f.type === 1 ? 'hidden' : f.type === 2 ? 'boolean' : 'text'
          }))
        : undefined;

      items.push({
        id,
        type,
        title,
        username: username || undefined,
        password: password || undefined,
        urls,
        notes,
        totpSecret,
        card,
        identity,
        customFields,
        tags: raw.folderId ? ['Bitwarden'] : [],
        favorite,
        trashed: Boolean(raw.deletedDate),
        createdAt,
        updatedAt
      });
    } catch (e: any) {
      warnings.push(`Failed to parse item "${raw?.name}": ${e.message}`);
    }
  }

  return {
    source: 'Bitwarden (JSON)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}

export function parseBitwardenCsv(csvText: string): ImportResult {
  const rows = parseCsv(csvText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    try {
      const typeStr = (row['type'] || 'login').toLowerCase();
      let type: VaultItem['type'] = 'login';
      if (typeStr.includes('note')) type = 'secure_note';
      else if (typeStr.includes('card')) type = 'card';
      else if (typeStr.includes('identity')) type = 'identity';

      const urls = [row['login_uri'], row['uri'], row['url']].filter(Boolean) as string[];

      items.push({
        id: crypto.randomUUID(),
        type,
        title: row['name'] || row['title'] || 'Untitled',
        username: row['login_username'] || row['username'] || undefined,
        password: row['login_password'] || row['password'] || undefined,
        urls,
        notes: row['notes'] || undefined,
        totpSecret: row['login_totp'] || row['totp'] || undefined,
        tags: row['folder'] ? [row['folder']] : [],
        favorite: row['favorite'] === '1' || row['favorite'] === 'true',
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`CSV Row error: ${e.message}`);
    }
  }

  return {
    source: 'Bitwarden (CSV)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}
