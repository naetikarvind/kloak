/**
 * Kloak Core — 1Password Parser (.1pux JSON & .1pif)
 */

import * as crypto from 'node:crypto';
import { VaultItem } from '../models/vault.js';
import { ImportResult } from './types.js';

export function parseOnePassword1Pux(jsonText: string): ImportResult {
  const data = JSON.parse(jsonText);
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  const rawItems = data.items || (data.accounts ? data.accounts.flatMap((a: any) => a.vaults?.flatMap((v: any) => v.items || []) || []) : []);

  for (const raw of rawItems) {
    try {
      const id = raw.uuid || crypto.randomUUID();
      const title = raw.title || raw.overview?.title || 'Untitled';
      const notes = raw.notes || raw.details?.notesPlain || undefined;
      const favorite = Boolean(raw.favIndex && raw.favIndex > 0);
      const createdAt = raw.createdAt ? new Date(raw.createdAt * 1000).toISOString() : new Date().toISOString();
      const updatedAt = raw.updatedAt ? new Date(raw.updatedAt * 1000).toISOString() : new Date().toISOString();

      let type: VaultItem['type'] = 'login';
      let username: string | undefined;
      let password: string | undefined;
      let totpSecret: string | undefined;
      const urls: string[] = [];

      if (raw.overview?.url) urls.push(raw.overview.url);
      if (Array.isArray(raw.overview?.urls)) {
        for (const u of raw.overview.urls) {
          if (u.u && !urls.includes(u.u)) urls.push(u.u);
        }
      }

      // Fields in details
      if (raw.details?.fields) {
        for (const f of raw.details.fields) {
          if (f.designation === 'username' || f.name === 'username') username = f.value;
          else if (f.designation === 'password' || f.name === 'password') password = f.value;
          else if (f.type === 'OTP' || f.name?.toLowerCase().includes('one-time')) totpSecret = f.value;
        }
      }

      if (raw.category === 'SECURE_NOTE' || raw.typeName === 'secure.Note') {
        type = 'secure_note';
      } else if (raw.category === 'CREDIT_CARD' || raw.typeName === 'wallet.financial.CreditCard') {
        type = 'card';
      } else if (raw.category === 'IDENTITY' || raw.typeName === 'identity') {
        type = 'identity';
      }

      items.push({
        id,
        type,
        title,
        username,
        password,
        urls,
        notes,
        totpSecret,
        tags: ['1Password'],
        favorite,
        trashed: false,
        createdAt,
        updatedAt
      });
    } catch (e: any) {
      warnings.push(`1Password item error: ${e.message}`);
    }
  }

  return {
    source: '1Password (1PUX)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}

export function parseOnePassword1Pif(pifText: string): ImportResult {
  const lines = pifText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('***'));
  const items: VaultItem[] = [];
  const warnings: string[] = [];

  for (const line of lines) {
    try {
      const raw = JSON.parse(line);
      const id = raw.uuid || crypto.randomUUID();
      const title = raw.title || raw.overview?.title || 'Untitled';
      const notes = raw.notesPlain || raw.secureContents?.notesPlain || undefined;
      const urls: string[] = raw.location ? [raw.location] : [];

      let type: VaultItem['type'] = 'login';
      let username: string | undefined;
      let password: string | undefined;
      let totpSecret: string | undefined;

      const sec = raw.secureContents || {};
      username = sec.username || sec.fields?.find((f: any) => f.name === 'username')?.value;
      password = sec.password || sec.fields?.find((f: any) => f.name === 'password')?.value;

      if (raw.typeName === 'secure.Note') type = 'secure_note';
      else if (raw.typeName?.includes('CreditCard')) type = 'card';

      items.push({
        id,
        type,
        title,
        username,
        password,
        urls,
        notes,
        totpSecret,
        tags: ['1Password'],
        favorite: Boolean(raw.openContents?.faveIndex),
        trashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (e: any) {
      warnings.push(`1PIF line error: ${e.message}`);
    }
  }

  return {
    source: '1Password (1PIF)',
    items,
    warnings,
    skippedCount: warnings.length
  };
}
