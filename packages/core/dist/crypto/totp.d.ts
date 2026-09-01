/**
 * Kloak Core — RFC 6238 TOTP Implementation
 * Complete zero-dependency Time-Based One-Time Password Engine.
 */
export interface TotpOptions {
    period?: number;
    digits?: number;
    algorithm?: 'sha1' | 'sha256' | 'sha512';
    timestamp?: number;
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
/**
 * Decodes a Base32 string (RFC 4648) into a Buffer.
 */
export declare function decodeBase32(base32: string): Buffer;
/**
 * Encodes a Buffer to a Base32 string.
 */
export declare function encodeBase32(buffer: Buffer): string;
/**
 * Generates a random Base32 secret for TOTP setup.
 */
export declare function generateTotpSecret(byteLength?: number): string;
/**
 * Generates an RFC 6238 TOTP token for the given Base32 secret.
 */
export declare function generateTotp(secretBase32: string, options?: TotpOptions): TotpResult;
/**
 * Verifies a TOTP token against a secret with a configurable tolerance window.
 */
export declare function verifyTotp(token: string, secretBase32: string, windowSteps?: number, options?: TotpOptions): boolean;
/**
 * Formats an otpauth URI for QR code generation.
 */
export declare function generateOtpAuthUri(label: string, issuer: string, secretBase32: string, digits?: number, period?: number, algorithm?: string): string;
/**
 * Parses an otpauth:// URL.
 */
export declare function parseOtpAuthUri(uriString: string): ParsedOtpAuthUri;
//# sourceMappingURL=totp.d.ts.map