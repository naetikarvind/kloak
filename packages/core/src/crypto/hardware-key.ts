/**
 * Kloak Core — Hardware Security Key (FIDO2 / YubiKey / WebAuthn) Crypto Engine
 * Supports FIDO2 PRF (CTAP 2.1 hmac-secret), challenge-response, hardware-only master key,
 * and dual-factor (Master Password + Hardware Key) envelope encryption.
 */

import * as crypto from 'node:crypto';
import { EncryptedContainer, HardwareKeyConfig, HardwareKeyCredential } from '../models/vault.js';
import {
  KEY_LENGTH_BYTES,
  DEFAULT_PBKDF2_ITERATIONS,
  SALT_LENGTH_BYTES,
  deriveKeyWrappingKey,
  encryptAesGcm,
  decryptAesGcm,
  zeroizeBuffer
} from './cipher.js';

export const HARDWARE_KEY_HKDF_INFO = 'kloak-hardware-vault-kwk';
export const DUAL_FACTOR_HKDF_INFO = 'kloak-dual-factor-kwk';

/**
 * Normalizes a hardware secret input (hex string or raw Buffer) to a Buffer.
 */
export function normalizeHardwareSecret(secret: Buffer | string): Buffer {
  if (Buffer.isBuffer(secret)) {
    return Buffer.from(secret);
  }
  const cleanHex = secret.trim().replace(/^0x/i, '');
  if (/^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length % 2 === 0) {
    return Buffer.from(cleanHex, 'hex');
  }
  // If UTF-8 or base64
  try {
    const b64 = Buffer.from(secret, 'base64');
    if (b64.length === 32) return b64;
  } catch {
    // fallback to sha256 of text
  }
  return crypto.createHash('sha256').update(secret, 'utf-8').digest();
}

/**
 * Derives a 256-bit Key Wrapping Key (KWK) directly from a hardware key secret and salt.
 * Uses HKDF-SHA256 with domain-separated info tag.
 */
export function deriveHardwareKeyWrappingKey(hardwareSecret: Buffer | string, saltHex: string): Buffer {
  const secretBuf = normalizeHardwareSecret(hardwareSecret);
  const saltBuf = Buffer.from(saltHex, 'hex');

  const derived = crypto.hkdfSync(
    'sha256',
    secretBuf,
    saltBuf,
    Buffer.from(HARDWARE_KEY_HKDF_INFO, 'utf-8'),
    KEY_LENGTH_BYTES
  );

  zeroizeBuffer(secretBuf);
  return Buffer.from(derived);
}

/**
 * Derives a 256-bit Key Wrapping Key combining BOTH Master Password AND Hardware Key.
 * Both factors are cryptographically required; neither factor alone is sufficient.
 */
export function deriveDualFactorKeyWrappingKey(
  masterPassword: string,
  hardwareSecret: Buffer | string,
  saltHex: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS
): Buffer {
  const passwordKwk = deriveKeyWrappingKey(masterPassword, saltHex, iterations);
  const hardwareKwk = deriveHardwareKeyWrappingKey(hardwareSecret, saltHex);

  // Combine password KWK (IKM) with hardware KWK (salt) via HKDF
  const combined = crypto.hkdfSync(
    'sha256',
    passwordKwk,
    hardwareKwk,
    Buffer.from(DUAL_FACTOR_HKDF_INFO, 'utf-8'),
    KEY_LENGTH_BYTES
  );

  zeroizeBuffer(passwordKwk);
  zeroizeBuffer(hardwareKwk);
  return Buffer.from(combined);
}

/**
 * Wraps the 256-bit Vault Key with a hardware-derived Key Wrapping Key.
 */
export function wrapVaultKeyWithHardwareSecret(
  vaultKey: Buffer,
  hardwareSecret: Buffer | string,
  saltHex: string,
  masterPassword?: string
): EncryptedContainer {
  const kwk = masterPassword
    ? deriveDualFactorKeyWrappingKey(masterPassword, hardwareSecret, saltHex)
    : deriveHardwareKeyWrappingKey(hardwareSecret, saltHex);

  try {
    return encryptAesGcm(kwk, vaultKey);
  } finally {
    zeroizeBuffer(kwk);
  }
}

/**
 * Unwraps the 256-bit Vault Key using a hardware secret (and optional master password).
 */
export function unwrapVaultKeyWithHardwareSecret(
  wrappedContainer: EncryptedContainer,
  hardwareSecret: Buffer | string,
  saltHex: string,
  masterPassword?: string
): Buffer {
  const kwk = masterPassword
    ? deriveDualFactorKeyWrappingKey(masterPassword, hardwareSecret, saltHex)
    : deriveHardwareKeyWrappingKey(hardwareSecret, saltHex);

  try {
    return decryptAesGcm(kwk, wrappedContainer);
  } catch (err) {
    throw new Error('Hardware key verification failed: Invalid security key secret or PIN.');
  } finally {
    zeroizeBuffer(kwk);
  }
}

/**
 * Generates a deterministic WebAuthn challenge for hardware key assertion.
 */
export function generateHardwareKeyChallenge(saltHex: string, rpId: string = 'kloak.app'): string {
  return crypto.createHash('sha256')
    .update(`kloak-fido2-challenge:${rpId}:${saltHex}`)
    .digest('hex');
}

/**
 * Generates a fresh 32-byte salt for hardware key enrollment.
 */
export function generateHardwareKeySalt(): string {
  return crypto.randomBytes(SALT_LENGTH_BYTES).toString('hex');
}
