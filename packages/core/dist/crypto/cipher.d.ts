/**
 * Kloak Core — Cryptography Engine
 * Authenticated AES-256-GCM encryption with two-key envelope hierarchy.
 */
import { EncryptedContainer, VaultFile, VaultPayload } from '../models/vault.js';
export declare const CURRENT_FORMAT_VERSION = 1;
export declare const CURRENT_KLOAK_VERSION = "1.0.0";
export declare const DEFAULT_PBKDF2_ITERATIONS = 600000;
export declare const KEY_LENGTH_BYTES = 32;
export declare const IV_LENGTH_BYTES = 12;
export declare const SALT_LENGTH_BYTES = 32;
/**
 * Derives a 256-bit Key Wrapping Key (KWK) from the master password and salt.
 */
export declare function deriveKeyWrappingKey(masterPassword: string, saltHex: string, iterations?: number): Buffer;
/**
 * Encrypts data using AES-256-GCM.
 */
export declare function encryptAesGcm(key: Buffer, plaintext: Buffer | string): EncryptedContainer;
/**
 * Decrypts an EncryptedContainer using AES-256-GCM.
 */
export declare function decryptAesGcm(key: Buffer, container: EncryptedContainer): Buffer;
/**
 * Creates a brand new encrypted vault envelope with a new random Vault Key.
 */
export declare function initializeVault(masterPassword: string, initialPayload: VaultPayload): {
    vaultFile: VaultFile;
    vaultKey: Buffer;
};
/**
 * Unlocks and decrypts a vault file using the master password.
 */
export declare function unlockVault(vaultFile: VaultFile, masterPassword: string): {
    payload: VaultPayload;
    vaultKey: Buffer;
};
/**
 * Re-encrypts the vault payload with an existing Vault Key.
 */
export declare function saveVaultPayload(vaultFile: VaultFile, vaultKey: Buffer, newPayload: VaultPayload): VaultFile;
/**
 * Changes the master password by re-wrapping the Vault Key without re-encrypting the payload!
 */
export declare function changeMasterPassword(vaultFile: VaultFile, oldMasterPassword: string, newMasterPassword: string): VaultFile;
/**
 * Securely zeroes out a buffer in memory.
 */
export declare function zeroizeBuffer(buffer: Buffer): void;
/**
 * Calculates SHA-256 hash for integrity checks.
 */
export declare function sha256Hex(data: string | Buffer): string;
//# sourceMappingURL=cipher.d.ts.map