/**
 * Kloak Core — Parser Types & Common Utilities
 */
import { VaultItem } from '../models/vault.js';
export interface ImportResult {
    source: string;
    items: VaultItem[];
    warnings: string[];
    skippedCount: number;
}
export interface CsvRow {
    [columnName: string]: string;
}
/**
 * Robust CSV parser handling quoted fields, escaped quotes (""), and multiline values.
 */
export declare function parseCsv(csvText: string, delimiter?: string): CsvRow[];
/**
 * Generates RFC 4180 compliant CSV string.
 */
export declare function formatCsv(headers: string[], rows: (string | number | boolean | undefined)[][]): string;
//# sourceMappingURL=types.d.ts.map