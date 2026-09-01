"use strict";
/**
 * Kloak Core — RFC 6238 TOTP Implementation
 * Complete zero-dependency Time-Based One-Time Password Engine.
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
exports.decodeBase32 = decodeBase32;
exports.encodeBase32 = encodeBase32;
exports.generateTotpSecret = generateTotpSecret;
exports.generateTotp = generateTotp;
exports.verifyTotp = verifyTotp;
exports.generateOtpAuthUri = generateOtpAuthUri;
exports.parseOtpAuthUri = parseOtpAuthUri;
const crypto = __importStar(require("node:crypto"));
const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
/**
 * Decodes a Base32 string (RFC 4648) into a Buffer.
 */
function decodeBase32(base32) {
    const cleaned = base32.toUpperCase().replace(/[\s\-=]/g, '');
    if (!cleaned) {
        throw new Error('Base32 secret cannot be empty.');
    }
    let bits = 0;
    let value = 0;
    const bytes = [];
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
function encodeBase32(buffer) {
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
function generateTotpSecret(byteLength = 20) {
    const buf = crypto.randomBytes(byteLength);
    return encodeBase32(buf);
}
/**
 * Generates an RFC 6238 TOTP token for the given Base32 secret.
 */
function generateTotp(secretBase32, options = {}) {
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
    const binaryCode = ((hmacResult[offset] & 0x7f) << 24) |
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
function verifyTotp(token, secretBase32, windowSteps = 1, options = {}) {
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
function generateOtpAuthUri(label, issuer, secretBase32, digits = 6, period = 30, algorithm = 'SHA1') {
    const encLabel = encodeURIComponent(label);
    const encIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${encIssuer}:${encLabel}?secret=${secretBase32}&issuer=${encIssuer}&algorithm=${algorithm}&digits=${digits}&period=${period}`;
}
/**
 * Parses an otpauth:// URL.
 */
function parseOtpAuthUri(uriString) {
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
    const digits = url.searchParams.get('digits') ? parseInt(url.searchParams.get('digits'), 10) : 6;
    const period = url.searchParams.get('period') ? parseInt(url.searchParams.get('period'), 10) : 30;
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
//# sourceMappingURL=totp.js.map