/**
 * Kloak Core — Cryptography Engine
 * Authenticated AES-256-GCM encryption with two-key envelope hierarchy.
 */

import * as crypto from 'node:crypto';
import { EncryptedContainer, HardwareKeyConfig, HardwareKeyCredential, KdfParams, VaultFile, VaultHeader, VaultPayload } from '../models/vault.js';
import {
  generateHardwareKeySalt,
  unwrapVaultKeyWithHardwareSecret,
  wrapVaultKeyWithHardwareSecret
} from './hardware-key.js';

export const CURRENT_FORMAT_VERSION = 1;
export const CURRENT_KLOAK_VERSION = '1.0.0';
export const DEFAULT_PBKDF2_ITERATIONS = 600000;
export const KEY_LENGTH_BYTES = 32; // 256 bits
export const IV_LENGTH_BYTES = 12; // 96 bits for AES-GCM
export const SALT_LENGTH_BYTES = 32;

/**
 * Derives a 256-bit Key Wrapping Key (KWK) from the master password and salt.
 */
export function deriveKeyWrappingKey(
  masterPassword: string,
  saltHex: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS
): Buffer {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.pbkdf2Sync(
    masterPassword,
    salt,
    iterations,
    KEY_LENGTH_BYTES,
    'sha256'
  );
}

/**
 * Encrypts data using AES-256-GCM.
 */
