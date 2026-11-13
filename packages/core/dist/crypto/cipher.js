"use strict";
/**
 * Kloak Core — Cryptography Engine
 * Authenticated AES-256-GCM encryption with two-key envelope hierarchy.
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
exports.SALT_LENGTH_BYTES = exports.IV_LENGTH_BYTES = exports.KEY_LENGTH_BYTES = exports.DEFAULT_PBKDF2_ITERATIONS = exports.CURRENT_KLOAK_VERSION = exports.CURRENT_FORMAT_VERSION = void 0;
exports.deriveKeyWrappingKey = deriveKeyWrappingKey;
exports.encryptAesGcm = encryptAesGcm;
exports.decryptAesGcm = decryptAesGcm;
exports.initializeVault = initializeVault;
exports.unlockVault = unlockVault;
exports.saveVaultPayload = saveVaultPayload;
exports.changeMasterPassword = changeMasterPassword;
exports.zeroizeBuffer = zeroizeBuffer;
exports.sha256Hex = sha256Hex;
exports.unlockVaultWithHardwareKey = unlockVaultWithHardwareKey;
exports.unlockVaultWithPasswordAndHardwareKey = unlockVaultWithPasswordAndHardwareKey;
exports.registerHardwareKeyToVault = registerHardwareKeyToVault;
exports.removeHardwareKeyFromVault = removeHardwareKeyFromVault;
const crypto = __importStar(require("node:crypto"));
const hardware_key_js_1 = require("./hardware-key.js");
exports.CURRENT_FORMAT_VERSION = 1;
exports.CURRENT_KLOAK_VERSION = '1.0.0';
exports.DEFAULT_PBKDF2_ITERATIONS = 600000;
exports.KEY_LENGTH_BYTES = 32; // 256 bits
exports.IV_LENGTH_BYTES = 12; // 96 bits for AES-GCM
exports.SALT_LENGTH_BYTES = 32;
/**
 * Derives a 256-bit Key Wrapping Key (KWK) from the master password and salt.
 */
function deriveKeyWrappingKey(masterPassword, saltHex, iterations = exports.DEFAULT_PBKDF2_ITERATIONS) {
    const salt = Buffer.from(saltHex, 'hex');
    return crypto.pbkdf2Sync(masterPassword, salt, iterations, exports.KEY_LENGTH_BYTES, 'sha256');
}
/**
 * Encrypts data using AES-256-GCM.
 */
