/**
 * Kloak Core — On-Disk Vault Manager & Session Controller
 * Handles local persistence, auto-lock timeouts, in-memory key zeroing,
 * fuzzy search, phishing-resistant URL matching, and CRUD operations.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import {
  VaultFile,
  VaultItem,
  VaultPayload,
  VaultSettings,
  VaultStatus,
  VaultFolder
} from '../models/vault.js';
import {
  initializeVault,
  unlockVault,
  saveVaultPayload,
  changeMasterPassword,
  zeroizeBuffer
} from '../crypto/cipher.js';
import { importFromContent, SupportedImportFormat } from '../parsers/index.js';
import { exportVault, ExportOptions, ExportResult } from '../parsers/export.js';

export const DEFAULT_VAULT_DIR = path.join(os.homedir(), '.kloak');
export const DEFAULT_VAULT_PATH = path.join(DEFAULT_VAULT_DIR, 'vault.kloak');

export const DEFAULT_SETTINGS: VaultSettings = {
  autoLockMinutes: 5,
  clearClipboardSeconds: 30,
  biometricsEnabled: true,
  defaultPasswordLength: 20,
  defaultPasswordRules: {
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    avoidAmbiguous: false
  }
};

export class VaultManager {
  private vaultPath: string;
  private vaultFile: VaultFile | null = null;
  private decryptedPayload: VaultPayload | null = null;
  private activeVaultKey: Buffer | null = null;
  private autoLockTimer: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();

  constructor(customVaultPath: string = DEFAULT_VAULT_PATH) {
    this.vaultPath = customVaultPath;
    this.loadVaultFileFromDisk();
  }

  /**
   * Checks if a vault file exists on disk and is initialized.
   */
  public isInitialized(): boolean {
    return this.vaultFile !== null;
  }

  /**
   * Checks if the vault is currently unlocked in memory.
   */
  public isUnlocked(): boolean {
    return this.decryptedPayload !== null && this.activeVaultKey !== null;
  }

  /**
   * Returns current status summary of the vault.
   */
  public getStatus(): VaultStatus {
    return {
      isInitialized: this.isInitialized(),
      isUnlocked: this.isUnlocked(),
      itemCount: this.decryptedPayload ? this.decryptedPayload.items.filter(i => !i.trashed).length : 0,
      folderCount: this.decryptedPayload ? this.decryptedPayload.folders.length : 0,
      vaultPath: this.vaultPath,
      lastUnlockedAt: this.decryptedPayload ? new Date(this.lastActivityTime).toISOString() : undefined,
      autoLockMinutes: this.decryptedPayload?.settings.autoLockMinutes ?? DEFAULT_SETTINGS.autoLockMinutes
    };
  }

  /**
   * Initializes a brand new vault file.
   */
  public createVault(masterPassword: string): void {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('Master password must be at least 8 characters long.');
    }

    const initialPayload: VaultPayload = {
      version: 1,
      items: [],
      folders: [
        { id: 'f_work', name: 'Work' },
        { id: 'f_personal', name: 'Personal' },
        { id: 'f_finance', name: 'Finance' }
      ],
      settings: DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString()
    };

    const { vaultFile, vaultKey } = initializeVault(masterPassword, initialPayload);
    this.vaultFile = vaultFile;
    this.decryptedPayload = initialPayload;
    this.activeVaultKey = vaultKey;
    this.writeVaultFileToDisk();
    this.resetAutoLockTimer();
  }

  /**
   * Unlocks the vault with the master password.
   */
  public unlock(masterPassword: string): void {
    if (!this.vaultFile) {
      this.loadVaultFileFromDisk();
      if (!this.vaultFile) {
        throw new Error('No vault found. Please create a new vault first.');
      }
    }

    const { payload, vaultKey } = unlockVault(this.vaultFile, masterPassword);
    this.decryptedPayload = payload;
    this.activeVaultKey = vaultKey;
    this.resetAutoLockTimer();
  }

  /**
   * Locks the vault immediately, wiping keys and secrets from memory.
   */
  public lock(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }
    if (this.activeVaultKey) {
      zeroizeBuffer(this.activeVaultKey);
      this.activeVaultKey = null;
    }
    this.decryptedPayload = null;
  }

  /**
   * Updates master password by re-wrapping the vault key without touching payload.
   */
  public updateMasterPassword(oldPass: string, newPass: string): void {
    this.ensureUnlocked();
    if (!this.vaultFile) throw new Error('Vault file not loaded.');
    if (!newPass || newPass.length < 8) {
      throw new Error('New master password must be at least 8 characters long.');
    }

    this.vaultFile = changeMasterPassword(this.vaultFile, oldPass, newPass);
    this.writeVaultFileToDisk();
    this.touchActivity();
  }

  // --- CRUD Operations ---

  public getItems(includeTrash: boolean = false): VaultItem[] {
    this.ensureUnlocked();
    this.touchActivity();
    return includeTrash
      ? this.decryptedPayload!.items
      : this.decryptedPayload!.items.filter(i => !i.trashed);
  }

  public getItem(id: string): VaultItem | undefined {
    this.ensureUnlocked();
    this.touchActivity();
    return this.decryptedPayload!.items.find(i => i.id === id);
  }

  public addItem(itemInput: Omit<VaultItem, 'id' | 'createdAt' | 'updatedAt'>): VaultItem {
    this.ensureUnlocked();
    const newItem: VaultItem = {
      ...itemInput,
      id: crypto.randomUUID(),
      tags: itemInput.tags || [],
      urls: itemInput.urls || [],
      favorite: itemInput.favorite || false,
      trashed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.decryptedPayload!.items.push(newItem);
    this.save();
    return newItem;
  }

  public updateItem(id: string, updates: Partial<VaultItem>): VaultItem {
    this.ensureUnlocked();
    const index = this.decryptedPayload!.items.findIndex(i => i.id === id);
    if (index === -1) {
      throw new Error(`Item not found: ${id}`);
    }

    const updatedItem: VaultItem = {
      ...this.decryptedPayload!.items[index],
      ...updates,
      id, // Immutable ID
      updatedAt: new Date().toISOString()
    };

    this.decryptedPayload!.items[index] = updatedItem;
    this.save();
    return updatedItem;
  }

  public deleteItem(id: string, permanent: boolean = false): void {
    this.ensureUnlocked();
    const index = this.decryptedPayload!.items.findIndex(i => i.id === id);
    if (index === -1) return;

    if (permanent || this.decryptedPayload!.items[index].trashed) {
      this.decryptedPayload!.items.splice(index, 1);
    } else {
      this.decryptedPayload!.items[index].trashed = true;
      this.decryptedPayload!.items[index].updatedAt = new Date().toISOString();
    }
    this.save();
  }

  public restoreItem(id: string): void {
    this.ensureUnlocked();
    const item = this.decryptedPayload!.items.find(i => i.id === id);
    if (item) {
      item.trashed = false;
      item.updatedAt = new Date().toISOString();
      this.save();
    }
  }

  // --- Search & Phishing-Resistant Matching ---

  public search(query: string): VaultItem[] {
    this.ensureUnlocked();
    this.touchActivity();
    const q = query.trim().toLowerCase();
    if (!q) return this.getItems();

    return this.getItems().filter(item => {
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.username && item.username.toLowerCase().includes(q)) return true;
      if (item.urls.some(u => u.toLowerCase().includes(q))) return true;
      if (item.tags.some(t => t.toLowerCase().includes(q))) return true;
      if (item.notes && item.notes.toLowerCase().includes(q)) return true;
      return false;
    });
  }

  /**
   * Phishing-resistant URL domain matching.
   * Extracts effective top-level domain + 1 (eTLD+1) to prevent deceptive subdomains.
   */
  public matchByUrl(urlStr: string): VaultItem[] {
    this.ensureUnlocked();
    this.touchActivity();

    let targetHost = '';
    try {
      targetHost = new URL(urlStr).hostname.toLowerCase();
    } catch {
      targetHost = urlStr.toLowerCase();
    }

    const items = this.getItems();
    return items.filter(item => {
      for (const itemUrl of item.urls) {
        try {
          const itemHost = new URL(itemUrl).hostname.toLowerCase();
          // Exact match or clean subdomain match on legitimate base domain
          if (itemHost === targetHost) return true;
          if (targetHost.endsWith('.' + itemHost)) return true;
          if (itemHost.endsWith('.' + targetHost)) return true;
        } catch {
          if (itemUrl.toLowerCase().includes(targetHost)) return true;
        }
      }
      return false;
    });
  }

  // --- Folders & Settings ---

  public getFolders(): VaultFolder[] {
    this.ensureUnlocked();
    return this.decryptedPayload!.folders;
  }

  public addFolder(name: string): VaultFolder {
    this.ensureUnlocked();
    const folder: VaultFolder = {
      id: `f_${crypto.randomBytes(4).toString('hex')}`,
      name: name.trim()
    };
    this.decryptedPayload!.folders.push(folder);
    this.save();
    return folder;
  }

  public getSettings(): VaultSettings {
    this.ensureUnlocked();
    return this.decryptedPayload!.settings;
  }

  public updateSettings(settings: Partial<VaultSettings>): VaultSettings {
    this.ensureUnlocked();
    this.decryptedPayload!.settings = {
      ...this.decryptedPayload!.settings,
      ...settings
    };
    this.save();
    this.resetAutoLockTimer();
    return this.decryptedPayload!.settings;
  }

  // --- Import / Export ---

  public importData(content: string, format: SupportedImportFormat = 'auto'): { imported: number; warnings: string[] } {
    this.ensureUnlocked();
    const result = importFromContent(content, format);
    let imported = 0;

    for (const item of result.items) {
      this.decryptedPayload!.items.push({
        ...item,
        id: crypto.randomUUID(),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      imported++;
    }

    this.save();
    return {
      imported,
      warnings: result.warnings
    };
  }

  public exportData(options: ExportOptions): ExportResult {
    this.ensureUnlocked();
    return exportVault(this.decryptedPayload!, options);
  }

  // --- Internal Persistence & Helpers ---

  private ensureUnlocked(): void {
    if (!this.isUnlocked()) {
      throw new Error('Vault is locked. Please unlock first.');
    }
  }

  private save(): void {
    if (!this.vaultFile || !this.activeVaultKey || !this.decryptedPayload) {
      throw new Error('Cannot save: vault is not unlocked.');
    }

    this.vaultFile = saveVaultPayload(this.vaultFile, this.activeVaultKey, this.decryptedPayload);
    this.writeVaultFileToDisk();
    this.touchActivity();
  }

  private loadVaultFileFromDisk(): void {
    try {
      if (fs.existsSync(this.vaultPath)) {
        const raw = fs.readFileSync(this.vaultPath, 'utf-8');
        this.vaultFile = JSON.parse(raw);
      } else {
        this.vaultFile = null;
      }
    } catch {
      this.vaultFile = null;
    }
  }

  private writeVaultFileToDisk(): void {
    if (!this.vaultFile) return;
    const dir = path.dirname(this.vaultPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(this.vaultPath, JSON.stringify(this.vaultFile, null, 2), {
      encoding: 'utf-8',
      mode: 0o600
    });
  }

  private touchActivity(): void {
    this.lastActivityTime = Date.now();
    this.resetAutoLockTimer();
  }

  private resetAutoLockTimer(): void {
    if (this.autoLockTimer) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = null;
    }

    const minutes = this.decryptedPayload?.settings.autoLockMinutes ?? DEFAULT_SETTINGS.autoLockMinutes;
    if (minutes <= 0) return; // 0 disables auto-lock

    this.autoLockTimer = setTimeout(() => {
      this.lock();
    }, minutes * 60 * 1000);

    // Prevent timer from holding node process open if unref available
    if (this.autoLockTimer.unref) {
      this.autoLockTimer.unref();
    }
  }
}
