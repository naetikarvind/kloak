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
const crypto = __importStar(require("node:crypto"));
const core_1 = require("@kloak/core");
(0, node_test_1.describe)('Kloak Crypto Engine', () => {
    const masterPassword = 'MySecretSuperPassword123!';
    const saltHex = crypto.randomBytes(32).toString('hex');
    (0, node_test_1.it)('derives a 256-bit Key Wrapping Key (KWK) using PBKDF2', () => {
        const kwk = (0, core_1.deriveKeyWrappingKey)(masterPassword, saltHex, 10000);
        assert.strictEqual(kwk.length, 32);
    });
    (0, node_test_1.it)('performs AES-256-GCM authenticated encryption and decryption', () => {
        const key = crypto.randomBytes(32);
        const plaintext = 'Super confidential secret data for vault item';
        const container = (0, core_1.encryptAesGcm)(key, plaintext);
        assert.ok(container.iv);
        assert.ok(container.ciphertext);
        assert.ok(container.tag);
        const decryptedBuf = (0, core_1.decryptAesGcm)(key, container);
        assert.strictEqual(decryptedBuf.toString('utf-8'), plaintext);
    });
    (0, node_test_1.it)('throws on tampered ciphertext or tag (GCM authentication integrity)', () => {
        const key = crypto.randomBytes(32);
        const container = (0, core_1.encryptAesGcm)(key, 'Real data');
        // Tamper ciphertext
        const tampered = {
            ...container,
            ciphertext: '00' + container.ciphertext.slice(2)
        };
        assert.throws(() => {
            (0, core_1.decryptAesGcm)(key, tampered);
        }, /Decryption failed/);
    });
    (0, node_test_1.it)('initializes a full two-key vault and unlocks with master password', () => {
        const payload = {
            version: 1,
            items: [
                {
                    id: 'test-1',
                    type: 'login',
                    title: 'GitHub',
                    username: 'user@github.com',
                    password: 'Password999!',
                    urls: ['https://github.com'],
                    tags: ['Dev'],
                    favorite: true,
                    trashed: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ],
            folders: [{ id: 'f1', name: 'Work' }],
            settings: core_1.DEFAULT_SETTINGS,
            updatedAt: new Date().toISOString()
        };
        const { vaultFile } = (0, core_1.initializeVault)(masterPassword, payload);
        assert.strictEqual(vaultFile.header.formatVersion, 1);
        assert.ok(vaultFile.header.wrappedVaultKey);
        const { payload: unlockedPayload } = (0, core_1.unlockVault)(vaultFile, masterPassword);
        assert.strictEqual(unlockedPayload.items.length, 1);
        assert.strictEqual(unlockedPayload.items[0].title, 'GitHub');
    });
    (0, node_test_1.it)('fails unlock when master password is incorrect', () => {
        const { vaultFile } = (0, core_1.initializeVault)(masterPassword, {
            version: 1,
            items: [],
            folders: [],
            settings: core_1.DEFAULT_SETTINGS,
            updatedAt: new Date().toISOString()
        });
        assert.throws(() => {
            (0, core_1.unlockVault)(vaultFile, 'WrongPassword456!');
        }, /Master password incorrect/);
    });
    (0, node_test_1.it)('re-wraps vault key when master password changes without modifying payload', () => {
        const payload = {
            version: 1,
            items: [{
                    id: '1',
                    type: 'login',
                    title: 'Bank',
                    password: 'OriginalBankPassword',
                    urls: [],
                    tags: [],
                    favorite: false,
                    trashed: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }],
            folders: [],
            settings: core_1.DEFAULT_SETTINGS,
            updatedAt: new Date().toISOString()
        };
        const { vaultFile } = (0, core_1.initializeVault)(masterPassword, payload);
        const newPass = 'NewMasterPass789!#';
        const updatedVaultFile = (0, core_1.changeMasterPassword)(vaultFile, masterPassword, newPass);
        // Old password should now fail
        assert.throws(() => {
            (0, core_1.unlockVault)(updatedVaultFile, masterPassword);
        });
        // New password should unlock successfully
        const { payload: newUnlocked } = (0, core_1.unlockVault)(updatedVaultFile, newPass);
        assert.strictEqual(newUnlocked.items[0].password, 'OriginalBankPassword');
    });
    (0, node_test_1.it)('zeroizes memory buffers effectively', () => {
        const secretBuf = Buffer.from('SensitiveSecretString123');
        (0, core_1.zeroizeBuffer)(secretBuf);
        assert.ok(secretBuf.every(b => b === 0));
    });
});
