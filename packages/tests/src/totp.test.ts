import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  decodeBase32,
  encodeBase32,
  generateTotp,
  verifyTotp,
  generateTotpSecret,
  parseOtpAuthUri,
  generateOtpAuthUri
} from '@kloak/core';

describe('Kloak RFC 6238 TOTP Engine', () => {
  const standardSecret = 'JBSWY3DPEHPK3PXP'; // Standard Base32 secret

  it('correctly encodes and decodes Base32 strings', () => {
    const raw = Buffer.from('Hello World 123!');
    const encoded = encodeBase32(raw);
    const decoded = decodeBase32(encoded);
    assert.strictEqual(decoded.toString('utf-8'), 'Hello World 123!');
  });

  it('generates valid 6-digit TOTP tokens with seconds countdown', () => {
    const res = generateTotp(standardSecret);
    assert.strictEqual(res.token.length, 6);
    assert.ok(/^\d{6}$/.test(res.token));
    assert.ok(res.secondsRemaining >= 1 && res.secondsRemaining <= 30);
  });

  it('generates consistent token for deterministic timestamp', () => {
    const timeA = 1600000000000; // Fixed timestamp
    const resA = generateTotp(standardSecret, { timestamp: timeA });
    const resB = generateTotp(standardSecret, { timestamp: timeA });
    assert.strictEqual(resA.token, resB.token);
  });

  it('verifies TOTP token within tolerance window', () => {
    const current = generateTotp(standardSecret);
    assert.strictEqual(verifyTotp(current.token, standardSecret), true);
    assert.strictEqual(verifyTotp('000000', standardSecret), false);
  });

  it('generates and parses otpauth:// URIs', () => {
    const uri = generateOtpAuthUri('user@example.com', 'KloakSecurity', standardSecret);
    assert.ok(uri.startsWith('otpauth://totp/'));

    const parsed = parseOtpAuthUri(uri);
    assert.strictEqual(parsed.secret, standardSecret);
    assert.strictEqual(parsed.issuer, 'KloakSecurity');
    assert.strictEqual(parsed.digits, 6);
    assert.strictEqual(parsed.period, 30);
  });

  it('generates cryptographically random Base32 setup secrets', () => {
    const secret1 = generateTotpSecret(20);
    const secret2 = generateTotpSecret(20);
    assert.notStrictEqual(secret1, secret2);
    assert.ok(secret1.length >= 32);
  });
});
