/**
 * Kloak Core — Cryptography Engine
 * Authenticated AES-256-GCM encryption with two-key envelope hierarchy.
 */
import { EncryptedContainer, HardwareKeyCredential, VaultFile, VaultPayload } from '../models/vault.js';
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
/**
 * Unlocks a vault file using a hardware security key secret (FIDO2 / YubiKey).
 */
export declare function unlockVaultWithHardwareKey(vaultFile: VaultFile, hardwareSecret: Buffer | string): {
    payload: VaultPayload;
    vaultKey: Buffer;
};
/**
 * Unlocks a vault file requiring BOTH Master Password and Hardware Key (dual-factor).
 */
export declare function unlockVaultWithPasswordAndHardwareKey(vaultFile: VaultFile, masterPassword: string, hardwareSecret: Buffer | string): {
    payload: VaultPayload;
    vaultKey: Buffer;
};
/**
 * Registers or updates a hardware key configuration on an unlocked vault file.
 */
export declare function registerHardwareKeyToVault(vaultFile: VaultFile, vaultKey: Buffer, credential: HardwareKeyCredential, hardwareSecret: Buffer | string, mode?: 'hardware_only' | 'password_plus_hardware', masterPassword?: string): VaultFile;
/**
 * Removes hardware key capability from a vault file.
 */
export declare function removeHardwareKeyFromVault(vaultFile: VaultFile): VaultFile;
//# sourceMappingURL=cipher.d.ts.map