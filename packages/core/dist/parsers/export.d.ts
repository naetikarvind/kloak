/**
 * Kloak Core — Export Engine
 * Generates Native Encrypted Backups, Plaintext CSV, Schema JSON, and Bitwarden-compatible JSON.
 */
import { VaultPayload } from '../models/vault.js';
export interface ExportOptions {
    format: 'kloak-encrypted' | 'kloak-json' | 'kloak-csv' | 'bitwarden-json';
    password?: string;
    includeTrash?: boolean;
}
export interface ExportResult {
    format: string;
    data: string;
    filename: string;
    warning?: string;
}
export declare function exportVault(payload: VaultPayload, options: ExportOptions): ExportResult;
//# sourceMappingURL=export.d.ts.map