function encryptAesGcm(key, plaintext) {
    const iv = crypto.randomBytes(exports.IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const bufferData = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, 'utf-8');
    const encrypted = Buffer.concat([cipher.update(bufferData), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        iv: iv.toString('hex'),
        ciphertext: encrypted.toString('hex'),
        tag: tag.toString('hex')
    };
}
/**
 * Decrypts an EncryptedContainer using AES-256-GCM.
 */
function decryptAesGcm(key, container) {
    const iv = Buffer.from(container.iv, 'hex');
    const tag = Buffer.from(container.tag, 'hex');
    const ciphertext = Buffer.from(container.ciphertext, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    try {
        return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }
    catch (err) {
        throw new Error('Decryption failed: Invalid password or corrupted/tampered data.');
    }
}
/**
 * Creates a brand new encrypted vault envelope with a new random Vault Key.
 */
function initializeVault(masterPassword, initialPayload) {
    const salt = crypto.randomBytes(exports.SALT_LENGTH_BYTES).toString('hex');
    const kwk = deriveKeyWrappingKey(masterPassword, salt, exports.DEFAULT_PBKDF2_ITERATIONS);
    // Generate random 256-bit Vault Key
    const vaultKey = crypto.randomBytes(exports.KEY_LENGTH_BYTES);
    // Wrap Vault Key with Key Wrapping Key
    const wrappedVaultKey = encryptAesGcm(kwk, vaultKey);
    // Encrypt payload with Vault Key
    const payloadString = JSON.stringify(initialPayload);
    const encryptedPayload = encryptAesGcm(vaultKey, payloadString);
    const header = {
        kloakVersion: exports.CURRENT_KLOAK_VERSION,
        formatVersion: exports.CURRENT_FORMAT_VERSION,
        kdf: {
            algorithm: 'PBKDF2-SHA256',
            iterations: exports.DEFAULT_PBKDF2_ITERATIONS,
            salt: salt
        },
        wrappedVaultKey: wrappedVaultKey,
        createdAt: new Date().toISOString()
    };
    zeroizeBuffer(kwk);
    return {
        vaultFile: {
            header,
            encryptedPayload
        },
        vaultKey
    };
}
/**
 * Unlocks and decrypts a vault file using the master password.
 */
function unlockVault(vaultFile, masterPassword) {
    const kdf = vaultFile.header.kdf;
    const kwk = deriveKeyWrappingKey(masterPassword, kdf.salt, kdf.iterations);
    // Unwrap Vault Key
    let vaultKey;
    try {
        vaultKey = decryptAesGcm(kwk, vaultFile.header.wrappedVaultKey);
    }
    catch (err) {
        zeroizeBuffer(kwk);
        throw new Error('Master password incorrect.');
    }
    zeroizeBuffer(kwk);
    // Decrypt Vault Payload with unwrapped Vault Key
    const decryptedPayloadBuf = decryptAesGcm(vaultKey, vaultFile.encryptedPayload);
    const payload = JSON.parse(decryptedPayloadBuf.toString('utf-8'));
    return { payload, vaultKey };
}
/**
 * Re-encrypts the vault payload with an existing Vault Key.
 */
function saveVaultPayload(vaultFile, vaultKey, newPayload) {
    const payloadString = JSON.stringify({
        ...newPayload,
        updatedAt: new Date().toISOString()
    });
    const encryptedPayload = encryptAesGcm(vaultKey, payloadString);
    return {
        ...vaultFile,
        encryptedPayload
    };
}
/**
 * Changes the master password by re-wrapping the Vault Key without re-encrypting the payload!
 */
function changeMasterPassword(vaultFile, oldMasterPassword, newMasterPassword) {
    const { vaultKey } = unlockVault(vaultFile, oldMasterPassword);
    const newSalt = crypto.randomBytes(exports.SALT_LENGTH_BYTES).toString('hex');
    const newKwk = deriveKeyWrappingKey(newMasterPassword, newSalt, exports.DEFAULT_PBKDF2_ITERATIONS);
    const newWrappedVaultKey = encryptAesGcm(newKwk, vaultKey);
    zeroizeBuffer(newKwk);
    zeroizeBuffer(vaultKey);
    return {
        ...vaultFile,
        header: {
            ...vaultFile.header,
            kdf: {
                algorithm: 'PBKDF2-SHA256',
                iterations: exports.DEFAULT_PBKDF2_ITERATIONS,
                salt: newSalt
            },
            wrappedVaultKey: newWrappedVaultKey
        }
    };
}
/**
 * Securely zeroes out a buffer in memory.
 */
function zeroizeBuffer(buffer) {
    buffer.fill(0);
}
/**
 * Calculates SHA-256 hash for integrity checks.
 */
function sha256Hex(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}
/**
 * Unlocks a vault file using a hardware security key secret (FIDO2 / YubiKey).
 */
function unlockVaultWithHardwareKey(vaultFile, hardwareSecret) {
    const hw = vaultFile.header.hardwareKey;
    if (!hw || !hw.enabled || !hw.wrappedHardwareKey) {
        throw new Error('Hardware key is not registered or enabled for this vault.');
    }
    if (hw.mode === 'password_plus_hardware') {
        throw new Error('This vault requires both Master Password and Hardware Key to unlock.');
    }
    const vaultKey = (0, hardware_key_js_1.unwrapVaultKeyWithHardwareSecret)(hw.wrappedHardwareKey, hardwareSecret, hw.salt);
    try {
        const decryptedPayloadBuf = decryptAesGcm(vaultKey, vaultFile.encryptedPayload);
        const payload = JSON.parse(decryptedPayloadBuf.toString('utf-8'));
        return { payload, vaultKey };
    }
    catch (err) {
        zeroizeBuffer(vaultKey);
        throw err;
    }
}
/**
 * Unlocks a vault file requiring BOTH Master Password and Hardware Key (dual-factor).
 */
function unlockVaultWithPasswordAndHardwareKey(vaultFile, masterPassword, hardwareSecret) {
    const hw = vaultFile.header.hardwareKey;
    if (!hw || !hw.enabled || !hw.wrappedHardwareKey) {
        throw new Error('Hardware key is not registered or enabled for this vault.');
    }
    const vaultKey = (0, hardware_key_js_1.unwrapVaultKeyWithHardwareSecret)(hw.wrappedHardwareKey, hardwareSecret, hw.salt, masterPassword);
    try {
        const decryptedPayloadBuf = decryptAesGcm(vaultKey, vaultFile.encryptedPayload);
        const payload = JSON.parse(decryptedPayloadBuf.toString('utf-8'));
        return { payload, vaultKey };
    }
    catch (err) {
        zeroizeBuffer(vaultKey);
        throw err;
    }
}
/**
 * Registers or updates a hardware key configuration on an unlocked vault file.
 */
function registerHardwareKeyToVault(vaultFile, vaultKey, credential, hardwareSecret, mode = 'hardware_only', masterPassword) {
    const salt = vaultFile.header.hardwareKey?.salt || (0, hardware_key_js_1.generateHardwareKeySalt)();
    const wrappedHardwareKey = (0, hardware_key_js_1.wrapVaultKeyWithHardwareSecret)(vaultKey, hardwareSecret, salt, mode === 'password_plus_hardware' ? masterPassword : undefined);
    const existingCreds = vaultFile.header.hardwareKey?.credentials || [];
    const credentials = [...existingCreds.filter(c => c.id !== credential.id), credential];
    const hardwareKeyConfig = {
        enabled: true,
        mode,
        credentials,
        wrappedHardwareKey,
        salt
    };
    return {
        ...vaultFile,
        header: {
            ...vaultFile.header,
            hardwareKey: hardwareKeyConfig
        }
    };
}
/**
 * Removes hardware key capability from a vault file.
 */
function removeHardwareKeyFromVault(vaultFile) {
    const { hardwareKey, ...restHeader } = vaultFile.header;
    return {
        ...vaultFile,
        header: restHeader
    };
}
//# sourceMappingURL=cipher.js.map