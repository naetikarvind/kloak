/**
 * Kloak Core — RFC 6238 TOTP Implementation
 * Complete zero-dependency Time-Based One-Time Password Engine.
 */

import * as crypto from 'node:crypto';

export interface TotpOptions {
  period?: number; // default: 30
  digits?: number; // default: 6
  algorithm?: 'sha1' | 'sha256' | 'sha512'; // default: sha1
  timestamp?: number; // unix timestamp in ms (default: Date.now())
}

export interface TotpResult {
  token: string;
  secondsRemaining: number;
  period: number;
  timestamp: number;
}

export interface ParsedOtpAuthUri {
  type: 'totp' | 'hotp';
  label: string;
  issuer?: string;
  secret: string;
  algorithm?: string;
  digits?: number;
  period?: number;
}

const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes a Base32 string (RFC 4648) into a Buffer.
 */
export function decodeBase32(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/[\s\-=]/g, '');
  if (!cleaned) {
    throw new Error('Base32 secret cannot be empty.');
  }

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = RFC4648_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Encodes a Buffer to a Base32 string.
 */
export function encodeBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += RFC4648_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += RFC4648_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Generates a random Base32 secret for TOTP setup.
 */
export function generateTotpSecret(byteLength: number = 20): string {
  const buf = crypto.randomBytes(byteLength);
  return encodeBase32(buf);
}

/**
 * Generates an RFC 6238 TOTP token for the given Base32 secret.
 */
export function generateTotp(secretBase32: string, options: TotpOptions = {}): TotpResult {
  const period = options.period || 30;
  const digits = options.digits || 6;
  const algorithm = options.algorithm || 'sha1';
  const timestamp = options.timestamp ?? Date.now();

  const epochSeconds = Math.floor(timestamp / 1000);
  const timeStep = Math.floor(epochSeconds / period);
  const secondsRemaining = period - (epochSeconds % period);

  const key = decodeBase32(secretBase32);

  // Time step counter as 8-byte big-endian buffer
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep), 0);

  // Compute HMAC
  const hmac = crypto.createHmac(algorithm, key);
  hmac.update(timeBuffer);
  const hmacResult = hmac.digest();

  // Dynamic truncation (RFC 4226 / RFC 6238)
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const binaryCode =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const modulo = Math.pow(10, digits);
  const tokenNumber = binaryCode % modulo;
  const token = tokenNumber.toString().padStart(digits, '0');

  return {
    token,
    secondsRemaining,
    period,
    timestamp
  };
}

/**
 * Verifies a TOTP token against a secret with a configurable tolerance window.
 */
export function verifyTotp(token: string, secretBase32: string, windowSteps: number = 1, options: TotpOptions = {}): boolean {
  const period = options.period || 30;
  const now = options.timestamp ?? Date.now();

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const checkTime = now + offset * period * 1000;
    const generated = generateTotp(secretBase32, { ...options, timestamp: checkTime });
    if (generated.token === token.trim()) {
      return true;
    }
  }
  return false;
}

/**
 * Formats an otpauth URI for QR code generation.
 */
export function generateOtpAuthUri(
  label: string,
  issuer: string,
  secretBase32: string,
  digits: number = 6,
  period: number = 30,
  algorithm: string = 'SHA1'
): string {
  const encLabel = encodeURIComponent(label);
  const encIssuer = encodeURIComponent(issuer);
  return `otpauth://totp/${encIssuer}:${encLabel}?secret=${secretBase32}&issuer=${encIssuer}&algorithm=${algorithm}&digits=${digits}&period=${period}`;
}

/**
 * Parses an otpauth:// URL.
 */
export function parseOtpAuthUri(uriString: string): ParsedOtpAuthUri {
  const url = new URL(uriString);
  if (url.protocol !== 'otpauth:') {
    throw new Error('Invalid protocol, expected otpauth://');
  }

  const type = url.hostname === 'hotp' ? 'hotp' : 'totp';
  const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('Missing secret in otpauth URI');
  }

  const issuer = url.searchParams.get('issuer') || (label.includes(':') ? label.split(':')[0] : undefined);
  const algorithm = url.searchParams.get('algorithm')?.toLowerCase() || 'sha1';
  const digits = url.searchParams.get('digits') ? parseInt(url.searchParams.get('digits')!, 10) : 6;
  const period = url.searchParams.get('period') ? parseInt(url.searchParams.get('period')!, 10) : 30;

  return {
    type,
    label,
    issuer,
    secret,
    algorithm,
    digits,
    period
  };
}