export function encryptAesGcm(key: Buffer, plaintext: Buffer | string): EncryptedContainer {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
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
export function decryptAesGcm(key: Buffer, container: EncryptedContainer): Buffer {
  const iv = Buffer.from(container.iv, 'hex');
  const tag = Buffer.from(container.tag, 'hex');
  const ciphertext = Buffer.from(container.ciphertext, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    throw new Error('Decryption failed: Invalid password or corrupted/tampered data.');
  }
}

/**
 * Creates a brand new encrypted vault envelope with a new random Vault Key.
 */
export function initializeVault(masterPassword: string, initialPayload: VaultPayload): { vaultFile: VaultFile; vaultKey: Buffer } {
  const salt = crypto.randomBytes(SALT_LENGTH_BYTES).toString('hex');
  const kwk = deriveKeyWrappingKey(masterPassword, salt, DEFAULT_PBKDF2_ITERATIONS);

  // Generate random 256-bit Vault Key
  const vaultKey = crypto.randomBytes(KEY_LENGTH_BYTES);

  // Wrap Vault Key with Key Wrapping Key
  const wrappedVaultKey = encryptAesGcm(kwk, vaultKey);

  // Encrypt payload with Vault Key
  const payloadString = JSON.stringify(initialPayload);
  const encryptedPayload = encryptAesGcm(vaultKey, payloadString);

  const header: VaultHeader = {
    kloakVersion: CURRENT_KLOAK_VERSION,
    formatVersion: CURRENT_FORMAT_VERSION,
    kdf: {
      algorithm: 'PBKDF2-SHA256',
      iterations: DEFAULT_PBKDF2_ITERATIONS,
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
export function unlockVault(vaultFile: VaultFile, masterPassword: string): { payload: VaultPayload; vaultKey: Buffer } {
  const kdf = vaultFile.header.kdf;
  const kwk = deriveKeyWrappingKey(masterPassword, kdf.salt, kdf.iterations);

  // Unwrap Vault Key
  let vaultKey: Buffer;
  try {
    vaultKey = decryptAesGcm(kwk, vaultFile.header.wrappedVaultKey);
  } catch (err) {
    zeroizeBuffer(kwk);
    throw new Error('Master password incorrect.');
  }
  zeroizeBuffer(kwk);

  // Decrypt Vault Payload with unwrapped Vault Key
  const decryptedPayloadBuf = decryptAesGcm(vaultKey, vaultFile.encryptedPayload);
  const payload: VaultPayload = JSON.parse(decryptedPayloadBuf.toString('utf-8'));

  return { payload, vaultKey };
}

/**
 * Re-encrypts the vault payload with an existing Vault Key.
 */
export function saveVaultPayload(vaultFile: VaultFile, vaultKey: Buffer, newPayload: VaultPayload): VaultFile {
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
export function changeMasterPassword(
  vaultFile: VaultFile,
  oldMasterPassword: string,
  newMasterPassword: string
): VaultFile {
  const { vaultKey } = unlockVault(vaultFile, oldMasterPassword);

  const newSalt = crypto.randomBytes(SALT_LENGTH_BYTES).toString('hex');
  const newKwk = deriveKeyWrappingKey(newMasterPassword, newSalt, DEFAULT_PBKDF2_ITERATIONS);
  const newWrappedVaultKey = encryptAesGcm(newKwk, vaultKey);

  zeroizeBuffer(newKwk);
  zeroizeBuffer(vaultKey);

  return {
    ...vaultFile,
    header: {
      ...vaultFile.header,
      kdf: {
        algorithm: 'PBKDF2-SHA256',
        iterations: DEFAULT_PBKDF2_ITERATIONS,
        salt: newSalt
      },
      wrappedVaultKey: newWrappedVaultKey
    }
  };
}

/**
 * Securely zeroes out a buffer in memory.
 */
export function zeroizeBuffer(buffer: Buffer): void {
  buffer.fill(0);
}

/**
 * Calculates SHA-256 hash for integrity checks.
 */
export function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Unlocks a vault file using a hardware security key secret (FIDO2 / YubiKey).
 */
export function unlockVaultWithHardwareKey(
  vaultFile: VaultFile,
  hardwareSecret: Buffer | string
): { payload: VaultPayload; vaultKey: Buffer } {
  const hw = vaultFile.header.hardwareKey;
  if (!hw || !hw.enabled || !hw.wrappedHardwareKey) {
    throw new Error('Hardware key is not registered or enabled for this vault.');
  }
  if (hw.mode === 'password_plus_hardware') {
    throw new Error('This vault requires both Master Password and Hardware Key to unlock.');
  }

  const vaultKey = unwrapVaultKeyWithHardwareSecret(hw.wrappedHardwareKey, hardwareSecret, hw.salt);
  try {
    const decryptedPayloadBuf = decryptAesGcm(vaultKey, vaultFile.encryptedPayload);
    const payload: VaultPayload = JSON.parse(decryptedPayloadBuf.toString('utf-8'));
    return { payload, vaultKey };
  } catch (err) {
    zeroizeBuffer(vaultKey);
    throw err;
  }
}

/**
 * Unlocks a vault file requiring BOTH Master Password and Hardware Key (dual-factor).
 */
export function unlockVaultWithPasswordAndHardwareKey(
  vaultFile: VaultFile,
  masterPassword: string,
  hardwareSecret: Buffer | string
): { payload: VaultPayload; vaultKey: Buffer } {
  const hw = vaultFile.header.hardwareKey;
  if (!hw || !hw.enabled || !hw.wrappedHardwareKey) {
    throw new Error('Hardware key is not registered or enabled for this vault.');
  }

  const vaultKey = unwrapVaultKeyWithHardwareSecret(hw.wrappedHardwareKey, hardwareSecret, hw.salt, masterPassword);
  try {
    const decryptedPayloadBuf = decryptAesGcm(vaultKey, vaultFile.encryptedPayload);
    const payload: VaultPayload = JSON.parse(decryptedPayloadBuf.toString('utf-8'));
    return { payload, vaultKey };
  } catch (err) {
    zeroizeBuffer(vaultKey);
    throw err;
  }
}

/**
 * Registers or updates a hardware key configuration on an unlocked vault file.
 */
export function registerHardwareKeyToVault(
  vaultFile: VaultFile,
  vaultKey: Buffer,
  credential: HardwareKeyCredential,
  hardwareSecret: Buffer | string,
  mode: 'hardware_only' | 'password_plus_hardware' = 'hardware_only',
  masterPassword?: string
): VaultFile {
  const salt = vaultFile.header.hardwareKey?.salt || generateHardwareKeySalt();
  const wrappedHardwareKey = wrapVaultKeyWithHardwareSecret(
    vaultKey,
    hardwareSecret,
    salt,
    mode === 'password_plus_hardware' ? masterPassword : undefined
  );

  const existingCreds = vaultFile.header.hardwareKey?.credentials || [];
  const credentials = [...existingCreds.filter(c => c.id !== credential.id), credential];

  const hardwareKeyConfig: HardwareKeyConfig = {
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
export function removeHardwareKeyFromVault(vaultFile: VaultFile): VaultFile {
  const { hardwareKey, ...restHeader } = vaultFile.header;
  return {
    ...vaultFile,
    header: restHeader as VaultHeader
  };
}

