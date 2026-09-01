/**
 * Kloak Core — Unified Import Dispatcher
 * Automatically detects or dispatches file formats to specialized parsers.
 */
import { ImportResult } from './types.js';
import { ColumnMapping } from './generic-csv.js';
export type SupportedImportFormat = 'auto' | 'bitwarden-json' | 'bitwarden-csv' | '1password-1pux' | '1password-1pif' | 'lastpass-csv' | 'apple-csv' | 'chrome-csv' | 'keepass-xml' | 'keepass-csv' | 'proton-csv' | 'dashlane-csv' | 'generic-csv';
export declare function importFromContent(content: string, format?: SupportedImportFormat, customMapping?: ColumnMapping): ImportResult;
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
//# sourceMappingURL=index.d.ts.map