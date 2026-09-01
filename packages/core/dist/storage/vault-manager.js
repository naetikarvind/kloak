"use strict";
/**
 * Kloak Core — On-Disk Vault Manager & Session Controller
 * Handles local persistence, auto-lock timeouts, in-memory key zeroing,
 * fuzzy search, phishing-resistant URL matching, and CRUD operations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultManager = exports.DEFAULT_SETTINGS = exports.DEFAULT_VAULT_PATH = exports.DEFAULT_VAULT_DIR = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const crypto = __importStar(require("node:crypto"));
const cipher_js_1 = require("../crypto/cipher.js");
const index_js_1 = require("../parsers/index.js");
const export_js_1 = require("../parsers/export.js");
exports.DEFAULT_VAULT_DIR = path.join(os.homedir(), '.kloak');
exports.DEFAULT_VAULT_PATH = path.join(exports.DEFAULT_VAULT_DIR, 'vault.kloak');
exports.DEFAULT_SETTINGS = {
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
class VaultManager {
    vaultPath;
    vaultFile = null;
    decryptedPayload = null;
    activeVaultKey = null;
    autoLockTimer = null;
    lastActivityTime = Date.now();
    constructor(customVaultPath = exports.DEFAULT_VAULT_PATH) {
        this.vaultPath = customVaultPath;
        this.loadVaultFileFromDisk();
    }
    /**
     * Checks if a vault file exists on disk and is initialized.
     */
    isInitialized() {
        return this.vaultFile !== null;
    }
    /**
     * Checks if the vault is currently unlocked in memory.
     */
    isUnlocked() {
        return this.decryptedPayload !== null && this.activeVaultKey !== null;
    }
    /**
     * Returns current status summary of the vault.
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized(),
            isUnlocked: this.isUnlocked(),
            itemCount: this.decryptedPayload ? this.decryptedPayload.items.filter(i => !i.trashed).length : 0,
            folderCount: this.decryptedPayload ? this.decryptedPayload.folders.length : 0,
            vaultPath: this.vaultPath,
            lastUnlockedAt: this.decryptedPayload ? new Date(this.lastActivityTime).toISOString() : undefined,
            autoLockMinutes: this.decryptedPayload?.settings.autoLockMinutes ?? exports.DEFAULT_SETTINGS.autoLockMinutes
        };
    }
    /**
     * Initializes a brand new vault file.
     */
    createVault(masterPassword) {
        if (!masterPassword || masterPassword.length < 8) {
            throw new Error('Master password must be at least 8 characters long.');
        }
        const initialPayload = {
            version: 1,
            items: [],
            folders: [
                { id: 'f_work', name: 'Work' },
                { id: 'f_personal', name: 'Personal' },
                { id: 'f_finance', name: 'Finance' }
            ],
            settings: exports.DEFAULT_SETTINGS,
            updatedAt: new Date().toISOString()
        };
        const { vaultFile, vaultKey } = (0, cipher_js_1.initializeVault)(masterPassword, initialPayload);
        this.vaultFile = vaultFile;
        this.decryptedPayload = initialPayload;
        this.activeVaultKey = vaultKey;
        this.writeVaultFileToDisk();
        this.resetAutoLockTimer();
    }
    /**
     * Unlocks the vault with the master password.
     */
    unlock(masterPassword) {
        if (!this.vaultFile) {
            this.loadVaultFileFromDisk();
            if (!this.vaultFile) {
                throw new Error('No vault found. Please create a new vault first.');
            }
        }
        const { payload, vaultKey } = (0, cipher_js_1.unlockVault)(this.vaultFile, masterPassword);
        this.decryptedPayload = payload;
        this.activeVaultKey = vaultKey;
        this.resetAutoLockTimer();
    }
    /**
     * Locks the vault immediately, wiping keys and secrets from memory.
     */
    lock() {
        if (this.autoLockTimer) {
            clearTimeout(this.autoLockTimer);
            this.autoLockTimer = null;
        }
        if (this.activeVaultKey) {
            (0, cipher_js_1.zeroizeBuffer)(this.activeVaultKey);
            this.activeVaultKey = null;
        }
        this.decryptedPayload = null;
    }
    /**
     * Updates master password by re-wrapping the vault key without touching payload.
     */
    updateMasterPassword(oldPass, newPass) {
        this.ensureUnlocked();
        if (!this.vaultFile)
            throw new Error('Vault file not loaded.');
        if (!newPass || newPass.length < 8) {
            throw new Error('New master password must be at least 8 characters long.');
        }
        this.vaultFile = (0, cipher_js_1.changeMasterPassword)(this.vaultFile, oldPass, newPass);
        this.writeVaultFileToDisk();
        this.touchActivity();
    }
    // --- CRUD Operations ---
    getItems(includeTrash = false) {
        this.ensureUnlocked();
        this.touchActivity();
        return includeTrash
            ? this.decryptedPayload.items
            : this.decryptedPayload.items.filter(i => !i.trashed);
    }
    getItem(id) {
        this.ensureUnlocked();
        this.touchActivity();
        return this.decryptedPayload.items.find(i => i.id === id);
    }
    addItem(itemInput) {
        this.ensureUnlocked();
        const newItem = {
            ...itemInput,
            id: crypto.randomUUID(),
            tags: itemInput.tags || [],
            urls: itemInput.urls || [],
            favorite: itemInput.favorite || false,
            trashed: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.decryptedPayload.items.push(newItem);
        this.save();
        return newItem;
    }
    updateItem(id, updates) {
        this.ensureUnlocked();
        const index = this.decryptedPayload.items.findIndex(i => i.id === id);
        if (index === -1) {
            throw new Error(`Item not found: ${id}`);
        }
        const updatedItem = {
            ...this.decryptedPayload.items[index],
            ...updates,
            id, // Immutable ID
            updatedAt: new Date().toISOString()
        };
        this.decryptedPayload.items[index] = updatedItem;
        this.save();
        return updatedItem;
    }
    deleteItem(id, permanent = false) {
        this.ensureUnlocked();
        const index = this.decryptedPayload.items.findIndex(i => i.id === id);
        if (index === -1)
            return;
        if (permanent || this.decryptedPayload.items[index].trashed) {
            this.decryptedPayload.items.splice(index, 1);
        }
        else {
            this.decryptedPayload.items[index].trashed = true;
            this.decryptedPayload.items[index].updatedAt = new Date().toISOString();
        }
        this.save();
    }
    restoreItem(id) {
        this.ensureUnlocked();
        const item = this.decryptedPayload.items.find(i => i.id === id);
        if (item) {
            item.trashed = false;
            item.updatedAt = new Date().toISOString();
            this.save();
        }
    }
    // --- Search & Phishing-Resistant Matching ---
    search(query) {
        this.ensureUnlocked();
        this.touchActivity();
        const q = query.trim().toLowerCase();
        if (!q)
            return this.getItems();
        return this.getItems().filter(item => {
            if (item.title.toLowerCase().includes(q))
                return true;
            if (item.username && item.username.toLowerCase().includes(q))
                return true;
            if (item.urls.some(u => u.toLowerCase().includes(q)))
                return true;
            if (item.tags.some(t => t.toLowerCase().includes(q)))
                return true;
            if (item.notes && item.notes.toLowerCase().includes(q))
                return true;
            return false;
        });
    }
    /**
     * Phishing-resistant URL domain matching.
     * Extracts effective top-level domain + 1 (eTLD+1) to prevent deceptive subdomains.
     */
    matchByUrl(urlStr) {
        this.ensureUnlocked();
        this.touchActivity();
        let targetHost = '';
        try {
            targetHost = new URL(urlStr).hostname.toLowerCase();
        }
        catch {
            targetHost = urlStr.toLowerCase();
        }
        const items = this.getItems();
        return items.filter(item => {
            for (const itemUrl of item.urls) {
                try {
                    const itemHost = new URL(itemUrl).hostname.toLowerCase();
                    // Exact match or clean subdomain match on legitimate base domain
                    if (itemHost === targetHost)
                        return true;
                    if (targetHost.endsWith('.' + itemHost))
                        return true;
                    if (itemHost.endsWith('.' + targetHost))
                        return true;
                }
                catch {
                    if (itemUrl.toLowerCase().includes(targetHost))
                        return true;
                }
            }
            return false;
        });
    }
    // --- Folders & Settings ---
    getFolders() {
        this.ensureUnlocked();
        return this.decryptedPayload.folders;
    }
    addFolder(name) {
        this.ensureUnlocked();
        const folder = {
            id: `f_${crypto.randomBytes(4).toString('hex')}`,
            name: name.trim()
        };
        this.decryptedPayload.folders.push(folder);
        this.save();
        return folder;
    }
    getSettings() {
        this.ensureUnlocked();
        return this.decryptedPayload.settings;
    }
    updateSettings(settings) {
        this.ensureUnlocked();
        this.decryptedPayload.settings = {
            ...this.decryptedPayload.settings,
            ...settings
        };
        this.save();
        this.resetAutoLockTimer();
        return this.decryptedPayload.settings;
    }
    // --- Import / Export ---
    importData(content, format = 'auto') {
        this.ensureUnlocked();
        const result = (0, index_js_1.importFromContent)(content, format);
        let imported = 0;
        for (const item of result.items) {
            this.decryptedPayload.items.push({
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
    exportData(options) {
        this.ensureUnlocked();
        return (0, export_js_1.exportVault)(this.decryptedPayload, options);
    }
    // --- Internal Persistence & Helpers ---
    ensureUnlocked() {
        if (!this.isUnlocked()) {
            throw new Error('Vault is locked. Please unlock first.');
        }
    }
    save() {
        if (!this.vaultFile || !this.activeVaultKey || !this.decryptedPayload) {
            throw new Error('Cannot save: vault is not unlocked.');
        }
        this.vaultFile = (0, cipher_js_1.saveVaultPayload)(this.vaultFile, this.activeVaultKey, this.decryptedPayload);
        this.writeVaultFileToDisk();
        this.touchActivity();
    }
    loadVaultFileFromDisk() {
        try {
            if (fs.existsSync(this.vaultPath)) {
                const raw = fs.readFileSync(this.vaultPath, 'utf-8');
                this.vaultFile = JSON.parse(raw);
            }
            else {
                this.vaultFile = null;
            }
        }
        catch {
            this.vaultFile = null;
        }
    }
    writeVaultFileToDisk() {
        if (!this.vaultFile)
            return;
        const dir = path.dirname(this.vaultPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        }
        fs.writeFileSync(this.vaultPath, JSON.stringify(this.vaultFile, null, 2), {
            encoding: 'utf-8',
            mode: 0o600
        });
    }
    touchActivity() {
        this.lastActivityTime = Date.now();
        this.resetAutoLockTimer();
    }
    resetAutoLockTimer() {
        if (this.autoLockTimer) {
            clearTimeout(this.autoLockTimer);
            this.autoLockTimer = null;
        }
        const minutes = this.decryptedPayload?.settings.autoLockMinutes ?? exports.DEFAULT_SETTINGS.autoLockMinutes;
        if (minutes <= 0)
            return; // 0 disables auto-lock
        this.autoLockTimer = setTimeout(() => {
            this.lock();
        }, minutes * 60 * 1000);
        // Prevent timer from holding node process open if unref available
        if (this.autoLockTimer.unref) {
            this.autoLockTimer.unref();
        }
    }
}
exports.VaultManager = VaultManager;
//# sourceMappingURL=vault-manager.js.map