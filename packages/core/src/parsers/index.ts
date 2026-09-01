/**
 * Kloak Core — Unified Import Dispatcher
 * Automatically detects or dispatches file formats to specialized parsers.
 */

import { ImportResult } from './types.js';
import { parseBitwardenJson, parseBitwardenCsv } from './bitwarden.js';
import { parseOnePassword1Pux, parseOnePassword1Pif } from './onepassword.js';
import { parseLastPassCsv } from './lastpass.js';
import { parseApplePasswordsCsv } from './apple.js';
import { parseChromeCsv } from './chrome.js';
import { parseKeePassXml, parseKeePassCsv } from './keepass.js';
import { parseProtonPassCsv } from './proton.js';
import { parseDashlaneCsv } from './dashlane.js';
import { parseGenericCsv, ColumnMapping } from './generic-csv.js';

export type SupportedImportFormat =
  | 'auto'
  | 'bitwarden-json'
  | 'bitwarden-csv'
  | '1password-1pux'
  | '1password-1pif'
  | 'lastpass-csv'
  | 'apple-csv'
  | 'chrome-csv'
  | 'keepass-xml'
  | 'keepass-csv'
  | 'proton-csv'
  | 'dashlane-csv'
  | 'generic-csv';

export function importFromContent(
  content: string,
  format: SupportedImportFormat = 'auto',
  customMapping?: ColumnMapping
): ImportResult {
  const trimmed = content.trim();

  if (format === 'auto') {
    // 1. Check for JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.items && (parsed.encrypted !== undefined || parsed.folders !== undefined)) {
          return parseBitwardenJson(trimmed);
        }
        if (parsed.accounts || (parsed.items && parsed.items[0]?.overview)) {
          return parseOnePassword1Pux(trimmed);
        }
        if (parsed.version && parsed.items) {
          // Kloak json
          return {
            source: 'Kloak JSON',
            items: parsed.items,
            warnings: [],
            skippedCount: 0
          };
        }
      } catch {
        // Continue fallback
      }
    }

    // 2. Check for 1PIF
    if (trimmed.includes('{"typeName":') || trimmed.startsWith('***')) {
      return parseOnePassword1Pif(trimmed);
    }

    // 3. Check for XML (KeePass)
    if (trimmed.startsWith('<?xml') || trimmed.includes('<KeePassFile>')) {
      return parseKeePassXml(trimmed);
    }

    // 4. CSV Auto-detection based on header row
    const firstLine = trimmed.split(/\r?\n/)[0].toLowerCase();
    if (firstLine.includes('login_uri') || firstLine.includes('login_username')) {
      return parseBitwardenCsv(trimmed);
    }
    if (firstLine.includes('otpauth') || (firstLine.includes('title') && firstLine.includes('url') && firstLine.includes('username') && firstLine.includes('password'))) {
      return parseApplePasswordsCsv(trimmed);
    }
    if (firstLine.includes('fav') && (firstLine.includes('grouping') || firstLine.includes('extra'))) {
      return parseLastPassCsv(trimmed);
    }
    if (firstLine.includes('group') && firstLine.includes('user name') && firstLine.includes('comments')) {
      return parseKeePassCsv(trimmed);
    }
    if (firstLine.includes('create_time') || firstLine.includes('modify_time')) {
      return parseProtonPassCsv(trimmed);
    }
    if (firstLine.includes('domain') && firstLine.includes('otpsecret')) {
      return parseDashlaneCsv(trimmed);
    }
    if (firstLine.includes('name') && firstLine.includes('url') && firstLine.includes('username') && firstLine.includes('password')) {
      return parseChromeCsv(trimmed);
    }

    // Fallback to generic CSV
    return parseGenericCsv(trimmed, customMapping);
  }

  // Explicit format specified
  switch (format) {
    case 'bitwarden-json': return parseBitwardenJson(trimmed);
    case 'bitwarden-csv': return parseBitwardenCsv(trimmed);
    case '1password-1pux': return parseOnePassword1Pux(trimmed);
    case '1password-1pif': return parseOnePassword1Pif(trimmed);
    case 'lastpass-csv': return parseLastPassCsv(trimmed);
    case 'apple-csv': return parseApplePasswordsCsv(trimmed);
    case 'chrome-csv': return parseChromeCsv(trimmed);
    case 'keepass-xml': return parseKeePassXml(trimmed);
    case 'keepass-csv': return parseKeePassCsv(trimmed);
    case 'proton-csv': return parseProtonPassCsv(trimmed);
    case 'dashlane-csv': return parseDashlaneCsv(trimmed);
    case 'generic-csv': return parseGenericCsv(trimmed, customMapping);
    default: return parseGenericCsv(trimmed, customMapping);
  }
}

export * from './types.js';
export * from './export.js';
export * from './bitwarden.js';
export * from './onepassword.js';
export * from './apple.js';
export * from './chrome.js';
export * from './lastpass.js';
export * from './keepass.js';
export * from './proton.js';
export * from './dashlane.js';
export * from './generic-csv.js';
