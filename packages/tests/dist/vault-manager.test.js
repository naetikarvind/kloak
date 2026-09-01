"use strict";
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
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const core_1 = require("@kloak/core");
(0, node_test_1.describe)('Kloak Vault Manager & Session Controller', () => {
    const tempDir = path.join(os.tmpdir(), `kloak-test-${Date.now()}`);
    const tempVaultPath = path.join(tempDir, 'vault.kloak');
    const masterPassword = 'MasterPasswordVaultTest123!';
    (0, node_test_1.before)(() => {
        fs.mkdirSync(tempDir, { recursive: true });
    });
    (0, node_test_1.after)(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        catch { }
    });
    (0, node_test_1.it)('creates and persists a new vault on disk', () => {
        const manager = new core_1.VaultManager(tempVaultPath);
        assert.strictEqual(manager.isInitialized(), false);
        manager.createVault(masterPassword);
        assert.strictEqual(manager.isInitialized(), true);
        assert.strictEqual(manager.isUnlocked(), true);
        assert.strictEqual(fs.existsSync(tempVaultPath), true);
    });
    (0, node_test_1.it)('locks vault, wipes keys from memory, and unlocks again', () => {
        const manager = new core_1.VaultManager(tempVaultPath);
        assert.strictEqual(manager.isInitialized(), true);
        assert.strictEqual(manager.isUnlocked(), false);
        manager.unlock(masterPassword);
        assert.strictEqual(manager.isUnlocked(), true);
        manager.lock();
        assert.strictEqual(manager.isUnlocked(), false);
        manager.unlock(masterPassword);
        assert.strictEqual(manager.isUnlocked(), true);
    });
    (0, node_test_1.it)('performs CRUD operations on vault items', () => {
        const manager = new core_1.VaultManager(tempVaultPath);
        manager.unlock(masterPassword);
        // Add
        const item = manager.addItem({
            type: 'login',
            title: 'Discord',
            username: 'gamer#1234',
            password: 'DiscordSecret99!',
            urls: ['https://discord.com/login'],
            tags: ['Gaming'],
            favorite: true,
            trashed: false
        });
        assert.ok(item.id);
        assert.strictEqual(manager.getItems().length, 1);
        // Get
        const fetched = manager.getItem(item.id);
        assert.strictEqual(fetched?.title, 'Discord');
        // Update
        const updated = manager.updateItem(item.id, { username: 'pro_gamer#9999' });
        assert.strictEqual(updated.username, 'pro_gamer#9999');
        // Soft delete to Trash
        manager.deleteItem(item.id, false);
        assert.strictEqual(manager.getItems().length, 0);
        assert.strictEqual(manager.getItems(true).length, 1);
        // Restore
        manager.restoreItem(item.id);
        assert.strictEqual(manager.getItems().length, 1);
        // Permanent delete
        manager.deleteItem(item.id, true);
        assert.strictEqual(manager.getItems(true).length, 0);
    });
    (0, node_test_1.it)('performs phishing-resistant domain matching', () => {
        const manager = new core_1.VaultManager(tempVaultPath);
        manager.unlock(masterPassword);
        manager.addItem({
            type: 'login',
            title: 'GitHub Work',
            username: 'work@github.com',
            password: 'SecretWorkPassword',
            urls: ['https://github.com/login', 'https://gist.github.com'],
            tags: [],
            favorite: false,
            trashed: false
        });
        // Valid matches
        const match1 = manager.matchByUrl('https://github.com/session');
        assert.strictEqual(match1.length, 1);
        const match2 = manager.matchByUrl('https://gist.github.com/new');
        assert.strictEqual(match2.length, 1);
        // Phishing lookalike URL should NOT match!
        const phishMatch = manager.matchByUrl('https://github.com.evil-phishing-site.net/login');
        assert.strictEqual(phishMatch.length, 0);
    });
});
