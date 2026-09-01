/**
 * Kloak Core — On-Disk Vault Manager & Session Controller
 * Handles local persistence, auto-lock timeouts, in-memory key zeroing,
 * fuzzy search, phishing-resistant URL matching, and CRUD operations.
 */
import { VaultItem, VaultSettings, VaultStatus, VaultFolder } from '../models/vault.js';
import { SupportedImportFormat } from '../parsers/index.js';
import { ExportOptions, ExportResult } from '../parsers/export.js';
export declare const DEFAULT_VAULT_DIR: string;
export declare const DEFAULT_VAULT_PATH: string;
export declare const DEFAULT_SETTINGS: VaultSettings;
export declare class VaultManager {
    private vaultPath;
    private vaultFile;
    private decryptedPayload;
    private activeVaultKey;
    private autoLockTimer;
    private lastActivityTime;
    constructor(customVaultPath?: string);
    /**
     * Checks if a vault file exists on disk and is initialized.
     */
    isInitialized(): boolean;
    /**
     * Checks if the vault is currently unlocked in memory.
     */
    isUnlocked(): boolean;
    /**
     * Returns current status summary of the vault.
     */
    getStatus(): VaultStatus;
    /**
     * Initializes a brand new vault file.
     */
    createVault(masterPassword: string): void;
    /**
     * Unlocks the vault with the master password.
     */
    unlock(masterPassword: string): void;
    /**
     * Locks the vault immediately, wiping keys and secrets from memory.
     */
    lock(): void;
    /**
     * Updates master password by re-wrapping the vault key without touching payload.
     */
    updateMasterPassword(oldPass: string, newPass: string): void;
    getItems(includeTrash?: boolean): VaultItem[];
    getItem(id: string): VaultItem | undefined;
    addItem(itemInput: Omit<VaultItem, 'id' | 'createdAt' | 'updatedAt'>): VaultItem;
    updateItem(id: string, updates: Partial<VaultItem>): VaultItem;
    deleteItem(id: string, permanent?: boolean): void;
    restoreItem(id: string): void;
    search(query: string): VaultItem[];
    /**
     * Phishing-resistant URL domain matching.
     * Extracts effective top-level domain + 1 (eTLD+1) to prevent deceptive subdomains.
     */
    matchByUrl(urlStr: string): VaultItem[];
    getFolders(): VaultFolder[];
    addFolder(name: string): VaultFolder;
    getSettings(): VaultSettings;
    updateSettings(settings: Partial<VaultSettings>): VaultSettings;
    importData(content: string, format?: SupportedImportFormat): {
        imported: number;
        warnings: string[];
    };
    exportData(options: ExportOptions): ExportResult;
    private ensureUnlocked;
    private save;
    private loadVaultFileFromDisk;
    private writeVaultFileToDisk;
    private touchActivity;
    private resetAutoLockTimer;
}
//# sourceMappingURL=vault-manager.d.ts.map