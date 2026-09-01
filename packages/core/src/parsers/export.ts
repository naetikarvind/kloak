/**
 * Kloak Core — Export Engine
 * Generates Native Encrypted Backups, Plaintext CSV, Schema JSON, and Bitwarden-compatible JSON.
 */

import { VaultItem, VaultPayload } from '../models/vault.js';
import { initializeVault } from '../crypto/cipher.js';
import { formatCsv } from './types.js';

export interface ExportOptions {
  format: 'kloak-encrypted' | 'kloak-json' | 'kloak-csv' | 'bitwarden-json';
  password?: string; // Required for 'kloak-encrypted'
  includeTrash?: boolean;
}

export interface ExportResult {
  format: string;
  data: string;
  filename: string;
  warning?: string;
}

export function exportVault(payload: VaultPayload, options: ExportOptions): ExportResult {
  const dateStr = new Date().toISOString().split('T')[0];
  const items = options.includeTrash ? payload.items : payload.items.filter(i => !i.trashed);

  switch (options.format) {
    case 'kloak-encrypted': {
      if (!options.password) {
        throw new Error('A backup password is required for encrypted export.');
      }
      const exportPayload: VaultPayload = {
        ...payload,
        items
      };
      const { vaultFile } = initializeVault(options.password, exportPayload);
      return {
        format: 'kloak-encrypted',
        data: JSON.stringify(vaultFile, null, 2),
        filename: `kloak-backup-${dateStr}.kloak`
      };
    }

    case 'kloak-json': {
      const exportPayload: VaultPayload = {
        ...payload,
        items
      };
      return {
        format: 'kloak-json',
        data: JSON.stringify(exportPayload, null, 2),
        filename: `kloak-export-${dateStr}.json`,
        warning: 'This JSON file contains unencrypted plaintext passwords. Store or delete it securely!'
      };
    }

    case 'kloak-csv': {
      const headers = ['title', 'type', 'username', 'password', 'url', 'totp', 'notes', 'tags', 'favorite', 'created_at'];
      const rows = items.map(i => [
        i.title,
        i.type,
        i.username || '',
        i.password || '',
        i.urls.join('; '),
        i.totpSecret || '',
        i.notes || '',
        i.tags.join(', '),
        i.favorite ? 'true' : 'false',
        i.createdAt
      ]);
      const csvData = formatCsv(headers, rows);
      return {
        format: 'kloak-csv',
        data: csvData,
        filename: `kloak-export-${dateStr}.csv`,
        warning: 'This CSV file contains unencrypted plaintext passwords. Store or delete it securely!'
      };
    }

    case 'bitwarden-json': {
      const bwItems = items.map(i => {
        const itemType = i.type === 'secure_note' ? 2 : i.type === 'card' ? 3 : i.type === 'identity' ? 4 : 1;
        return {
          id: i.id,
          organizationId: null,
          folderId: null,
          type: itemType,
          name: i.title,
          notes: i.notes || null,
          favorite: i.favorite,
          login: itemType === 1 ? {
            uris: i.urls.map(u => ({ match: null, uri: u })),
            username: i.username || null,
            password: i.password || null,
            totp: i.totpSecret || null
          } : null,
          collectionIds: []
        };
      });

      const bwExport = {
        encrypted: false,
        folders: payload.folders.map(f => ({ id: f.id, name: f.name })),
        items: bwItems
      };

      return {
        format: 'bitwarden-json',
        data: JSON.stringify(bwExport, null, 2),
        filename: `bitwarden-export-${dateStr}.json`,
        warning: 'This export is in open Bitwarden JSON format and contains unencrypted passwords.'
      };
    }

    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}
